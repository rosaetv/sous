// Achica una foto antes de guardarla: máximo 1000 px de ancho y JPEG al 80 %.
// Una foto del iPhone (unos 3-5 MB) queda en unos 100-200 KB.

const MAX_WIDTH = 1000;
const QUALITY = 0.8;

async function decode(file) {
  // createImageBitmap respeta la orientación de la foto (si estaba de lado, la endereza).
  if ("createImageBitmap" in window) {
    try {
      return await createImageBitmap(file, { imageOrientation: "from-image" });
    } catch {
      // algunos formatos no los acepta: probamos con <img>
    }
  }
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    return img;
  } finally {
    URL.revokeObjectURL(url);
  }
}

export async function resizeToJpeg(file, maxWidth = MAX_WIDTH, quality = QUALITY) {
  const source = await decode(file);
  const width = source.width || source.naturalWidth;
  const height = source.height || source.naturalHeight;
  const scale = Math.min(1, maxWidth / width);
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(width * scale);
  canvas.height = Math.round(height * scale);
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#fff"; // las fotos con transparencia quedan sobre blanco
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(source, 0, 0, canvas.width, canvas.height);
  source.close?.();
  return new Promise((resolve, reject) =>
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("No se pudo convertir la foto"))), "image/jpeg", quality),
  );
}
