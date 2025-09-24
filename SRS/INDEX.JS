import makeWASocket, { useMultiFileAuthState, DisconnectReason, Browsers } from "@whiskeysockets/baileys";
import pino from "pino";
import qrcode from "qrcode-terminal";
import { handleIncomingMessage } from "./handlers/messageHandler.js";

const logger = pino({ level: "silent" });

async function start() {
  const { state, saveCreds } = await useMultiFileAuthState("auth");
  const sock = makeWASocket({
    logger,
    printQRInTerminal: false,
    generateHighQualityLinkPreview: true,
    browser: Browsers.macOS("Chrome"),
    auth: state
  });

  sock.ev.on("connection.update", (u) => {
    const { connection, lastDisconnect, qr } = u;
    if (qr) qrcode.generate(qr, { small: true });

    if (connection === "close") {
      const code = lastDisconnect?.error?.output?.statusCode;
      if (code !== DisconnectReason.loggedOut) start();
    } else if (connection === "open") {
      console.log("✅ Bot conectado a WhatsApp.");
    }
  });

  sock.ev.on("creds.update", saveCreds);

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
