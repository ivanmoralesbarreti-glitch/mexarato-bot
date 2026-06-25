const express  = require("express");
const axios    = require("axios");
const path     = require("path");
const multer   = require("multer");
const fs       = require("fs");

const app = express();
app.use(express.json({ limit: "20mb" }));
app.use(express.static(path.join(__dirname, "public")));
app.use("/productos", express.static(path.join(__dirname, "productos")));
app.use("/catalogo",  express.static(path.join(__dirname, "catalogo")));

const DIRS = [
  "comprobantes",
  "productos/churrito","productos/churrito-kilo",
  "productos/cubito","productos/cubito-kilo",
  "productos/barrita",
  "productos/oblea-abanico","productos/oblea-60","productos/oblea-30",
  "productos/choco-oblea",
  "catalogo"
];
DIRS.forEach(d => { const p = path.join(__dirname,d); if(!fs.existsSync(p)) fs.mkdirSync(p,{recursive:true}); });

const storageComp = multer.diskStorage({
  destination: (req,file,cb) => cb(null, path.join(__dirname,"comprobantes")),
  filename:    (req,file,cb) => cb(null, `comprobante_${Date.now()}${path.extname(file.originalname)}`)
});
const uploadComp = multer({
  storage: storageComp,
  limits: { fileSize: 15*1024*1024 },
  fileFilter: (req,file,cb) => {
    const ok = ["image/jpeg","image/png","image/webp","image/gif","image/bmp",
                "image/tiff","image/heic","image/heif","application/pdf"];
    ok.includes(file.mimetype) ? cb(null,true) : cb(new Error("Formato no soportado"));
  }
});

// ─── VARIABLES DE ENTORNO ─────────────────────────────────────────────────────
const ANTHROPIC_API_KEY       = process.env.ANTHROPIC_API_KEY;
const META_VERIFY_TOKEN       = process.env.META_VERIFY_TOKEN || "mexarato2026";
const META_PAGE_ACCESS_TOKEN  = process.env.META_PAGE_ACCESS_TOKEN;
const WHATSAPP_PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID;
// ─────────────────────────────────────────────────────────────────────────────

function fotosDisponibles(producto) {
  const carpeta = path.join(__dirname,"productos",producto);
  if(!fs.existsSync(carpeta)) return [];
  return fs.readdirSync(carpeta)
    .filter(f => /\.(jpg|jpeg|png|webp|gif|bmp|tiff|heic|heif|jfif|PNG|JPG|JPEG|WEBP)$/i.test(f))
    .map(f => `/productos/${producto}/${f}`);
}

function catalogoDisponible() {
  const carpeta = path.join(__dirname,"catalogo");
  if(!fs.existsSync(carpeta)) return null;
  const arch = fs.readdirSync(carpeta).filter(f => /\.pdf$/i.test(f));
  return arch.length > 0 ? `/catalogo/${arch[0]}` : null;
}

const SYSTEM_PROMPT = `Eres MEXABOT, asistente virtual oficial de MEXARATO — snacks artesanales de amaranto prehispánico, Huazulco, Morelos, México.

Al inicio de CADA conversación preséntate así:
"¡Hola! Soy MEXABOT, tu asistente virtual de MEXARATO 🌾 Estoy aquí para ayudarte a conocer nuestros productos, armar tu pedido y resolver todas tus dudas. ¿En qué te puedo ayudar hoy?"

CORRECCIÓN DE ORTOGRAFÍA: Entiende aunque el cliente escriba mal. Tú siempre escribe correctamente.
PERSONALIDAD: Cálido, mexicano, entusiasta, persuasivo. Usa "tú". Máx 4 oraciones. SIEMPRE busca cerrar la venta.

══════════════════════════════════════════
DESCUENTO PRIMERA COMPRA — MUY IMPORTANTE
══════════════════════════════════════════
Si el cliente menciona que es su PRIMERA COMPRA o que nunca ha comprado antes:
1. Felicítalo con entusiasmo
2. Ofrécele 15% de descuento en cualquier pedido (menudeo o mayoreo)
3. Para el Paquete Premium Tonatiuh el descuento es 20%
4. Aplica el descuento al precio que corresponda y muéstrale el precio final
5. Menciona que es un beneficio exclusivo por ser cliente nuevo

══════════════════════════════════════════
FOTOS Y CATÁLOGO
══════════════════════════════════════════
Cuando el cliente pida ver fotos de un producto o el catálogo, responde Y agrega la etiqueta al final:
- Fotos Churritos 50g:     [FOTO:churrito]
- Fotos Churritos x kilo:  [FOTO:churrito-kilo]
- Fotos Cubitos 50g:       [FOTO:cubito]
- Fotos Cubitos x kilo:    [FOTO:cubito-kilo]
- Fotos Barritas:          [FOTO:barrita]
- Fotos Oblea Abanico 70g: [FOTO:oblea-abanico]
- Fotos Oblea 60g:         [FOTO:oblea-60]
- Fotos Oblea 30g:         [FOTO:oblea-30]
- Fotos Choco Oblea:       [FOTO:choco-oblea]
- Catálogo completo:       [CATALOGO]

══════════════════════════════════════════
PRODUCTOS Y SABORES
══════════════════════════════════════════

🌽 CHURRITOS DE AMARANTO 50g — $26/pza
Sabores: Pikín | Chipotle | Habanero | Queso | Limón y sal
Sabores personalizados disponibles — contactar asesor.

🍫 CUBITOS DE CHOCOLATE 70g — $26/pza (9g proteína vegetal)
Snack artesanal de amaranto con chocolate. Sin conservadores.

🌾 BARRITAS DE AMARANTO 55g — $25.98/pza
Dulce tradicional mexicano de amaranto.

🍪 OBLEAS 60g y 30g
Sabores: Arándano | Cajeta | Capuchino | Chocolate | Coco | Frutos rojos | Matcha | Mora azul | Nuez | Pink chai | Pistache | Taro
Sabores personalizados — contactar asesor.

🌸 OBLEA ABANICO 70g
Sabores: Arándano | Capuchino | Chocolate | Frutos rojos | Nuez
Opciones adicionales — consultar asesor.

🍫 CHOCO OBLEA — Oblea con cobertura de chocolate artesanal.

══════════════════════════════════════════
INFORMACIÓN NUTRIMENTAL
══════════════════════════════════════════
Si el cliente pide información nutrimental, menciona:
- Todos los productos son base amaranto: alto en proteína vegetal, fibra, calcio y hierro
- Sin conservadores ni colorantes artificiales
- Producción 100% artesanal
- Cubito 70g: 9g proteína vegetal por pieza
- Barritas y Obleas: energía natural, bajo en sodio
- Para tabla nutrimental detallada por producto: [FOTO:info-nutrimental]

══════════════════════════════════════════
PAQUETES EMPRENDEDOR
══════════════════════════════════════════
Son paquetes surtidos listos para reventa. Envío incluido.

🟠 PAQUETE INICIAL TLÁLOC — 80 piezas
  Contenido: 20 Churritos + 21 Obleas + 15 Oblea Abanico + 12 Barritas + 12 Cubitos
  Precio normal: $1,620
  Precio con 15% descuento primera compra: $1,377

🔵 PAQUETE BÁSICO QUETZALCÓATL — 160 piezas
  Contenido: 40 Churritos + 30 Obleas + 24 Oblea Abanico + 24 Barritas + 6 Choco Oblea + 20 Cubitos + 16 pzas extra
  Precio normal: $2,660
  Precio con 15% descuento primera compra: $2,261

🟣 PAQUETE AVANZADO COATLICUE — 320 piezas
  Contenido: 80 Churritos + 60 Obleas + 48 Oblea Abanico + 48 Barritas + 12 Choco Oblea + 40 Cubitos + 32 pzas extra
  Precio normal: $4,590
  Precio con 15% descuento primera compra: $3,902

⭐ PAQUETE PREMIUM TONATIUH — 660 piezas
  Contenido: 160 Churritos + 120 Obleas + 96 Oblea Abanico + 96 Barritas + 44 Choco Oblea + 80 Cubitos + 64 pzas extra
  Precio normal: $10,045
  Precio con 20% descuento primera compra: $8,036
  ⚠️ Este paquete tiene 20% de descuento (no 15%) para primera compra

ESTRATEGIA DE VENTA DE PAQUETES:
- Presentar siempre los 4 paquetes cuando el cliente pregunte por mayoreo o reventa
- Recomendar el Coatlicue o Tonatiuh para mayor rentabilidad
- Mencionar el descuento de primera compra si aplica
- Destacar que el envío está incluido en todos

══════════════════════════════════════════
PRECIOS MAYOREO — envío INCLUIDO
══════════════════════════════════════════

CUBITOS DE CHOCOLATE x pieza (70g):
  50=$1,100 ($22/u) | 100=$2,000 ($20/u) | 200=$3,600 ($18/u)
CUBITOS x kg:
  3kg=$1,199 | 5kg=$1,749 | 15kg=$4,299 | 30kg=$7,290
CHURRITOS 50g x pieza:
  50=$1,050 ($21/u) | 100=$1,820 ($18.20/u) | 200=$3,200 ($16/u)
CHURRITOS x kg:
  3kg=$999 | 7kg=$1,820 | 15kg=$3,450 | 30kg=$4,950
BARRITAS 55g:
  50=$1,099 | 100=$1,699 | 200=$2,598 | 400=$3,996
OBLEA ABANICO 70g:
  50=$1,149 | 100=$2,049 | 200=$3,599 | 400=$6,399
  +1,000 pzas → asesor
OBLEAS 60g:
  50=$1,099 | 100=$1,900 | 200=$3,400
OBLEAS 30g:
  77=$1,463 | 200=$3,400 | 400=$6,400
CHOCO OBLEA:
  50=$1,200 | 100=$1,899 | 250=$4,250 | 500=$6,999

Si el cliente es de primera compra, aplica 15% de descuento al precio que corresponda y muestra ambos precios.

══════════════════════════════════════════
MÉTODOS DE PAGO
══════════════════════════════════════════
Opción 1 — BBVA (principal):
  💳 Tarjeta: 4152 3144 6718 0017
  🔗 CLABE: 012180015732929378
  👤 Titular: Vanessa Morales Barreto

Opción 2 — Mercado Pago (si no puede en BBVA):
  🔗 CLABE: 722969028345560415
  👤 Beneficiario: Vanessa Morales Barreto
  🏦 Institución: Mercado Pago W

Siempre pedir captura/comprobante. También pueden enviarlo al WhatsApp: 735-218-2512

══════════════════════════════════════════
PAQUETE BIENVENIDA — $699
══════════════════════════════════════════
Para clientes nuevos con objeción de precio (diferente al descuento 15%).
El cliente elige productos y sabores hasta $699. Envío incluido.

══════════════════════════════════════════
ETIQUETADO
══════════════════════════════════════════
Siempre preguntar al confirmar pedido:
"¿Deseas que tu pedido venga etiquetado?
  🏷️ Con etiqueta MEXARATO (recomendado): agrega valor y genera confianza en tus clientes.
  📦 Sin etiqueta: ideal para poner tu propia marca."
Siempre recomendar CON etiqueta.

══════════════════════════════════════════
TIEMPOS DE ENTREGA
══════════════════════════════════════════
- Antes de 11:00 AM → sale el MISMO DÍA
- Horario: 7:00 AM – 5:00 PM
- Después de las 5:00 PM → sale al día siguiente
- Entrega: 2 a 4 días hábiles

══════════════════════════════════════════
FLUJO DE PEDIDO
══════════════════════════════════════════
1. Producto(s), sabor(es) y cantidad
2. ¿Es tu primera compra? (para aplicar descuento si aplica)
3. Datos de envío:
"Para procesar tu pedido necesito:
📋 Nombre completo:
🏠 Calle y número:
🏘️ Colonia:
📮 CP:
📱 Número telefónico:
📍 Referencia de envío: (máx 25 caracteres)"
4. Opción de etiquetado
5. Método de pago y comprobante

Cuando tengas nombre + dirección + pedido confirmado escribe al final: [PEDIDO_LISTO]

══════════════════════════════════════════
ESCALADO
══════════════════════════════════════════
Escalar cuando: cliente lo pide, pedido >1,000 pzas, queja, sabor especial no disponible.
Escribe al final: [ESCALAR_ASESOR]

══════════════════════════════════════════
PERSUASIÓN
══════════════════════════════════════════
- Beneficios: sin conservadores, artesanal, proteína vegetal, herencia prehispánica
- Urgencia: "Si haces tu pedido antes de las 11 AM, sale hoy mismo"
- Si duda por precio: Paquete Bienvenida $699 o descuento primera compra
- Siempre termina con una pregunta

SITIO WEB: mexarato.com.mx

══════════════════════════════════════════
MENCIONAR SITIO WEB
══════════════════════════════════════════
Menciona mexarato.com.mx proactivamente en estos momentos:
- Al cerrar un pedido: "También puedes ver todos nuestros productos en mexarato.com.mx"
- Cuando el cliente pregunte por más productos o sabores
- Al despedirte: "Recuerda que puedes visitar mexarato.com.mx para ver toda nuestra línea"`;

const sesiones = new Map();

// ─── WEBHOOK META — VERIFICACIÓN GET ─────────────────────────────────────────
app.get("/webhook", (req, res) => {
  const mode      = req.query["hub.mode"];
  const token     = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  console.log("📡 Verificación webhook recibida:", { mode, token });

  if (mode === "subscribe" && token === META_VERIFY_TOKEN) {
    console.log("✅ Webhook verificado correctamente");
    res.status(200).send(challenge);
  } else {
    console.error("❌ Token de verificación incorrecto");
    res.sendStatus(403);
  }
});

// ─── WEBHOOK META — RECEPCIÓN DE MENSAJES POST ───────────────────────────────
app.post("/webhook", async (req, res) => {
  res.sendStatus(200); // Responder rápido para que Meta no reintente

  const body = req.body;
  if (body.object !== "whatsapp_business_account") return;

  for (const entry of body.entry || []) {
    for (const change of entry.changes || []) {
      const value = change.value;
      if (!value.messages) continue;

      for (const msg of value.messages) {

        const from = msg.from;
        const sid  = `wa_${from}`;

        // ── Manejo de imágenes ──────────────────────────────────────────────
        if (msg.type === "image") {
          const imageId = msg.image?.id;
          console.log(`🖼️ Imagen recibida de ${from}: ${imageId}`);

          const waHeaders = { Authorization: `Bearer ${META_PAGE_ACCESS_TOKEN}`, "Content-Type": "application/json" };
          const waUrl = `https://graph.facebook.com/v19.0/${WHATSAPP_PHONE_NUMBER_ID}/messages`;
          const ASESOR = "527352182512";

          // Preguntar al cliente si es comprobante
          await axios.post(waUrl, {
            messaging_product: "whatsapp", to: from, type: "text",
            text: { body: "📎 Recibí tu imagen. ¿Es tu *comprobante de pago*? Responde *SÍ* para confirmar o *NO* si es otra cosa." }
          }, { headers: waHeaders });

          // Guardar imagen pendiente en sesión
          if (!sesiones.has(sid)) sesiones.set(sid, []);
          sesiones.get(sid).push({ role: "user", content: "[IMAGEN_ENVIADA]", imageId });

          continue;
        }

        // ── Manejo de respuesta SÍ/NO a imagen ────────────────────────────
        if (msg.type === "text") {
          const histCheck = sesiones.get(sid) || [];
          const ultimoMsg = histCheck[histCheck.length - 1];
          if (ultimoMsg?.content === "[IMAGEN_ENVIADA]") {
            const respuesta = msg.text.body.trim().toUpperCase();
            const waHeaders = { Authorization: `Bearer ${META_PAGE_ACCESS_TOKEN}`, "Content-Type": "application/json" };
            const waUrl = `https://graph.facebook.com/v19.0/${WHATSAPP_PHONE_NUMBER_ID}/messages`;
            const ASESOR = "527352182512";

            if (respuesta.includes("SÍ") || respuesta.includes("SI") || respuesta.includes("S")) {
              // Es comprobante — notificar al asesor
              await axios.post(waUrl, {
                messaging_product: "whatsapp", to: from, type: "text",
                text: { body: "✅ ¡Comprobante recibido! Verificamos tu pago y confirmamos tu pedido en breve 🎉" }
              }, { headers: waHeaders });

              await axios.post(waUrl, {
                messaging_product: "whatsapp", to: ASESOR, type: "text",
                text: { body: `💳 *COMPROBANTE DE PAGO RECIBIDO* — MEXABOT\n\nCliente: wa.me/${from}\nRevisa el comprobante y confirma el pedido.` }
              }, { headers: waHeaders });

              // Limpiar imagen pendiente del historial
              histCheck.pop();
              console.log(`💳 Comprobante de ${from} notificado al asesor`);
            } else {
              await axios.post(waUrl, {
                messaging_product: "whatsapp", to: from, type: "text",
                text: { body: "Entendido 😊 ¿En qué te puedo ayudar?" }
              }, { headers: waHeaders });
              histCheck.pop();
            }
            continue;
          }
        }

        if (msg.type !== "text") continue;

        const texto = msg.text.body;
        console.log(`📨 WhatsApp de ${from}: ${texto}`);

        // Procesar con MEXABOT
        if (!sesiones.has(sid)) sesiones.set(sid, []);
        const hist = sesiones.get(sid);
        hist.push({ role: "user", content: texto });

        try {
          const aiResp = await axios.post(
            "https://api.anthropic.com/v1/messages",
            { model: "claude-sonnet-4-6", max_tokens: 1000, system: SYSTEM_PROMPT, messages: hist },
            { headers: { "x-api-key": ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01", "content-type": "application/json" } }
          );

          const reply = aiResp.data.content[0].text;
          hist.push({ role: "assistant", content: reply });
          if (hist.length > 100) sesiones.set(sid, hist.slice(-100));

          const BASE_URL = "https://mexarato-bot-production.up.railway.app";

          // Detectar fotos y catálogo
          const fotoMatch = reply.match(/\[FOTO:([\w-]+)\]/);
          const fotoProducto = fotoMatch ? fotoMatch[1] : null;
          const fotos = fotoProducto ? fotosDisponibles(fotoProducto) : [];
          const pedidoCatalogo = reply.includes("[CATALOGO]");
          const catalogoUrl = pedidoCatalogo ? catalogoDisponible() : null;

          const pedidoListo   = reply.includes("[PEDIDO_LISTO]");
          const escalarAsesor = reply.includes("[ESCALAR_ASESOR]");

          const limpio = reply
            .replace("[PEDIDO_LISTO]", "")
            .replace("[ESCALAR_ASESOR]", "")
            .replace(/\[FOTO:[\w-]+\]/g, "")
            .replace("[CATALOGO]", "")
            .trim();

          const waHeaders = {
            Authorization: `Bearer ${META_PAGE_ACCESS_TOKEN}`,
            "Content-Type": "application/json"
          };
          const waUrl = `https://graph.facebook.com/v19.0/${WHATSAPP_PHONE_NUMBER_ID}/messages`;
          const ASESOR = "527352182512";

          const enviarWA = (payload) => axios.post(waUrl, { messaging_product: "whatsapp", to: from, ...payload }, { headers: waHeaders });

          // Enviar texto
          await enviarWA({ type: "text", text: { body: limpio } });

          // Notificar al asesor si hay pedido listo
          if (pedidoListo) {
            // Extraer resumen de la conversación (últimos 10 mensajes)
            const histReciente = hist.slice(-10);
            const resumenConv = histReciente
              .filter(m => m.role === "user" || m.role === "assistant")
              .map(m => `${m.role === "user" ? "👤 Cliente" : "🤖 Bot"}: ${m.content.substring(0, 200)}`)
              .join("\n");

            const msgPedido = `🛒 *NUEVO PEDIDO LISTO* — MEXABOT\n\n📱 Cliente: wa.me/${from}\n\n📋 *Resumen de conversación:*\n${resumenConv}\n\n✅ Confirma el pedido y verifica el comprobante de pago.`;
            await axios.post(waUrl, { messaging_product: "whatsapp", to: ASESOR, type: "text", text: { body: msgPedido } }, { headers: waHeaders });
            console.log(`🛒 Notificación de pedido con resumen enviada al asesor`);
          }

          // Notificar al asesor si hay escalada
          if (escalarAsesor) {
            const msgEscalar = `⚠️ *CLIENTE NECESITA ASESOR* — MEXABOT\n\nCliente: wa.me/${from}\nEl cliente solicitó hablar con un asesor.`;
            await axios.post(waUrl, { messaging_product: "whatsapp", to: ASESOR, type: "text", text: { body: msgEscalar } }, { headers: waHeaders });
            console.log(`⚠️ Notificación de escalada enviada al asesor`);
          }

          // Enviar fotos (máx 5)
          if (fotos.length > 0) {
            const fotosEnviar = fotos.slice(0, 5);
            for (const foto of fotosEnviar) {
              await enviarWA({ type: "image", image: { link: `${BASE_URL}${foto}` } });
            }
            console.log(`📸 ${fotosEnviar.length} fotos enviadas a ${from}`);
          }

          // Enviar catálogo como documento
          if (catalogoUrl) {
            await enviarWA({ type: "document", document: { link: `${BASE_URL}${catalogoUrl}`, filename: "Catalogo_MEXARATO.pdf" } });
            console.log(`📄 Catálogo enviado a ${from}`);
          }

          console.log(`✅ Respuesta enviada a ${from}`);

        } catch (e) {
          console.error("❌ Error procesando mensaje WhatsApp:", e.response?.data || e.message);
        }
      }
    }
  }
});
// ─────────────────────────────────────────────────────────────────────────────

app.post("/chat", async (req, res) => {
  const { mensaje, sessionId, esNueva } = req.body;
  const sid = sessionId || "default";
  if(!sesiones.has(sid)) sesiones.set(sid,[]);
  const hist = sesiones.get(sid);

  const mensajeReal = esNueva
    ? "Saluda al cliente presentándote como MEXABOT."
    : mensaje;

  hist.push({ role:"user", content: mensajeReal });

  try {
    const response = await axios.post(
      "https://api.anthropic.com/v1/messages",
      { model:"claude-sonnet-4-6", max_tokens:1000, system:SYSTEM_PROMPT, messages:hist },
      { headers:{ "x-api-key":ANTHROPIC_API_KEY, "anthropic-version":"2023-06-01", "content-type":"application/json" } }
    );

    const reply = response.data.content[0].text;
    hist.push({ role:"assistant", content:reply });
    if(hist.length > 100) sesiones.set(sid, hist.slice(-100));

    const pedidoListo   = reply.includes("[PEDIDO_LISTO]");
    const escalarAsesor = reply.includes("[ESCALAR_ASESOR]");

    const fotoMatch = reply.match(/\[FOTO:([\w-]+)\]/);
    const fotoProducto = fotoMatch ? fotoMatch[1] : null;
    const fotos = fotoProducto ? fotosDisponibles(fotoProducto) : null;

    const pedidoCatalogo = reply.includes("[CATALOGO]");
    const catalogoUrl = pedidoCatalogo ? catalogoDisponible() : null;

    const limpio = reply
      .replace("[PEDIDO_LISTO]","")
      .replace("[ESCALAR_ASESOR]","")
      .replace(/\[FOTO:[\w-]+\]/g,"")
      .replace("[CATALOGO]","")
      .trim();

    res.json({ respuesta:limpio, pedidoListo, escalarAsesor, fotos, catalogoUrl });

  } catch(e) {
    const msg = e.response?.data?.error?.message || e.message;
    console.error("❌ Error Claude:", msg);
    res.status(500).json({ error:msg });
  }
});

app.post("/subir-comprobante", uploadComp.single("comprobante"), (req,res) => {
  if(!req.file) return res.status(400).json({ error:"No se recibió archivo" });
  console.log(`📎 Comprobante: ${req.file.filename}`);
  res.json({ ok:true, archivo:req.file.filename,
    mensaje:"✅ ¡Comprobante recibido! Verificamos tu pago y confirmamos tu pedido en breve 🎉" });
});

app.get("/fotos-disponibles", (req,res) => {
  const prods = ["churrito","churrito-kilo","cubito","cubito-kilo","barrita",
                 "oblea-abanico","oblea-60","oblea-30","choco-oblea"];
  const r = {};
  prods.forEach(p => r[p] = fotosDisponibles(p));
  r.catalogo = catalogoDisponible();
  res.json(r);
});

app.post("/reset", (req,res) => {
  sesiones.delete(req.body.sessionId || "default");
  res.json({ ok:true });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log("");
  console.log("🌮 MEXABOT v4 corriendo en http://localhost:" + PORT);
  console.log("");
  console.log("📁 Carpetas de fotos:");
  console.log("   productos/churrito/       → Churritos 50g");
  console.log("   productos/churrito-kilo/  → Churritos x kilo");
  console.log("   productos/cubito/         → Cubitos 50g");
  console.log("   productos/cubito-kilo/    → Cubitos x kilo");
  console.log("   productos/barrita/        → Barritas");
  console.log("   productos/oblea-abanico/  → Oblea Abanico 70g");
  console.log("   productos/oblea-60/       → Oblea 60g");
  console.log("   productos/oblea-30/       → Oblea 30g");
  console.log("   productos/choco-oblea/    → Choco Oblea");
  console.log("   catalogo/                 → Catálogo PDF");
  console.log("");
});
