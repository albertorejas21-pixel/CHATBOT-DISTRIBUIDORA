import fs from "fs";

export async function sendImages(sock, jid, imagePaths = []) {
  for (const p of imagePaths) {
    if (!fs.existsSync(p)) {
      console.warn("⚠️ No se encontró imagen:", p);
      continue;
    }
    await sock.sendMessage(jid, {
      image: { url: p }
      // caption: "Catálogo Botiquines" // opcional
    });
  }
}

export async function sendPDF(sock, jid, pdfPath, caption = "") {
  if (!fs.existsSync(pdfPath)) {
    console.warn("⚠️ No se encontró PDF:", pdfPath);
    return;
  }
  await sock.sendMessage(jid, {
    document: { url: pdfPath },
    fileName: pdfPath.split("/").pop(),
    mimetype: "application/pdf",
    caption
  });
}
