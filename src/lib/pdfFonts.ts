import regularUrl from "@/assets/fonts/Montserrat-Regular.ttf?url";
import boldUrl from "@/assets/fonts/Montserrat-Bold.ttf?url";
import italicUrl from "@/assets/fonts/Montserrat-Italic.ttf?url";
import blackUrl from "@/assets/fonts/Montserrat-Black.ttf?url";
import type jsPDF from "jspdf";

let cache: Record<string, string> | null = null;

async function toB64(url: string): Promise<string> {
  const res = await fetch(url);
  const buf = await res.arrayBuffer();
  let bin = "";
  const bytes = new Uint8Array(buf);
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    bin += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + chunk)));
  }
  return btoa(bin);
}

async function loadAll() {
  if (cache) return cache;
  const [r, b, i, bl] = await Promise.all([
    toB64(regularUrl), toB64(boldUrl), toB64(italicUrl), toB64(blackUrl),
  ]);
  cache = { r, b, i, bl };
  return cache;
}

export async function registerMontserrat(doc: jsPDF) {
  const f = await loadAll();
  doc.addFileToVFS("Montserrat-Regular.ttf", f.r);
  doc.addFont("Montserrat-Regular.ttf", "Montserrat", "normal");
  doc.addFileToVFS("Montserrat-Bold.ttf", f.b);
  doc.addFont("Montserrat-Bold.ttf", "Montserrat", "bold");
  doc.addFileToVFS("Montserrat-Italic.ttf", f.i);
  doc.addFont("Montserrat-Italic.ttf", "Montserrat", "italic");
  doc.addFileToVFS("Montserrat-Black.ttf", f.bl);
  doc.addFont("Montserrat-Black.ttf", "Montserrat", "900");
  doc.setFont("Montserrat", "normal");
}
