import * as pdfjsLib from "pdfjs-dist";
// @ts-ignore
import workerSrc from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import { supabase } from "@/integrations/supabase/client";

(pdfjsLib as any).GlobalWorkerOptions.workerSrc = workerSrc;

async function uploadBlob(userId: string, prefix: string, blob: Blob, ext: string): Promise<string> {
  const path = `${userId}/template-${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const { error } = await supabase.storage.from("project-images").upload(path, blob, { contentType: blob.type });
  if (error) throw error;
  return supabase.storage.from("project-images").getPublicUrl(path).data.publicUrl;
}

async function rasterizePdf(file: File, userId: string): Promise<string[]> {
  const buf = await file.arrayBuffer();
  const pdf = await (pdfjsLib as any).getDocument({ data: buf }).promise;
  const urls: string[] = [];
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const viewport = page.getViewport({ scale: 2 });
    const canvas = document.createElement("canvas");
    canvas.width = viewport.width; canvas.height = viewport.height;
    const ctx = canvas.getContext("2d")!;
    await page.render({ canvasContext: ctx, viewport, canvas }).promise;
    const blob: Blob = await new Promise((r) => canvas.toBlob(b => r(b!), "image/png", 0.92));
    urls.push(await uploadBlob(userId, `pdfpage-${i}`, blob, "png"));
  }
  return urls;
}

export async function uploadTemplateFiles(files: File[]): Promise<string[]> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not signed in");
  const urls: string[] = [];
  for (const f of files) {
    if (f.type === "application/pdf" || /\.pdf$/i.test(f.name)) {
      const pageUrls = await rasterizePdf(f, user.id);
      urls.push(...pageUrls);
    } else if (f.type.startsWith("image/")) {
      urls.push(await uploadBlob(user.id, "img", f, (f.name.split(".").pop() || "png").toLowerCase()));
    }
  }
  return urls;
}
