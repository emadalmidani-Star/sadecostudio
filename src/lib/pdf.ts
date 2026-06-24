import jsPDF from "jspdf";
import { registerMontserrat } from "./pdfFonts";
import { supabase } from "@/integrations/supabase/client";
import { renderTemplatePage, type Template } from "./templateRender";

type Templates = Partial<Record<Template["page_type"], Template>>;
export type ExportKind = "profile" | "project" | "portfolio";

async function loadTemplates(kind: ExportKind): Promise<Templates> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return {};
  const { data: assign } = await supabase.from("export_template_assignments")
    .select("set_id").eq("user_id", user.id).eq("export_kind", kind).maybeSingle();
  if (!assign?.set_id) return {};
  const { data } = await supabase.from("pdf_templates").select("*").eq("set_id", assign.set_id);
  const out: Templates = {};
  (data || []).forEach((r: any) => {
    out[r.page_type as Template["page_type"]] = {
      page_type: r.page_type, background_url: r.background_url, slots: r.slots || [],
    };
  });
  return out;
}

// Brand: pure black & white from SADECO logo
const BRAND = { ink: "#000000", paper: "#ffffff", muted: "#666666", line: "#000000" };
const BULLET = "-";

export type CompressOpts = { maxDim: number; quality: number };
let CURRENT_COMPRESS: CompressOpts = { maxDim: 1600, quality: 0.82 };
export function setPdfCompression(opts: CompressOpts) { CURRENT_COMPRESS = opts; }

export type GalleryColumns = 2 | 3;
let GALLERY_COLS: GalleryColumns = 3;
export function setGalleryColumns(cols: GalleryColumns) { GALLERY_COLS = cols; }

async function loadImg(url: string, opts: CompressOpts = CURRENT_COMPRESS): Promise<{ data: string; w: number; h: number } | null> {
  try {
    const res = await fetch(url, { mode: "cors" });
    const blob = await res.blob();
    const rawData = await new Promise<string>((r) => { const fr = new FileReader(); fr.onload = () => r(fr.result as string); fr.readAsDataURL(blob); });
    const img = await new Promise<HTMLImageElement | null>((r) => {
      const i = new Image(); i.onload = () => r(i); i.onerror = () => r(null); i.src = rawData;
    });
    if (!img) return { data: rawData, w: 1, h: 1 };
    const { maxDim, quality } = opts;
    const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
    const w = Math.max(1, Math.round(img.width * scale));
    const h = Math.max(1, Math.round(img.height * scale));
    // Skip recompression for tiny logos (PNGs we want crisp)
    if (scale === 1 && blob.size < 120 * 1024) return { data: rawData, w: img.width, h: img.height };
    const canvas = document.createElement("canvas");
    canvas.width = w; canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return { data: rawData, w: img.width, h: img.height };
    ctx.fillStyle = "#ffffff"; ctx.fillRect(0, 0, w, h);
    ctx.drawImage(img, 0, 0, w, h);
    const data = canvas.toDataURL("image/jpeg", quality);
    return { data, w, h };
  } catch { return null; }
}

// Parse SVG dimensions (viewBox or width/height) from raw SVG markup.
function parseSvgSize(svgText: string): { w: number; h: number } {
  try {
    const doc = new DOMParser().parseFromString(svgText, "image/svg+xml");
    const svg = doc.documentElement;
    const vb = svg.getAttribute("viewBox");
    if (vb) {
      const parts = vb.split(/[\s,]+/).map(Number);
      if (parts.length === 4 && parts[2] > 0 && parts[3] > 0) return { w: parts[2], h: parts[3] };
    }
    const w = parseFloat(svg.getAttribute("width") || "");
    const h = parseFloat(svg.getAttribute("height") || "");
    if (w > 0 && h > 0) return { w, h };
  } catch {}
  return { w: 300, h: 150 };
}

// Rasterize an SVG (from raw text) onto a canvas at high resolution.
async function rasterizeSvg(svgText: string, targetMax: number, fillWhite: boolean): Promise<{ data: string; w: number; h: number } | null> {
  const { w: svgW, h: svgH } = parseSvgSize(svgText);
  const scale = targetMax / Math.max(svgW, svgH);
  const w = Math.max(1, Math.round(svgW * scale));
  const h = Math.max(1, Math.round(svgH * scale));
  const blob = new Blob([svgText], { type: "image/svg+xml;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  try {
    const img = await new Promise<HTMLImageElement | null>((r) => {
      const i = new Image();
      i.onload = () => r(i); i.onerror = () => r(null);
      i.src = url;
    });
    if (!img) return null;
    const canvas = document.createElement("canvas");
    canvas.width = w; canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    if (fillWhite) { ctx.fillStyle = "#ffffff"; ctx.fillRect(0, 0, w, h); }
    ctx.drawImage(img, 0, 0, w, h);
    const data = fillWhite ? canvas.toDataURL("image/jpeg", 0.95) : canvas.toDataURL("image/png");
    return { data, w, h };
  } finally { URL.revokeObjectURL(url); }
}

function isSvg(url: string, contentType: string, blobText?: string): boolean {
  if (contentType.includes("svg")) return true;
  if (/\.svg(\?|#|$)/i.test(url)) return true;
  if (blobText && /^\s*<\?xml|^\s*<svg/i.test(blobText)) return true;
  return false;
}

// Load a logo while preserving transparency (PNG output, no white fill).
// Rasterize *every* format (incl. WebP) through canvas so jsPDF gets a clean PNG with alpha.
async function loadLogoTransparent(url: string): Promise<{ data: string; w: number; h: number } | null> {
  try {
    const res = await fetch(url, { mode: "cors" });
    const blob = await res.blob();
    const ct = blob.type || "";
    if (isSvg(url, ct)) {
      const text = await blob.text();
      const out = await rasterizeSvg(text, 1600, false);
      if (out) return out;
    }
    const rawData = await new Promise<string>((r) => { const fr = new FileReader(); fr.onload = () => r(fr.result as string); fr.readAsDataURL(blob); });
    const img = await new Promise<HTMLImageElement | null>((r) => {
      const i = new Image(); i.onload = () => r(i); i.onerror = () => r(null); i.src = rawData;
    });
    if (!img) return null;
    const maxDim = 1200;
    const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
    const w = Math.max(1, Math.round(img.width * scale));
    const h = Math.max(1, Math.round(img.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = w; canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return { data: rawData, w: img.width, h: img.height };
    ctx.clearRect(0, 0, w, h);
    ctx.drawImage(img, 0, 0, w, h);
    return { data: canvas.toDataURL("image/png"), w, h };
  } catch { return null; }
}

// Always flatten logos onto white to avoid transparent-PNG fringing in PDFs.
async function loadLogo(url: string): Promise<{ data: string; w: number; h: number } | null> {
  try {
    const res = await fetch(url, { mode: "cors" });
    const blob = await res.blob();
    const ct = blob.type || "";
    if (isSvg(url, ct)) {
      const text = await blob.text();
      const out = await rasterizeSvg(text, 1600, true);
      if (out) return out;
    }
    const rawData = await new Promise<string>((r) => { const fr = new FileReader(); fr.onload = () => r(fr.result as string); fr.readAsDataURL(blob); });
    const img = await new Promise<HTMLImageElement | null>((r) => {
      const i = new Image(); i.onload = () => r(i); i.onerror = () => r(null); i.src = rawData;
    });
    if (!img) return null;
    const maxDim = 600;
    const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
    const w = Math.max(1, Math.round(img.width * scale));
    const h = Math.max(1, Math.round(img.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = w; canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return { data: rawData, w: img.width, h: img.height };
    ctx.fillStyle = "#ffffff"; ctx.fillRect(0, 0, w, h);
    ctx.drawImage(img, 0, 0, w, h);
    return { data: canvas.toDataURL("image/jpeg", 0.95), w, h };
  } catch { return null; }
}

function fmt(s?: string | null) { return s ? s.charAt(0).toUpperCase() + s.slice(1) : ""; }

async function newDoc() {
  // Landscape A4 with built-in PDF stream compression
  const doc = new jsPDF({ unit: "mm", format: "a4", orientation: "landscape", compress: true });
  await registerMontserrat(doc);
  return doc;
}

// "About Us" cover page, optionally prepended to portfolio / selected-projects exports.
import type { AboutPageData } from "./aboutPage";

// Recolor a transparent logo so every opaque pixel becomes solid black —
// used on the light "About Us" page where the original gold/white logo would vanish.
async function tintLogoBlack(logo: { data: string; w: number; h: number } | null): Promise<{ data: string; w: number; h: number } | null> {
  if (!logo) return null;
  try {
    const img = await new Promise<HTMLImageElement | null>((r) => {
      const i = new Image(); i.onload = () => r(i); i.onerror = () => r(null); i.src = logo.data;
    });
    if (!img) return logo;
    const cnv = document.createElement("canvas");
    cnv.width = img.width; cnv.height = img.height;
    const ctx = cnv.getContext("2d");
    if (!ctx) return logo;
    ctx.drawImage(img, 0, 0);
    ctx.globalCompositeOperation = "source-in";
    ctx.fillStyle = "#000000";
    ctx.fillRect(0, 0, img.width, img.height);
    return { data: cnv.toDataURL("image/png"), w: img.width, h: img.height };
  } catch { return logo; }
}

// Build a brand-coloured circular icon for a social/contact kind and rasterise to PNG.
type SocialKind = "linkedin" | "instagram" | "facebook" | "youtube" | "email" | "phone" | "whatsapp" | "website";
const SOCIAL_BG: Record<SocialKind, string> = {
  linkedin: "#0A66C2", instagram: "#E1306C", facebook: "#1877F2", youtube: "#FF0000",
  email: "#4B5563", phone: "#10B981", whatsapp: "#25D366", website: "#6366F1",
};
const SOCIAL_GLYPH: Record<SocialKind, string> = {
  linkedin: '<path fill="#fff" d="M20.5 20.5h-3.6v-5.6c0-1.3-.5-2.2-1.7-2.2-1 0-1.5.6-1.7 1.3-.1.2-.1.6-.1.9v5.6H9.8s.1-9.1 0-10h3.6v1.4c.5-.7 1.3-1.7 3.2-1.7 2.3 0 4 1.5 4 4.8v5.5zM5.9 8.6c-1.2 0-2-.8-2-1.8s.8-1.8 2-1.8 2 .8 2 1.8-.8 1.8-2 1.8zm1.8 11.9H4.1v-10h3.6v10z"/>',
  instagram: '<path fill="#fff" d="M8 3h8a5 5 0 0 1 5 5v8a5 5 0 0 1-5 5H8a5 5 0 0 1-5-5V8a5 5 0 0 1 5-5zm0 2a3 3 0 0 0-3 3v8a3 3 0 0 0 3 3h8a3 3 0 0 0 3-3V8a3 3 0 0 0-3-3H8zm9 1.5a1 1 0 1 1 0 2 1 1 0 0 1 0-2zM12 7a5 5 0 1 1 0 10 5 5 0 0 1 0-10zm0 2a3 3 0 1 0 0 6 3 3 0 0 0 0-6z"/>',
  facebook: '<path fill="#fff" d="M13.5 21v-7.5h2.5l.4-3h-2.9V8.6c0-.9.3-1.5 1.5-1.5h1.6V4.4c-.3 0-1.2-.1-2.3-.1-2.3 0-3.8 1.4-3.8 3.9v2.3H8v3h2.5V21h3z"/>',
  youtube: '<path fill="#fff" d="M21.6 8.2c-.2-1-.9-1.7-1.9-2C18 6 12 6 12 6s-6 0-7.7.2c-1 .3-1.7 1-1.9 2C2.2 9.9 2.2 12 2.2 12s0 2.1.2 3.8c.2 1 .9 1.7 1.9 2 1.7.2 7.7.2 7.7.2s6 0 7.7-.2c1-.3 1.7-1 1.9-2 .2-1.7.2-3.8.2-3.8s0-2.1-.2-3.8zM10 15.3V8.7l5.2 3.3-5.2 3.3z"/>',
  email: '<path fill="#fff" d="M4 6h16a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1zm1 2.3v8.7h14V8.3l-7 4.5-7-4.5zm.7-.3L12 12l6.3-4H5.7z"/>',
  phone: '<path fill="#fff" d="M6.6 10.8a15.5 15.5 0 0 0 6.6 6.6l2.2-2.2c.3-.3.7-.4 1-.2 1.1.4 2.3.6 3.6.6.6 0 1 .4 1 1V20c0 .6-.4 1-1 1A17 17 0 0 1 3 4c0-.6.4-1 1-1h3.4c.6 0 1 .4 1 1 0 1.2.2 2.4.6 3.5.1.4 0 .8-.2 1.1l-2.2 2.2z"/>',
  whatsapp: '<path fill="#fff" d="M12 3a9 9 0 0 0-7.7 13.7L3 21l4.4-1.2A9 9 0 1 0 12 3zm5.2 12.7c-.2.6-1.3 1.2-1.8 1.2-.5.1-1.1.1-1.8-.1a10 10 0 0 1-5.4-4.7c-.4-.7-.7-1.5-.7-2.3 0-.8.4-1.2.6-1.4.2-.2.4-.2.5-.2h.4c.1 0 .3 0 .5.4.2.5.7 1.6.7 1.7.1.1.1.3 0 .4 0 .1-.1.2-.2.4l-.3.4c-.1.1-.2.2-.1.4.2.4.7 1.1 1.4 1.7.9.8 1.6 1 1.9 1.2.2.1.4.1.5-.1l.7-.8c.1-.2.3-.2.5-.1.2.1 1.3.6 1.5.7.2.1.4.2.4.3.1.1.1.5-.1 1z"/>',
  website: '<path fill="#fff" d="M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zm0 2c1.1 0 2.4 1.3 3 3.5H9c.6-2.2 1.9-3.5 3-3.5zM5.1 11h2.7c-.1.7-.1 1.3 0 2H5.1a7 7 0 0 1 0-2zm1 4h2c.4 1.4 1 2.6 1.6 3.5A7 7 0 0 1 6.1 15zm5.9 4c-1.1 0-2.4-1.3-3-3.5h6c-.6 2.2-1.9 3.5-3 3.5zm-3.4-5.5a13 13 0 0 1 0-3h6.8a13 13 0 0 1 0 3H8.6zM18 15a7 7 0 0 1-3.6 3.5c.6-.9 1.2-2.1 1.6-3.5H18zm1-2h-2.8c.1-.7.1-1.3 0-2H19a7 7 0 0 1 0 2zm-1-4h-1.4c-.4-1.4-1-2.6-1.6-3.5A7 7 0 0 1 18 9zM9.4 5.5c-.6.9-1.2 2.1-1.6 3.5H6a7 7 0 0 1 3.4-3.5z"/>',
};

async function socialBadgePng(kind: SocialKind): Promise<{ data: string; w: number; h: number } | null> {
  const bg = SOCIAL_BG[kind];
  const glyph = SOCIAL_GLYPH[kind];
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="64" height="64"><circle cx="12" cy="12" r="12" fill="${bg}"/>${glyph}</svg>`;
  return rasterizeSvg(svg, 128, false);
}

type SocialItem = { kind: SocialKind; url?: string };
async function drawSocialRow(doc: jsPDF, items: SocialItem[], cx: number, y: number, size = 7, gap = 4) {
  if (!items.length) return;
  const totalW = items.length * size + (items.length - 1) * gap;
  let x = cx - totalW / 2;
  for (const it of items) {
    const png = await socialBadgePng(it.kind);
    if (png) {
      doc.addImage(png.data, "PNG", x, y, size, size);
      if (it.url) doc.link(x, y, size, size, { url: it.url });
    }
    x += size + gap;
  }
}

export async function addAboutCover(doc: jsPDF, company: any, logo: any, data: AboutPageData, isFirstPage: boolean) {
  if (!isFirstPage) doc.addPage();
  const W = doc.internal.pageSize.getWidth(), H = doc.internal.pageSize.getHeight();
  const accent = data.accent || "#c9a84c";

  // Paper
  doc.setFillColor(BRAND.paper); doc.rect(0, 0, W, H, "F");

  // Left vertical accent band
  doc.setFillColor(accent); doc.rect(0, 0, 8, H, "F");

  // Two-column layout: text on the left half, services on the right half.
  const LEFT_X = 24;
  const LEFT_W = W / 2 - 32;          // safe width for the left text column
  const RIGHT_X = W / 2 + 12;
  const RIGHT_W = W / 2 - 36;

  // Top label
  doc.setTextColor(accent); doc.setFont("Montserrat", "bold"); doc.setFontSize(9);
  doc.text("ABOUT US", LEFT_X, 28, { charSpace: 4 });

  // Headline
  doc.setTextColor(BRAND.ink); doc.setFont("Montserrat", "bold"); doc.setFontSize(32);
  const headLines = doc.splitTextToSize(data.headline || (company?.name || "About Us"), LEFT_W);
  let y = 44;
  headLines.forEach((ln: string) => { doc.text(ln, LEFT_X, y); y += 11; });

  // Tagline
  if (data.tagline) {
    y += 2;
    doc.setFont("Montserrat", "normal"); doc.setFontSize(12); doc.setTextColor(BRAND.muted);
    const taglineLines = doc.splitTextToSize(data.tagline, LEFT_W);
    taglineLines.forEach((ln: string) => { doc.text(ln, LEFT_X, y); y += 6.5; });
  }

  // Accent rule
  y += 4;
  doc.setDrawColor(accent); doc.setLineWidth(0.8); doc.line(LEFT_X, y, LEFT_X + 36, y);
  y += 10;

  // Intro paragraph (constrained to left column)
  if (data.intro) {
    doc.setFont("Montserrat", "normal"); doc.setFontSize(11); doc.setTextColor(BRAND.ink);
    const lines = doc.splitTextToSize(data.intro, LEFT_W);
    const maxLines = Math.min(lines.length, 14);
    for (let i = 0; i < maxLines; i++) { doc.text(lines[i], LEFT_X, y); y += 6; }
  }

  // Services list (right column, aligned with headline baseline)
  if (data.services?.length) {
    let sy = 44;
    doc.setFont("Montserrat", "bold"); doc.setFontSize(9); doc.setTextColor(accent);
    doc.text("WHAT WE DO", RIGHT_X, sy, { charSpace: 4 }); sy += 10;
    doc.setFont("Montserrat", "normal"); doc.setFontSize(12); doc.setTextColor(BRAND.ink);
    data.services.slice(0, 8).forEach(s => {
      const lines = doc.splitTextToSize(s, RIGHT_W - 8);
      doc.text("—", RIGHT_X, sy);
      doc.text(lines, RIGHT_X + 6, sy);
      sy += lines.length * 6.5 + 2;
    });
  }

  // Stats row (bottom)
  if (data.stats?.length) {
    const startY = H - 50;
    const colW = (W - 48) / Math.min(data.stats.length, 4);
    data.stats.slice(0, 4).forEach((s, i) => {
      const x = LEFT_X + i * colW;
      doc.setFont("Montserrat", "bold"); doc.setFontSize(26); doc.setTextColor(accent);
      doc.text(s.value || "", x, startY);
      doc.setFont("Montserrat", "normal"); doc.setFontSize(9); doc.setTextColor(BRAND.muted);
      doc.text((s.label || "").toUpperCase(), x, startY + 6, { charSpace: 2 });
    });
  }

  // Contact footer
  const footerY = H - 22;
  doc.setDrawColor(BRAND.line); doc.setLineWidth(0.2); doc.line(LEFT_X, footerY - 6, W - 24, footerY - 6);
  doc.setFont("Montserrat", "normal"); doc.setFontSize(9); doc.setTextColor(BRAND.muted);
  const contactBits: string[] = [];
  if (data.contactPhone) contactBits.push(data.contactPhone);
  if (data.contactEmail) contactBits.push(data.contactEmail);
  if (data.contactWebsite) contactBits.push(data.contactWebsite);
  if (data.contactAddress) contactBits.push(data.contactAddress);
  if (contactBits.length) doc.text(contactBits.join("   ·   "), LEFT_X, footerY);

  // Logo (top-right) — recoloured solid black so it's visible on the light paper
  const blackLogo = await tintLogoBlack(logo);
  if (blackLogo) {
    const ratio = blackLogo.w / blackLogo.h;
    const lw = 32; const lh = lw / ratio;
    doc.addImage(blackLogo.data, "PNG", W - 24 - lw, 18, lw, lh);
  }
}

async function addCover(doc: jsPDF, company: any, subtitle: string, logo: any, tpl?: Template, project?: any) {
  if (tpl) { await renderTemplatePage(doc, tpl, { company, subtitle, project }); return; }
  const W = doc.internal.pageSize.getWidth(), H = doc.internal.pageSize.getHeight();
  doc.setFillColor(BRAND.paper); doc.rect(0, 0, W, H, "F");
  // black band on the left
  doc.setFillColor(BRAND.ink); doc.rect(0, 0, W * 0.38, H, "F");
  if (logo) {
    const ratio = logo.w / logo.h;
    const w = 70; const h = w / ratio;
    const x = (W * 0.38 - w) / 2;
    const y = H / 2 - h / 2;
    doc.addImage(logo.data, "PNG", x, y, w, h);
  }
  // right side
  doc.setTextColor(BRAND.ink); doc.setFont("Montserrat", "bold"); doc.setFontSize(48);
  doc.text(company?.name || "SADECO", W * 0.42, H / 2 - 6);
  // accent rule
  doc.setDrawColor(BRAND.ink); doc.setLineWidth(0.6); doc.line(W * 0.42, H / 2 + 6, W * 0.42 + 30, H / 2 + 6);

  // Subtitle / context line
  doc.setFont("Montserrat", "normal"); doc.setFontSize(11); doc.setTextColor(BRAND.muted);
  doc.text(subtitle, W * 0.42, H / 2 + 16);

  // When the cover is for a single project, surface its key facts inline
  if (project) {
    const facts: [string, string][] = [
      ["PROJECT", project.name || "-"],
      ["LOCATION", project.location || "-"],
      ["TYPE", fmt(project.type) || "-"],
      ["CLIENT", project.client_name || "Confidential"],
      ["AREA", project.area_sqm ? `${project.area_sqm} sqm` : "-"],
      ["STATUS", fmt(project.status) || "-"],
    ];
    const startY = H - 55;
    const colW = (W - W * 0.42 - 15) / 3;
    facts.forEach((f, i) => {
      const col = i % 3, row = Math.floor(i / 3);
      const x = W * 0.42 + col * colW;
      const y = startY + row * 16;
      doc.setFont("Montserrat", "normal"); doc.setFontSize(7); doc.setTextColor(BRAND.muted);
      doc.text(f[0], x, y, { charSpace: 1.5 });
      doc.setFont("Montserrat", "bold"); doc.setFontSize(10); doc.setTextColor(BRAND.ink);
      const lines = doc.splitTextToSize(f[1], colW - 4);
      doc.text(lines.slice(0, 2), x, y + 5);
    });
  }
}

function addPageHeader(doc: jsPDF, company: any) {
  const W = doc.internal.pageSize.getWidth();
  doc.setTextColor(BRAND.ink); doc.setFontSize(9); doc.setFont("Montserrat", "bold");
  doc.text((company?.name || "SADECO").toUpperCase(), 15, 12, { charSpace: 2 });
  doc.setDrawColor(BRAND.ink); doc.setLineWidth(0.4); doc.line(15, 15, W - 15, 15);
}

function addPageFooter(doc: jsPDF, company: any, page: number) {
  const W = doc.internal.pageSize.getWidth(), H = doc.internal.pageSize.getHeight();
  doc.setDrawColor(BRAND.ink); doc.setLineWidth(0.2); doc.line(15, H - 12, W - 15, H - 12);
  doc.setFontSize(8); doc.setTextColor(BRAND.muted); doc.setFont("Montserrat", "normal");
  doc.text(company?.website || company?.email || "", 15, H - 7);
  doc.text(String(page), W - 15, H - 7, { align: "right" });
}

// Vertical layout constants — keep all sections aligned across pages.
// Header rule sits at y=15. Section title baseline at y+4, underline at y+7.
// First content row always starts CONTENT_GAP mm below the underline.
const CONTENT_GAP = 13;            // gap from underline to first content row
const SECTION_TOP = 28;            // top y where every section title begins
const SAFE_BOTTOM = 20;            // keep this much clearance above the footer

function sectionTitle(doc: jsPDF, _label: string, title: string, y: number) {
  const W = doc.internal.pageSize.getWidth();
  const maxW = W - 30; // 15mm side margins
  doc.setFont("Montserrat", "bold"); doc.setTextColor(BRAND.ink);

  // Auto-shrink font (26 → 16) so long titles fit on a single line.
  let size = 26;
  doc.setFontSize(size);
  while (size > 16 && doc.getTextWidth(title) > maxW) {
    size -= 1; doc.setFontSize(size);
  }

  // If still too wide at the minimum size, wrap to a second line.
  let lines = [title];
  if (doc.getTextWidth(title) > maxW) {
    lines = doc.splitTextToSize(title, maxW).slice(0, 2);
  }

  // Render. Reserve a constant block height (two-line slot) so the underline
  // and the first content row stay at identical positions on every page,
  // regardless of how long the heading is.
  const lineH = size * 0.45; // mm per line at this font size
  lines.forEach((ln, i) => doc.text(ln, 15, y + 4 + i * lineH));
  const underlineY = y + 7 + (lines.length - 1) * lineH;
  doc.setDrawColor(BRAND.ink); doc.setLineWidth(0.4); doc.line(15, underlineY, 50, underlineY);
  return underlineY + CONTENT_GAP;
}

// Draw text centered inside a box, shrinking the font until it fits.
function fitCenteredText(doc: jsPDF, text: string, cx: number, cy: number, maxW: number, startSize = 13, minSize = 7) {
  let size = startSize;
  doc.setFontSize(size);
  while (size > minSize && doc.getTextWidth(text) > maxW) {
    size -= 1; doc.setFontSize(size);
  }
  // If still too wide, wrap to up to 2 lines.
  if (doc.getTextWidth(text) > maxW) {
    const lines = doc.splitTextToSize(text, maxW).slice(0, 2);
    const lineH = size * 0.42;
    const startY = cy - ((lines.length - 1) * lineH) / 2 + 1.5;
    lines.forEach((ln: string, i: number) => doc.text(ln, cx, startY + i * lineH, { align: "center" }));
  } else {
    doc.text(text, cx, cy + 1.5, { align: "center" });
  }
}



export type CompanyFooterFields = { phone?: boolean; email?: boolean; website?: boolean; address?: boolean };
async function addThankYou(doc: jsPDF, company: any, logo: any, tpl?: Template, contact?: any, companyFields?: CompanyFooterFields) {
  doc.addPage();
  if (tpl) { await renderTemplatePage(doc, tpl, { company, contact, member: contact }); return; }
  const W = doc.internal.pageSize.getWidth(), H = doc.internal.pageSize.getHeight();
  doc.setFillColor(BRAND.ink); doc.rect(0, 0, W, H, "F");

  // Preload contact avatar (circular crop on white) so we can place it above the name.
  let avatar: { data: string; w: number; h: number } | null = null;
  if (contact?.avatar_url) {
    try {
      const raw = await loadImg(contact.avatar_url, { maxDim: 400, quality: 0.92 });
      if (raw) {
        const size = 256;
        const cnv = document.createElement("canvas");
        cnv.width = size; cnv.height = size;
        const ctx = cnv.getContext("2d");
        if (ctx) {
          const img = await new Promise<HTMLImageElement | null>((r) => { const i = new Image(); i.onload = () => r(i); i.onerror = () => r(null); i.src = raw.data; });
          if (img) {
            ctx.save();
            ctx.beginPath();
            ctx.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2);
            ctx.closePath();
            ctx.clip();
            // cover-fit
            const ar = img.width / img.height;
            let dw = size, dh = size, dx = 0, dy = 0;
            if (ar > 1) { dw = size * ar; dx = -(dw - size) / 2; }
            else { dh = size / ar; dy = -(dh - size) / 2; }
            ctx.drawImage(img, dx, dy, dw, dh);
            ctx.restore();
            avatar = { data: cnv.toDataURL("image/png"), w: size, h: size };
          }
        }
      }
    } catch {}
  }

  // Vertically centered Thank You + brand tagline (shifted slightly up if avatar present)
  const yOffset = avatar ? -18 : 0;
  doc.setTextColor(BRAND.paper); doc.setFont("Montserrat", "bold"); doc.setFontSize(72);
  doc.text("Thank You", W / 2, H / 2 - 6 + yOffset, { align: "center" });

  doc.setDrawColor(BRAND.paper); doc.setLineWidth(0.4);
  doc.line(W / 2 - 22, H / 2 + 2 + yOffset, W / 2 + 22, H / 2 + 2 + yOffset);

  // Center company name manually (jsPDF's align:center does NOT account for charSpace,
  // which made "SADECO DECOR LLC" appear visually shifted off-center).
  doc.setFont("Montserrat", "bold"); doc.setFontSize(13); doc.setTextColor(BRAND.paper);
  const brandText = (company?.name || "SADECO Decor").toUpperCase();
  const brandCharSpace = 3;
  const brandWidth = doc.getTextWidth(brandText) + brandCharSpace * Math.max(0, brandText.length - 1);
  doc.text(brandText, W / 2 - brandWidth / 2, H / 2 + 14 + yOffset, { charSpace: brandCharSpace });

  if (company?.tagline || true) {
    doc.setFont("Montserrat", "normal"); doc.setFontSize(12); doc.setTextColor("#cccccc");
    doc.text(company?.tagline || "Bridging your ideas into real spaces.", W / 2, H / 2 + 24 + yOffset, { align: "center" });
  }

  // Selected contact card — avatar + name + title + their phone/email.
  if (contact && (contact.full_name || contact.email)) {
    const baseY = H / 2 + 32 + yOffset;
    if (avatar) {
      const av = 22; // mm
      doc.addImage(avatar.data, "PNG", W / 2 - av / 2, baseY, av, av);
    }
    const textY = baseY + (avatar ? 28 : 6);
    const name = contact.full_name || contact.email;
    const role = contact.job_title || "";
    doc.setFont("Montserrat", "bold"); doc.setFontSize(11); doc.setTextColor(BRAND.paper);
    doc.text(name, W / 2, textY, { align: "center" });
    if (role) {
      doc.setFont("Montserrat", "normal"); doc.setFontSize(9); doc.setTextColor("#bbbbbb");
      doc.text(role, W / 2, textY + 6, { align: "center" });
    }
    // Render contact line with clickable links (tel:, mailto:, wa.me, social)
    const items: Array<{ text: string; url: string }> = [];
    if (contact.phone) items.push({ text: contact.phone, url: `tel:${String(contact.phone).replace(/[^\d+]/g, "")}` });
    if (contact.email) items.push({ text: contact.email, url: `mailto:${contact.email}` });
    if (contact.whatsapp) items.push({ text: `WhatsApp: ${contact.whatsapp}`, url: `https://wa.me/${String(contact.whatsapp).replace(/\D/g, "")}` });
    if (company?.linkedin_url) items.push({ text: "LinkedIn", url: company.linkedin_url });
    if (company?.instagram_url) items.push({ text: "Instagram", url: company.instagram_url });
    if (company?.facebook_url) items.push({ text: "Facebook", url: company.facebook_url });
    if (company?.youtube_url) items.push({ text: "YouTube", url: company.youtube_url });
    if (items.length) {
      doc.setFont("Montserrat", "normal"); doc.setFontSize(9); doc.setTextColor("#cccccc");
      const sep = "   |   ";
      const widths = items.map(i => doc.getTextWidth(i.text));
      const sepW = doc.getTextWidth(sep);
      const totalW = widths.reduce((a, b) => a + b, 0) + sepW * (items.length - 1);
      let x = W / 2 - totalW / 2;
      const ly = textY + (role ? 13 : 7);
      items.forEach((it, i) => {
        doc.textWithLink(it.text, x, ly, { url: it.url });
        x += widths[i];
        if (i < items.length - 1) { doc.text(sep, x, ly); x += sepW; }
      });
    }
  }

  // Company footer — respect user toggles strictly. If nothing toggled, render nothing.
  const cf: CompanyFooterFields = companyFields || { phone: true, email: true, website: true, address: true };
  type FItem = { text: string; url?: string };
  const fItems: FItem[] = [];
  if (cf.phone && company?.phone) fItems.push({ text: company.phone, url: `tel:${String(company.phone).replace(/[^\d+]/g, "")}` });
  if (cf.email && company?.email) fItems.push({ text: company.email, url: `mailto:${company.email}` });
  if (cf.website && company?.website) {
    const w = String(company.website);
    fItems.push({ text: w, url: /^https?:\/\//i.test(w) ? w : `https://${w}` });
  }
  if (cf.address && company?.address) fItems.push({ text: company.address });
  if (company?.linkedin_url) fItems.push({ text: "LinkedIn", url: company.linkedin_url });
  if (company?.instagram_url) fItems.push({ text: "Instagram", url: company.instagram_url });
  if (company?.facebook_url) fItems.push({ text: "Facebook", url: company.facebook_url });
  if (company?.youtube_url) fItems.push({ text: "YouTube", url: company.youtube_url });
  if (fItems.length) {
    doc.setFont("Montserrat", "normal"); doc.setFontSize(9); doc.setTextColor("#999999");
    const sep = "   |   ";
    const widths = fItems.map(i => doc.getTextWidth(i.text));
    const sepW = doc.getTextWidth(sep);
    const totalW = widths.reduce((a, b) => a + b, 0) + sepW * (fItems.length - 1);
    const maxW = W - 40;
    if (totalW <= maxW) {
      let x = W / 2 - totalW / 2;
      const ly = H - 18;
      fItems.forEach((it, i) => {
        if (it.url) doc.textWithLink(it.text, x, ly, { url: it.url });
        else doc.text(it.text, x, ly);
        x += widths[i];
        if (i < fItems.length - 1) { doc.text(sep, x, ly); x += sepW; }
      });
    } else {
      // Stack each item on its own line, centered & clickable
      const startY = H - 18 - (fItems.length - 1) * 5;
      fItems.forEach((it, i) => {
        const tw = widths[i];
        const x = W / 2 - tw / 2;
        const ly = startY + i * 5;
        if (it.url) doc.textWithLink(it.text, x, ly, { url: it.url });
        else doc.text(it.text, x, ly);
      });
    }
  }
}

async function renderProject(doc: jsPDF, p: any, company: any, page: { n: number }, tpl?: Template) {
  if (tpl) {
    doc.addPage(); page.n++;
    await renderTemplatePage(doc, tpl, { project: p, company });
    return;
  }
  const W = doc.internal.pageSize.getWidth(), H = doc.internal.pageSize.getHeight();

  // Collect every populated project fact once — reused on hero + detail pages.
  const facts: [string, string][] = [];
  if (p.type) facts.push(["Type", fmt(p.type)]);
  if (p.location) facts.push(["Location", p.location]);
  if (p.client_name) facts.push(["Client", p.client_name]);
  if (p.area_sqm) facts.push(["Area", `${p.area_sqm} sqm`]);
  if (p.status) facts.push(["Status", fmt(p.status)]);
  if (p.phase) facts.push(["Phase", fmt(p.phase)]);
  if (typeof p.progress_pct === "number" && p.progress_pct > 0) facts.push(["Progress", `${p.progress_pct}%`]);
  if (p.estimated_completion) {
    const d = new Date(p.estimated_completion);
    facts.push(["Est. Completion", isNaN(d.getTime()) ? String(p.estimated_completion) : d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" })]);
  }

  const hasInfo = !!(p.description && p.description.trim()) || !!(p.highlights?.length);
  const cover = p.cover_image ? await loadImg(p.cover_image) : null;

  // Hero page — render whenever there is a cover image. Right column shows
  // the title, location and any available project facts (so details are
  // visible even when there's no description/highlights).
  if (cover) {
    doc.addPage(); page.n++;
    const halfW = W * 0.6;
    doc.setFillColor(BRAND.paper); doc.rect(0, 0, halfW, H, "F");
    // Cover-fit (fill the slot, crop overflow) so there are no black bars.
    const ar = cover.w / cover.h;
    const slotAr = halfW / H;
    let iw = halfW, ih = H;
    if (ar > slotAr) { iw = H * ar; } else { ih = halfW / ar; }
    doc.addImage(cover.data, "JPEG", (halfW - iw) / 2, (H - ih) / 2, iw, ih);
    doc.setFillColor(BRAND.paper); doc.rect(halfW, 0, W - halfW, H, "F");
    const padX = 14;
    const tx = halfW + padX;
    const textW = W - halfW - padX * 2;
    doc.setFontSize(8); doc.setTextColor(BRAND.muted); doc.setFont("Montserrat", "normal");
    const typeLines = doc.splitTextToSize(fmt(p.type).toUpperCase(), textW);
    doc.text(typeLines, tx, 30, { charSpace: 1.5 });
    const titleStartY = 30 + typeLines.length * 5 + 6;
    doc.setFont("Montserrat", "bold"); doc.setTextColor(BRAND.ink);
    let titleSize = 26;
    let lines: string[] = [];
    while (titleSize >= 14) {
      doc.setFontSize(titleSize);
      lines = doc.splitTextToSize(p.name || "", textW);
      if (lines.length <= 4) break;
      titleSize -= 2;
    }
    const lh = titleSize * 0.42;
    doc.text(lines, tx, titleStartY);
    const afterTitleY = titleStartY + lines.length * lh;
    doc.setDrawColor(BRAND.ink); doc.line(tx, afterTitleY + 2, tx + 25, afterTitleY + 2);
    doc.setFontSize(10); doc.setTextColor(BRAND.muted); doc.setFont("Montserrat", "normal");
    const locLines = doc.splitTextToSize(p.location || "", textW);
    if (p.location) doc.text(locLines, tx, afterTitleY + 10);


    // Project details stack on the right side of the hero.
    let factsY = afterTitleY + 10 + (p.location ? locLines.length * 5 : 0) + 10;
    facts.filter(([k]) => k !== "Type" && k !== "Location").forEach(([k, v]) => {
      if (factsY > H - SAFE_BOTTOM - 8) return;
      doc.setFontSize(8); doc.setFont("Montserrat", "normal"); doc.setTextColor(BRAND.muted);
      doc.text(k.toUpperCase(), tx, factsY, { charSpace: 1.5 });
      doc.setFontSize(11); doc.setFont("Montserrat", "bold"); doc.setTextColor(BRAND.ink);
      const valLines = doc.splitTextToSize(String(v), textW);
      doc.text(valLines, tx, factsY + 5);
      factsY += 5 + valLines.length * 5 + 4;
    });

    addPageFooter(doc, company, page.n);
  }


  // Detail page — render when there's description/highlights, OR when there
  // are facts but no cover image to display them on the hero page.
  const shouldRenderDetail = hasInfo || (!cover && facts.length > 0);
  if (shouldRenderDetail) {
  doc.addPage(); page.n++;
  addPageHeader(doc, company);
  let y = sectionTitle(doc, "Case Study", "Overview", SECTION_TOP);

  if (facts.length) {
    // Wrap facts into rows of 4 so longer fact sets stay readable.
    const perRow = Math.min(4, facts.length);
    const rows: [string, string][][] = [];
    for (let i = 0; i < facts.length; i += perRow) rows.push(facts.slice(i, i + perRow));
    const colW = (W - 30) / perRow;
    rows.forEach((row) => {
      doc.setFontSize(8); doc.setFont("Montserrat", "normal");
      row.forEach((f, i) => {
        doc.setTextColor(BRAND.muted); doc.text(f[0].toUpperCase(), 15 + i * colW, y, { charSpace: 1.5 });
        doc.setTextColor(BRAND.ink); doc.setFont("Montserrat", "bold"); doc.setFontSize(11);
        const valLines = doc.splitTextToSize(f[1], colW - 4);
        doc.text(valLines, 15 + i * colW, y + 6);
        doc.setFont("Montserrat", "normal"); doc.setFontSize(8);
      });
      y += 16;
    });
    doc.setDrawColor(BRAND.ink); doc.setLineWidth(0.2); doc.line(15, y, W - 15, y); y += 10;
  }


  if (p.description && p.description.trim()) {
    doc.setFont("Montserrat", "normal"); doc.setFontSize(11); doc.setTextColor(BRAND.ink);
    const descLines = doc.splitTextToSize(p.description, W - 30);
    const descLh = 5.5;
    for (const ln of descLines) {
      if (y > H - SAFE_BOTTOM - 5) { addPageFooter(doc, company, page.n); doc.addPage(); page.n++; addPageHeader(doc, company); y = SECTION_TOP; }
      doc.text(ln, 15, y); y += descLh;
    }
    y += 8;
  }

  if (p.highlights?.length) {
    doc.setFontSize(9); doc.setTextColor(BRAND.muted); doc.setFont("Montserrat", "bold");
    doc.text("KEY HIGHLIGHTS", 15, y, { charSpace: 3 }); y += 7;
    doc.setFontSize(10); doc.setFont("Montserrat", "normal"); doc.setTextColor(BRAND.ink);
    p.highlights.forEach((h: string) => {
      if (y > H - SAFE_BOTTOM - 5) { addPageFooter(doc, company, page.n); doc.addPage(); page.n++; addPageHeader(doc, company); y = SECTION_TOP; }
      doc.text(BULLET, 15, y);
      const hl = doc.splitTextToSize(h, W - 35);
      doc.text(hl, 22, y); y += hl.length * 5 + 2;
    });
  }
  addPageFooter(doc, company, page.n);
  } // end if(hasInfo)

  // Gallery — include cover image first (always shown when images exist)
  const allImages = Array.from(new Set([
    ...(p.cover_image ? [p.cover_image] : []),
    ...((p.images || []) as string[]),
  ]));
  if (allImages.length) {
    doc.addPage(); page.n++;
    addPageHeader(doc, company);
    let yy = sectionTitle(doc, "Gallery", "Visual Story", SECTION_TOP);

    // Stable grid: respect user-chosen column count, except when 1 image (full width).
    const total = allImages.length;
    const userCols = GALLERY_COLS;
    const cols = total === 1 ? 1 : Math.min(userCols, total === 2 ? 2 : userCols);
    const gap = 5;
    const imgW = (W - 30 - gap * (cols - 1)) / cols;
    const imgH = cols === 1 ? imgW * 0.6 : cols === 2 ? imgW * 0.66 : imgW * 0.7;

    // Pre-load every image so we can center under-filled final rows.
    const imgs = await Promise.all(allImages.map((u) => loadImg(u)));
    const valid = imgs.filter(Boolean) as { data: string; w: number; h: number }[];

    let i = 0;
    while (i < valid.length) {
      // Row break + repeat heading on continuation pages so layout matches page 1.
      if (yy + imgH > H - SAFE_BOTTOM) {
        addPageFooter(doc, company, page.n);
        doc.addPage(); page.n++;
        addPageHeader(doc, company);
        yy = sectionTitle(doc, "Gallery", "Visual Story", SECTION_TOP);
      }

      const rowItems = valid.slice(i, i + cols);
      const rowWidth = rowItems.length * imgW + (rowItems.length - 1) * gap;
      let x = (W - rowWidth) / 2; // center the row (handles partial last row)

      for (const img of rowItems) {
        const ar = img.w / img.h;
        const slotAr = imgW / imgH;
        let iw = imgW, ih = imgH;
        if (ar > slotAr) { ih = imgW / ar; } else { iw = imgH * ar; }
        doc.addImage(img.data, "JPEG", x + (imgW - iw) / 2, yy + (imgH - ih) / 2, iw, ih);
        x += imgW + gap;
      }
      i += rowItems.length;
      yy += imgH + gap;
    }
    addPageFooter(doc, company, page.n);
  }
}

async function addCategoryCover(doc: jsPDF, type: string, count: number, image: any, tpl?: Template, categoryImageUrl?: string) {
  doc.addPage();
  if (tpl) { await renderTemplatePage(doc, tpl, { category: type, count, categoryImageUrl }); return; }
  const W = doc.internal.pageSize.getWidth(), H = doc.internal.pageSize.getHeight();
  doc.setFillColor(BRAND.ink); doc.rect(0, 0, W, H, "F");
  if (image) {
    const ar = image.w / image.h;
    const slotAr = W / H;
    let iw = W, ih = H;
    if (ar > slotAr) { ih = W / ar; } else { iw = H * ar; }
    doc.addImage(image.data, "JPEG", (W - iw) / 2, (H - ih) / 2, iw, ih);
    // dark overlay band on bottom
    doc.setFillColor(BRAND.ink);
    (doc as any).setGState && (doc as any).setGState(new (doc as any).GState({ opacity: 0.55 }));
    doc.rect(0, H * 0.55, W, H * 0.45, "F");
    (doc as any).setGState && (doc as any).setGState(new (doc as any).GState({ opacity: 1 }));
  }

  // Centered category title with tracked letter spacing.
  // Auto-shrink the font and the letter-spacing together so long labels
  // (e.g. "RESTAURANTS & CAFE'S") stay on one line and stay centered.
  const title = (type || "").toUpperCase();
  if (title) {
    const maxW = W - 30;          // 15mm side margins
    const cy = H * 0.78;          // sits inside the dark band
    doc.setFont("Montserrat", "bold"); doc.setTextColor(BRAND.paper);

    let size = 28;
    let charSpace = 4;
    doc.setFontSize(size);
    const widthOf = () => doc.getTextWidth(title) + charSpace * Math.max(0, title.length - 1);
    const fits = () => widthOf() <= maxW;
    // First: tighten letter spacing all the way to 0.
    while (!fits() && charSpace > 0) { charSpace = Math.max(0, charSpace - 0.5); }
    // Then: shrink font size down to 8pt if still overflowing.
    while (!fits() && size > 8) { size -= 1; doc.setFontSize(size); }
    if (!fits()) { charSpace = 0; }

    // jsPDF's align:center does NOT account for charSpace, so center manually.
    const tw = widthOf();
    doc.text(title, W / 2 - tw / 2, cy, { charSpace });

    // Thin accent rule under the title for visual anchor.
    doc.setDrawColor(BRAND.paper); doc.setLineWidth(0.4);
    doc.line(W / 2 - 18, cy + 6, W / 2 + 18, cy + 6);

    // Optional small caption with project count (also manually centered for charSpace).
    if (count > 0) {
      doc.setFont("Montserrat", "normal"); doc.setFontSize(9); doc.setTextColor("#cccccc");
      const cap = `${count} PROJECT${count === 1 ? "" : "S"}`;
      const capCs = 3;
      const capW = doc.getTextWidth(cap) + capCs * Math.max(0, cap.length - 1);
      doc.text(cap, W / 2 - capW / 2, cy + 14, { charSpace: capCs });
    }
  }
}


function groupByType(list: any[], preserveOrder = false): Array<{ type: string; items: any[] }> {
  const map = new Map<string, any[]>();
  for (const p of list) {
    const t = (p.type || "Uncategorized").toString();
    if (!map.has(t)) map.set(t, []);
    map.get(t)!.push(p);
  }
  const entries = Array.from(map.entries());
  if (!preserveOrder) entries.sort((a, b) => a[0].localeCompare(b[0]));
  return entries.map(([type, items]) => ({ type, items }));
}

const DEFAULT_PARTNERS_INTRO =
  "We take immense pride as Sadeco is a Top listed and approved contractor in all major shopping malls in the UAE; EMAAR, MERAAS, MAF, NAKHEEL. Moreover, we have successfully executed major projects in all of the GCC countries.";

const FALLBACK_PARTNERS = [
  "Al Qana", "Emaar", "Meraas", "Majid Al Futtaim",
  "Al Futtaim Property", "Danube", "Nakheel",
  "Marina Mall", "Dubai Retail",
];

async function addClientsPage(doc: jsPDF, company: any, page: { n: number }) {
  const W = doc.internal.pageSize.getWidth(), H = doc.internal.pageSize.getHeight();

  // Fetch partners list
  const { data: rows } = await supabase.from("partners")
    .select("name,logo_url,sort_order").order("sort_order", { ascending: true });
  const partners = (rows && rows.length)
    ? rows
    : FALLBACK_PARTNERS.map((name, i) => ({ name, logo_url: null, sort_order: i }));

  const layout = company?.partners_layout || {};
  const cols = Math.max(1, Math.min(6, Number(layout.cols) || 3));
  const tileStyle: "outlined" | "filled" | "none" = layout.tile_style || "outlined";
  const fontSize = Math.max(7, Math.min(24, Number(layout.font_size) || 13));
  const showLogos = layout.logo_mode !== false;
  const intro = (company?.partners_intro ?? DEFAULT_PARTNERS_INTRO) || "";

  doc.addPage(); page.n++;
  addPageHeader(doc, company);
  let y = sectionTitle(doc, "Trusted Partners", "Clients & Partners", SECTION_TOP);

  if (intro.trim()) {
    doc.setFont("Montserrat", "normal"); doc.setFontSize(12); doc.setTextColor(BRAND.ink);
    const lines = doc.splitTextToSize(intro, W - 30);
    doc.text(lines, 15, y); y += lines.length * 6 + 8;
  }

  doc.setFont("Montserrat", "bold"); doc.setFontSize(9); doc.setTextColor(BRAND.muted);
  doc.text("LISTED & APPROVED WITH", 15, y, { charSpace: 3 }); y += 8;

  const gap = 6;
  const cellW = (W - 30 - gap * (cols - 1)) / cols;
  // Scale tile height down for denser grids so 6 columns fit nicely
  const baseH = showLogos ? Math.max(20, Math.min(38, cellW * 0.55)) : 18;
  const cellH = baseH;

  // Preload logos — keep transparency so logos don't pick up a white/gray box
  const logos = await Promise.all(
    partners.map(p => (showLogos && p.logo_url) ? loadLogoTransparent(p.logo_url) : Promise.resolve(null))
  );

  const startNewPartnersPage = () => {
    addPageFooter(doc, company, page.n);
    doc.addPage(); page.n++;
    addPageHeader(doc, company);
    y = sectionTitle(doc, "Trusted Partners", "Clients & Partners", SECTION_TOP);
  };

  let x = 15, col = 0;
  for (let i = 0; i < partners.length; i++) {
    if (y + cellH > H - SAFE_BOTTOM) {
      startNewPartnersPage();
      x = 15; col = 0;
    }
    const p = partners[i];
    const img = logos[i];

    // No fill — logos sit cleanly on the paper. Only the explicit "filled"
    // style retains a tile background; "outlined" draws just a hairline border.
    if (tileStyle === "filled") {
      doc.setFillColor("#eeeef0"); doc.rect(x, y, cellW, cellH, "F");
    } else if (tileStyle === "outlined") {
      doc.setDrawColor(220, 220, 224); doc.setLineWidth(0.3);
      doc.rect(x, y, cellW, cellH, "S");
    }

    if (img) {
      const pad = 3;
      const maxW = cellW - pad * 2;
      const maxH = cellH - pad * 2;
      const ratio = img.w / img.h;
      let dw = maxW, dh = maxW / ratio;
      if (dh > maxH) { dh = maxH; dw = maxH * ratio; }
      const ix = x + (cellW - dw) / 2;
      const iy = y + (cellH - dh) / 2;
      try { doc.addImage(img.data, "PNG", ix, iy, dw, dh, undefined, "FAST"); } catch {}
    } else {
      doc.setFont("Montserrat", "bold"); doc.setTextColor(BRAND.ink);
      fitCenteredText(doc, p.name, x + cellW / 2, y + cellH / 2, cellW - 6, fontSize, 7);
    }

    col++;
    if (col >= cols) { col = 0; x = 15; y += cellH + gap; }
    else { x += cellW + gap; }
  }

  addPageFooter(doc, company, page.n);
}


async function resolveContact(explicit?: any): Promise<any | null> {
  if (explicit === null) return null; // explicit "none"
  if (explicit) return explicit;
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase.from("profiles").select("*").eq("id", user.id).maybeSingle();
  return data || null;
}

export async function exportSelectedPDF(company: any, list: any[], categoryCovers: Record<string, string> = {}, contact?: any, companyFields?: CompanyFooterFields, aboutPage?: AboutPageData) {
  const doc = await newDoc();
  const tpls = await loadTemplates("portfolio");
  const hasCustom = Object.keys(tpls).length > 0;
  const include = (kind: Template["page_type"]) => !hasCustom || !!tpls[kind];
  const logo = company?.logo_url ? await loadLogoTransparent(company.logo_url) : null;
  const c = await resolveContact(contact);
  const coverProject = list.length === 1 ? list[0] : undefined;
  let firstPage = true;
  const page = { n: 1 };
  if (include("cover")) {
    await addCover(doc, company, `Portfolio - ${list.length} Project${list.length === 1 ? "" : "s"}`, logo, tpls.cover, coverProject);
    firstPage = false;
  }
  if (aboutPage?.enabled) {
    await addAboutCover(doc, company, logo, aboutPage, firstPage);
    firstPage = false;
  }
  const groups = groupByType(list, true);
  for (const g of groups) {
    if (include("divider")) {
      const coverUrl = categoryCovers[g.type] || g.items.find(p => p.cover_image)?.cover_image;
      const img = coverUrl ? await loadImg(coverUrl) : null;
      if (firstPage) { firstPage = false; } else { /* addCategoryCover handles its own addPage internally */ }
      await addCategoryCover(doc, g.type, g.items.length, img, tpls.divider, coverUrl);
      page.n++;
    }
    if (include("project")) {
      for (const p of g.items) {
        await renderProject(doc, p, company, page, tpls.project);
        firstPage = false;
      }
    }
  }
  if (include("project")) await addClientsPage(doc, company, page);
  if (include("thankyou")) await addThankYou(doc, company, logo, tpls.thankyou, c, companyFields);
  doc.save(`SADECO-Portfolio.pdf`);
}

export async function exportFullProfilePDF(company: any, projects: any[], categoryCovers: Record<string, string> = {}, contact?: any, companyFields?: CompanyFooterFields, aboutPage?: AboutPageData) {
  const doc = await newDoc();
  const W = doc.internal.pageSize.getWidth();
  const tpls = await loadTemplates("profile");
  const hasCustom = Object.keys(tpls).length > 0;
  const include = (kind: Template["page_type"]) => !hasCustom || !!tpls[kind];
  const logo = company?.logo_url ? await loadLogoTransparent(company.logo_url) : null;
  const c = await resolveContact(contact);
  const page = { n: 1 };
  let firstPage = true;
  if (aboutPage?.enabled) { await addAboutCover(doc, company, logo, aboutPage, firstPage); firstPage = false; }
  if (include("cover")) { if (!firstPage) doc.addPage(); await addCover(doc, company, "Company Profile", logo, tpls.cover); firstPage = false; }

  // About + Services pages — only include if NO custom template (defaults are skipped when user customized any page)
  if (!hasCustom) {
    // About page
    doc.addPage(); page.n++;
    addPageHeader(doc, company);
    const H = doc.internal.pageSize.getHeight();
    let y = sectionTitle(doc, "Introduction", "About " + (company?.name || "SADECO"), SECTION_TOP);
    doc.setFont("Montserrat", "normal"); doc.setFontSize(12); doc.setTextColor(BRAND.ink);
    const about = doc.splitTextToSize(company?.about || "", W - 30);
    for (const ln of about) {
      if (y > H - SAFE_BOTTOM - 5) { addPageFooter(doc, company, page.n); doc.addPage(); page.n++; addPageHeader(doc, company); y = SECTION_TOP; }
      doc.text(ln, 15, y); y += 6;
    }
    y += 10;

    if (y > H - 50) { addPageFooter(doc, company, page.n); doc.addPage(); page.n++; addPageHeader(doc, company); y = SECTION_TOP; }
    doc.setFont("Montserrat", "bold"); doc.setFontSize(9); doc.setTextColor(BRAND.muted);
    doc.text("CONTACT", 15, y, { charSpace: 3 }); y += 7;
    doc.setFontSize(10); doc.setFont("Montserrat", "normal"); doc.setTextColor(BRAND.ink);
    ([["Phone", company?.phone], ["Email", company?.email], ["Website", company?.website], ["Address", company?.address]] as [string, string][])
      .filter(([_, v]) => v).forEach(([k, v]) => {
        const lines = doc.splitTextToSize(String(v), W - 60);
        if (y + lines.length * 6 > H - 18) { addPageFooter(doc, company, page.n); doc.addPage(); page.n++; addPageHeader(doc, company); y = SECTION_TOP; }
        doc.setTextColor(BRAND.muted); doc.text(k, 15, y);
        doc.setTextColor(BRAND.ink); doc.text(lines, 45, y); y += lines.length * 6;
      });
    addPageFooter(doc, company, page.n);

    // Services page
    doc.addPage(); page.n++;
    addPageHeader(doc, company);
    y = sectionTitle(doc, "Capabilities", "Our Services", SECTION_TOP);
    doc.setFontSize(13); doc.setFont("Montserrat", "normal"); doc.setTextColor(BRAND.ink);
    (company?.services || []).forEach((s: string) => {
      const lines = doc.splitTextToSize(s, W - 35);
      if (y + lines.length * 6 > H - 18) { addPageFooter(doc, company, page.n); doc.addPage(); page.n++; addPageHeader(doc, company); y = SECTION_TOP; }
      doc.text(BULLET, 15, y);
      doc.text(lines, 22, y); y += lines.length * 6 + 3;
    });
    addPageFooter(doc, company, page.n);
  }

  const groups = groupByType(projects);
  for (const g of groups) {
    if (include("divider")) {
      const coverUrl = categoryCovers[g.type] || g.items.find(p => p.cover_image)?.cover_image;
      const img = coverUrl ? await loadImg(coverUrl) : null;
      await addCategoryCover(doc, g.type, g.items.length, img, tpls.divider, coverUrl);
      page.n++;
    }
    if (include("project")) {
      for (const p of g.items) await renderProject(doc, p, company, page, tpls.project);
    }
  }

  if (include("project")) await addClientsPage(doc, company, page);
  if (include("thankyou")) await addThankYou(doc, company, logo, tpls.thankyou, c, companyFields);
  doc.save(`SADECO-Company-Profile.pdf`);
}

export async function exportProjectPDF(p: any, company: any, contact?: any, companyFields?: CompanyFooterFields) {
  const doc = await newDoc();
  const tpls = await loadTemplates("project");
  const hasCustom = Object.keys(tpls).length > 0;
  const include = (kind: Template["page_type"]) => !hasCustom || !!tpls[kind];
  const logo = company?.logo_url ? await loadLogoTransparent(company.logo_url) : null;
  const c = await resolveContact(contact);
  if (include("cover")) await addCover(doc, company, "Project Case Study", logo, tpls.cover, p);
  const page = { n: 1 };
  if (include("project")) await renderProject(doc, p, company, page, tpls.project);
  if (include("thankyou")) await addThankYou(doc, company, logo, tpls.thankyou, c, companyFields);
  doc.save(`SADECO-${p.name.replace(/\s+/g, "-")}.pdf`);
}

