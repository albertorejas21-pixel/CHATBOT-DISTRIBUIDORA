import { sendImages, sendPDF } from "../utils/sendFiles.js";

// Estados de conversación y recordatorios
const convoState = new Map();          // jid -> { step: 'start'|'waitingChoice'|'botiquines'|'mates' }
const followUpTimers = new Map();      // jid -> timeoutId (para el recordatorio de 60 min)

const normalize = (txt = "") =>
  txt.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();

function scheduleFollowUp(sock, jid, text) {
  // limpia anterior
  if (followUpTimers.has(jid)) {
    clearTimeout(followUpTimers.get(jid));
    followUpTimers.delete(jid);
  }
  // 60 minutos
  const id = setTimeout(async () => {
    try {
      await sock.sendMessage(jid, { text });
    } catch (e) {
      console.error("No se pudo enviar recordatorio:", e);
    } finally {
      followUpTimers.delete(jid);
    }
  }, 60 * 60 * 1000);
  followUpTimers.set(jid, id);
}

export async function handleIncomingMessage(sock, msg) {
  const jid = msg.key.remoteJid;
  const text =
    msg.message?.conversation ||
    msg.message?.extendedTextMessage?.text ||
    msg.message?.imageMessage?.caption ||
    msg.message?.videoMessage?.caption ||
    "";

  const t = normalize(text);

  // Mensaje inicial si no hay estado / saludo
  const isGreeting = /^(hola|buenas|buenos dias|buenas tardes|buenas noches|info|informacion|ayuda)/.test(
    t
  );

  if (!convoState.has(jid) || isGreeting) {
    convoState.set(jid, { step: "waitingChoice" });
    await sock.sendMessage(jid, {
      text:
        "Hola, gracias por comunicarte con la Distribuidora.\n¿Deseas recibir información sobre Mates o Botiquines?"
    });
    return;
  }

  // Si estamos esperando elección
  const state = convoState.get(jid);
  if (state.step === "waitingChoice") {
    if (t.includes("botiquin") || t.includes("botiquines")) {
      convoState.set(jid, { step: "botiquines" });

      // 1) Enviar 4 imágenes
      await sendImages(sock, jid, [
        "media/botiquines/img1.jpg",
        "media/botiquines/img2.jpg",
        "media/botiquines/img3.jpg",
        "media/botiquines/img4.jpg"
      ]);

      // 2) Pregunta de cierre
      await sock.sendMessage(jid, { text: "¿Deseas realizar tu pedido de botiquines?" });

      // 3) Recordatorio a los 60 min
      scheduleFollowUp(sock, jid, "¿Aún tienes interés en nuestros productos?");
      return;
    }

    if (t.includes("mate") || t.includes("mates")) {
      convoState.set(jid, { step: "mates" });

      // 1) Primer bloque (beneficios + categorías)
      await sock.sendMessage(jid, {
        text:
          "ENVÍO 100% GRATIS\n\nAbastece tu farmacia, tienda o despensa con más de 20 variedades de infusiones de mates:\n\n" +
          "Tranquilizantes\n• Tilo\n• Manzana\n• Flor de Jamaica\n\n" +
          "Adelgazantes\n• Jengibre\n• Té Verde\n• Toronja\n• Piña\n• Alpiste\n\n" +
          "Digestivos\n• Súper Mate\n• Tri Matin\n• Payqo\n• Anís\n• Manzanilla\n• Durazno\n\n" +
          "Medicinales\n• Matico (Refuerzo y defensas)\n• Alcachofa y Boldo (Hepático biliar)\n• Chanka Piedra (Hepático biliar)\n• 7 Frutas (Multimedicinal)\n• Alfalfa (Antianémico)\n• Linaza (Renal)\n• Stop Diabetes (Diabético)\n• Té Maternal (Maternidad)\n• Fortachón (Infantil)"
      });

      // 2) Precios y condiciones
      await sock.sendMessage(jid, {
        text:
          "Cada cajita contiene 20 sobrecitos de mate.\nEnvío gratuito a partir de 40 unidades.\n\n" +
          "Precios\n\nPara consumo\n• 1–6 cajitas → 20 Bs c/u\n• 7–11 cajitas → 15 Bs c/u\n\n" +
          "Para vender\n• 12–40 cajitas → 13 Bs c/u\n\n" +
          "Distribuidores nuevos\n• 41–120 cajitas → 12,50 Bs c/u\n\n" +
          "Distribuidores antiguos\n• 121–540 cajitas → 12 Bs c/u\n\n" +
          "Mayoristas\n• 541–1.000 cajitas → 11,80 Bs c/u"
      });

      // 3) PDF del catálogo
      await sendPDF(sock, jid, "media/mates/mates.pdf", "Te comparto el catálogo en PDF.");

      // 4) Pregunta de cierre
      await sock.sendMessage(jid, { text: "¿Deseas realizar tu pedido de mates?" });

      // 5) Recordatorio a los 60 min
      scheduleFollowUp(sock, jid, "¿Aún tienes interés en nuestros productos?");
      return;
    }

    // Si escribe otra cosa, repetimos la pregunta de elección
    await sock.sendMessage(jid, {
      text: "Por favor, indícame Mates o Botiquines para enviarte la info correcta."
    });
    return;
  }

  // Si llega cualquier respuesta posterior, cancelamos recordatorio pendiente
  if (followUpTimers.has(jid)) {
    clearTimeout(followUpTimers.get(jid));
    followUpTimers.delete(jid);
  }
}
