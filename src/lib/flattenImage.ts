// Flatten an image file (especially transparent PNGs) onto a white background.
// Returns a JPEG Blob — eliminates fringing/pixel artifacts in previews & PDFs.
export async function flattenToWhite(file: File, opts: { maxDim?: number; quality?: number } = {}): Promise<{ blob: Blob; filename: string }> {
  const { maxDim = 1024, quality = 0.95 } = opts;
  // SVGs can stay as-is (vector, no artifacts)
  if (file.type === "image/svg+xml") return { blob: file, filename: file.name };

  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((res, rej) => {
      const i = new Image();
      i.onload = () => res(i);
      i.onerror = rej;
      i.src = url;
    });
    const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
    const w = Math.max(1, Math.round(img.width * scale));
    const h = Math.max(1, Math.round(img.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = w; canvas.height = h;
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, w, h);
    ctx.drawImage(img, 0, 0, w, h);
    const blob = await new Promise<Blob>((r) => canvas.toBlob((b) => r(b!), "image/jpeg", quality));
    const base = file.name.replace(/\.[^.]+$/, "");
    return { blob, filename: `${base}.jpg` };
  } finally {
    URL.revokeObjectURL(url);
  }
}
