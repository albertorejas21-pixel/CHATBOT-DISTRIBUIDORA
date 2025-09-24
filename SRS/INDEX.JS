import makeWASocket, {
  useMultiFileAuthState,
  DisconnectReason,
  Browsers
} from "@whiskeysockets/baileys";
import pino from "pino";
import qrcode from "qrcode-terminal";
import { handleIncomingMessage } from "./handlers/messageHandler.js";

// ---------- Logger silencioso
const logger = pino({ level: "silent" });

// ---------- Arranque del bot
async function start() {
  const { state, saveCreds } = await useMultiFileAuthState("auth");

  const sock = makeWASocket({
    logger,
    printQRInTerminal: false,       // el QR lo imprimimos nosotros
    generateHighQualityLinkPreview: true,
    browser: Browsers.macOS("Chrome"),
    auth: state
  });

  // Conexión / QR
  sock.ev.on("connection.update", (u) => {
    const { connection, lastDisconnect, qr } = u;

    if (qr) {
      console.log("\nEscanea este QR para vincular WhatsApp:\n");
      qrcode.generate(qr, { small: true });
      console.log("\nSi no aparece, redeploy o reinicia el Repl.\n");
    }

    if (connection === "close") {
      const code = lastDisconnect?.error?.output?.statusCode;
      if (code !== DisconnectReason.loggedOut) {
        console.log("Reconectando...");
        start();
      } else {
        console.log("Sesión cerrada. Borra la carpeta auth/ y vuelve a vincular.");
      }
    } else if (connection === "open") {
      console.log("✅ Bot conectado a WhatsApp.");
    }
  });

  // Guardar credenciales
  sock.ev.on("creds.update", saveCreds);

  // Mensajes entrantes
  sock.ev.on("messages.upsert", async ({ type, messages }) => {
    if (type !== "notify") return;
    for (const m of messages) {
      if (!m.message || m.key.fromMe) continue;
      try {
        await handleIncomingMessage(sock, m);
      } catch (err) {
        console.error("Error manejando mensaje:", err);
      }
    }
  });
}

start();

// ---------- Mini servidor HTTP (keep-alive para Replit/UptimeRobot)
import http from "http";
const PORT = process.env.PORT || 3000;
http
  .createServer((_, res) => {
    res.writeHead(200, { "Content-Type": "text/plain" });
    res.end("OK");
  })
  .listen(PORT, () => console.log("Health server ON :" + PORT));
