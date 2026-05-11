/**
 * Resize an image file in the browser and return a JPEG data URL suitable for storing in `imageUrl`.
 * Keeps payload small for API / MongoDB.
 */
export async function fileToResizedJpegDataUrl(
  file: File,
  opts?: { maxEdge?: number; quality?: number; maxBytes?: number }
): Promise<string> {
  const maxEdge = opts?.maxEdge ?? 400;
  const quality = opts?.quality ?? 0.82;
  const maxBytes = opts?.maxBytes ?? 1_400_000;

  if (!file.type.startsWith("image/")) {
    throw new Error("INVALID_TYPE");
  }

  const bitmap = await createImageBitmap(file);
  try {
    const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height, 1));
    const w = Math.max(1, Math.round(bitmap.width * scale));
    const h = Math.max(1, Math.round(bitmap.height * scale));

    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("NO_CONTEXT");
    ctx.drawImage(bitmap, 0, 0, w, h);

    let q = quality;
    let dataUrl = canvas.toDataURL("image/jpeg", q);
    while (dataUrl.length > maxBytes && q > 0.45) {
      q -= 0.07;
      dataUrl = canvas.toDataURL("image/jpeg", q);
    }
    if (dataUrl.length > maxBytes) {
      throw new Error("TOO_LARGE");
    }
    return dataUrl;
  } finally {
    bitmap.close();
  }
}
