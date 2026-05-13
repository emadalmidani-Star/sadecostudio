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

function fmt(s?: string | null) { return s ? s.charAt(0).toUpperCase() + s.slice(1) : ""; }

async function newDoc() {
  // Landscape A4 with built-in PDF stream compression
  const doc = new jsPDF({ unit: "mm", format: "a4", orientation: "landscape", compress: true });
  await registerMontserrat(doc);
  return doc;
}

async function addCover(doc: jsPDF, company: any, subtitle: string, logo: any, tpl?: Template) {
  if (tpl) { await renderTemplatePage(doc, tpl, { company, subtitle }); return; }
  const W = doc.internal.pageSize.getWidth(), H = doc.internal.pageSize.getHeight();
  doc.setFillColor(BRAND.paper); doc.rect(0, 0, W, H, "F");
  // black band on the left
  doc.setFillColor(BRAND.ink); doc.rect(0, 0, W * 0.38, H, "F");
  if (logo) {
    const ratio = logo.w / logo.h; const w = 60; const h = w / ratio;
    doc.addImage(logo.data, "PNG", (W * 0.38 - w) / 2, H / 2 - h / 2, w, h);
  }
  // right side
  doc.setTextColor(BRAND.ink); doc.setFont("Montserrat", "bold"); doc.setFontSize(48);
  doc.text(company?.name || "SADECO", W * 0.42, H / 2 - 6);
  // accent rule
  doc.setDrawColor(BRAND.ink); doc.setLineWidth(0.6); doc.line(W * 0.42, H / 2 + 6, W * 0.42 + 30, H / 2 + 6);
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

function sectionTitle(doc: jsPDF, _label: string, title: string, y: number) {
  doc.setFontSize(26); doc.setTextColor(BRAND.ink); doc.setFont("Montserrat", "bold");
  doc.text(title, 15, y + 4);
  doc.setDrawColor(BRAND.ink); doc.setLineWidth(0.4); doc.line(15, y + 7, 50, y + 7);
  return y + 18;
}

export type CompanyFooterFields = { phone?: boolean; email?: boolean; website?: boolean; address?: boolean };
async function addThankYou(doc: jsPDF, company: any, logo: any, tpl?: Template, contact?: any, companyFields?: CompanyFooterFields) {
  doc.addPage();
  if (tpl) { await renderTemplatePage(doc, tpl, { company, contact }); return; }
  const W = doc.internal.pageSize.getWidth(), H = doc.internal.pageSize.getHeight();
  doc.setFillColor(BRAND.ink); doc.rect(0, 0, W, H, "F");

  // Headline
  doc.setTextColor(BRAND.paper); doc.setFont("Montserrat", "bold"); doc.setFontSize(56);
  doc.text("Thank You", W / 2, 50, { align: "center" });
  doc.setFont("Montserrat", "normal"); doc.setFontSize(11); doc.setTextColor("#bbbbbb");
  doc.text("We look forward to building with you.", W / 2, 62, { align: "center" });

  // Contact card (centered) — circular avatar
  const cardY = 78;
  const avatarSize = 42;
  const cx = W / 2;
  const cy = cardY + avatarSize / 2;
  const r = avatarSize / 2;

  const avatar = contact?.avatar_url ? await loadImg(contact.avatar_url) : null;
  if (avatar) {
    try {
      const px = 512;
      const cv = document.createElement("canvas"); cv.width = px; cv.height = px;
      const ctx = cv.getContext("2d")!;
      ctx.save();
      ctx.beginPath(); ctx.arc(px / 2, px / 2, px / 2, 0, Math.PI * 2); ctx.closePath(); ctx.clip();
      const img = new Image(); img.crossOrigin = "anonymous";
      await new Promise<void>((res, rej) => { img.onload = () => res(); img.onerror = rej; img.src = contact.avatar_url; });
      const ar = img.width / img.height;
      let sw = img.width, sh = img.height, sx = 0, sy = 0;
      if (ar > 1) { sw = img.height; sx = (img.width - sw) / 2; }
      else if (ar < 1) { sh = img.width; sy = (img.height - sh) / 2; }
      ctx.drawImage(img, sx, sy, sw, sh, 0, 0, px, px);
      ctx.restore();
      doc.addImage(cv.toDataURL("image/png"), "PNG", cx - r, cy - r, avatarSize, avatarSize);
    } catch {
      doc.addImage(avatar.data, "JPEG", cx - r, cy - r, avatarSize, avatarSize);
    }
    doc.setDrawColor(BRAND.paper); doc.setLineWidth(0.8);
    doc.circle(cx, cy, r + 0.4, "S");
  } else if (contact && logo) {
    const ratio = logo.w / logo.h; const w = 40; const h = w / ratio;
    doc.addImage(logo.data, "PNG", (W - w) / 2, cardY, w, h);
  }

  let ty = cardY + avatarSize + 12;
  if (contact?.full_name) {
    doc.setFont("Montserrat", "bold"); doc.setFontSize(16); doc.setTextColor(BRAND.paper);
    doc.text(contact.full_name, W / 2, ty, { align: "center" }); ty += 6;
  }
  if (contact?.job_title) {
    doc.setFont("Montserrat", "normal"); doc.setFontSize(10); doc.setTextColor("#bbbbbb");
    doc.text(contact.job_title, W / 2, ty, { align: "center" }); ty += 8;
  }

  // Contact lines (no WhatsApp on the export footer)
  doc.setFontSize(10); doc.setTextColor("#dddddd"); doc.setFont("Montserrat", "normal");
  const lines = [
    contact?.phone ? `Phone  ${contact.phone}` : null,
    contact?.email ? `Email  ${contact.email}` : null,
  ].filter(Boolean) as string[];
  lines.forEach(l => { doc.text(l, W / 2, ty, { align: "center" }); ty += 6; });

  // Company contact row (configurable fields)
  const cf: CompanyFooterFields = companyFields || { phone: true, email: true, website: true, address: false };
  const parts = [
    cf.phone ? company?.phone : null,
    cf.email ? company?.email : null,
    cf.website ? company?.website : null,
    cf.address ? company?.address : null,
  ].filter(Boolean).join("   |   ");
  doc.setFontSize(9); doc.setTextColor("#999999");
  const partLines = doc.splitTextToSize(parts, W - 40);
  partLines.forEach((ln: string, i: number) => {
    doc.text(ln, W / 2, H - 28 + i * 5, { align: "center" });
  });

  // Social icons row (drawn as labeled circles since icon fonts aren't embedded)
  const socials = [
    { url: company?.linkedin_url, letter: "in" },
    { url: company?.facebook_url, letter: "f" },
    { url: company?.instagram_url, letter: "ig" },
    { url: company?.youtube_url, letter: "yt" },
  ].filter(s => s.url);
  if (socials.length) {
    const r = 4;
    const gap = 14;
    const totalW = socials.length * (r * 2) + (socials.length - 1) * gap;
    let sx = (W - totalW) / 2 + r;
    const sy = H - 16;
    socials.forEach(s => {
      doc.setDrawColor(BRAND.paper); doc.setLineWidth(0.4);
      doc.circle(sx, sy, r, "S");
      doc.setFont("Montserrat", "bold"); doc.setFontSize(7); doc.setTextColor(BRAND.paper);
      doc.text(s.letter, sx, sy + 1.2, { align: "center" });
      (doc as any).link(sx - r, sy - r, r * 2, r * 2, { url: s.url });
      sx += r * 2 + gap;
    });
  }
}

async function renderProject(doc: jsPDF, p: any, company: any, page: { n: number }, tpl?: Template) {
  if (tpl) {
    doc.addPage(); page.n++;
    await renderTemplatePage(doc, tpl, { project: p, company });
    return;
  }
  const W = doc.internal.pageSize.getWidth(), H = doc.internal.pageSize.getHeight();
  const hasInfo = !!(p.description && p.description.trim()) || !!(p.highlights?.length);
  const cover = p.cover_image && hasInfo ? await loadImg(p.cover_image) : null;

  // Hero page (landscape split) — skip when there's no info
  doc.addPage(); page.n++;
  if (cover) {
    const halfW = W * 0.6;
    // letterbox to preserve aspect ratio (no distortion)
    doc.setFillColor(BRAND.ink); doc.rect(0, 0, halfW, H, "F");
    const ar = cover.w / cover.h;
    const slotAr = halfW / H;
    let iw = halfW, ih = H;
    if (ar > slotAr) { ih = halfW / ar; } else { iw = H * ar; }
    doc.addImage(cover.data, "JPEG", (halfW - iw) / 2, (H - ih) / 2, iw, ih);
    doc.setFillColor(BRAND.paper); doc.rect(halfW, 0, W - halfW, H, "F");
    const tx = halfW + 12;
    const textW = W - halfW - 20;
    doc.setFontSize(9); doc.setTextColor(BRAND.muted); doc.setFont("Montserrat", "normal");
    doc.text(fmt(p.type).toUpperCase(), tx, 30, { charSpace: 2 });
    // Auto-shrink title until it fits in at most 4 lines
    doc.setFont("Montserrat", "bold"); doc.setTextColor(BRAND.ink);
    let titleSize = 28;
    let lines: string[] = [];
    while (titleSize >= 14) {
      doc.setFontSize(titleSize);
      lines = doc.splitTextToSize(p.name || "", textW);
      if (lines.length <= 4) break;
      titleSize -= 2;
    }
    const lh = titleSize * 0.42;
    doc.text(lines, tx, 44);
    const afterTitleY = 44 + lines.length * lh;
    doc.setDrawColor(BRAND.ink); doc.line(tx, afterTitleY + 2, tx + 25, afterTitleY + 2);
    doc.setFontSize(10); doc.setTextColor(BRAND.muted); doc.setFont("Montserrat", "normal");
    const locLines = doc.splitTextToSize(p.location || "", textW);
    doc.text(locLines, tx, afterTitleY + 10);
  } else {
    doc.setFillColor(BRAND.ink); doc.rect(0, 0, W, H, "F");
    doc.setTextColor(BRAND.paper); doc.setFontSize(10); doc.setFont("Montserrat", "normal");
    doc.text(fmt(p.type).toUpperCase(), 20, H / 2 - 14, { charSpace: 3 });
    doc.setFontSize(40); doc.setFont("Montserrat", "bold");
    doc.text(doc.splitTextToSize(p.name, W - 40), 20, H / 2);
  }
  addPageFooter(doc, company, page.n);

  // Detail page
  doc.addPage(); page.n++;
  addPageHeader(doc, company);
  let y = sectionTitle(doc, "Case Study", "Overview", 28);

  const facts = [
    ["Type", fmt(p.type)],
    ["Location", p.location || "-"],
    ["Area", p.area_sqm ? `${p.area_sqm} sqm` : "-"],
    ["Status", fmt(p.status)],
    ["Client", p.client_name || "Confidential"],
  ];
  doc.setFontSize(8); doc.setFont("Montserrat", "normal");
  const colW = (W - 30) / facts.length;
  facts.forEach((f, i) => {
    doc.setTextColor(BRAND.muted); doc.text(f[0].toUpperCase(), 15 + i * colW, y, { charSpace: 1.5 });
    doc.setTextColor(BRAND.ink); doc.setFont("Montserrat", "bold"); doc.setFontSize(11);
    doc.text(f[1], 15 + i * colW, y + 6);
    doc.setFont("Montserrat", "normal"); doc.setFontSize(8);
  });
  y += 16;
  doc.setDrawColor(BRAND.ink); doc.setLineWidth(0.2); doc.line(15, y, W - 15, y); y += 10;

  if (p.description && p.description.trim()) {
    doc.setFont("Montserrat", "normal"); doc.setFontSize(11); doc.setTextColor(BRAND.ink);
    const descLines = doc.splitTextToSize(p.description, W - 30);
    const descLh = 5.5;
    for (const ln of descLines) {
      if (y > H - 25) { addPageFooter(doc, company, page.n); doc.addPage(); page.n++; addPageHeader(doc, company); y = 28; }
      doc.text(ln, 15, y); y += descLh;
    }
    y += 8;
  }

  if (p.highlights?.length) {
    doc.setFontSize(9); doc.setTextColor(BRAND.muted); doc.setFont("Montserrat", "bold");
    doc.text("KEY HIGHLIGHTS", 15, y, { charSpace: 3 }); y += 7;
    doc.setFontSize(10); doc.setFont("Montserrat", "normal"); doc.setTextColor(BRAND.ink);
    p.highlights.forEach((h: string) => {
      if (y > H - 25) { addPageFooter(doc, company, page.n); doc.addPage(); page.n++; addPageHeader(doc, company); y = 28; }
      doc.text(BULLET, 15, y);
      const hl = doc.splitTextToSize(h, W - 35);
      doc.text(hl, 22, y); y += hl.length * 5 + 2;
    });
  }
  addPageFooter(doc, company, page.n);

  // Gallery — include cover image first
  const allImages = Array.from(new Set([
    ...(p.cover_image ? [p.cover_image] : []),
    ...((p.images || []) as string[]),
  ]));
  if (allImages.length) {
    doc.addPage(); page.n++;
    addPageHeader(doc, company);
    let yy = sectionTitle(doc, "Gallery", "Visual Story", 28);
    const cols = allImages.length <= 4 ? 2 : 3;
    const gap = 5, imgW = (W - 30 - gap * (cols - 1)) / cols, imgH = imgW * 0.7;
    let x = 15, col = 0;
    for (let i = 0; i < allImages.length; i++) {
      const img = await loadImg(allImages[i]);
      if (!img) continue;
      if (yy + imgH > H - 20) {
        addPageFooter(doc, company, page.n);
        doc.addPage(); page.n++; addPageHeader(doc, company); yy = 28; x = 15; col = 0;
      }
      // fit image into slot preserving aspect ratio
      const ar = img.w / img.h;
      const slotAr = imgW / imgH;
      let iw = imgW, ih = imgH;
      if (ar > slotAr) { ih = imgW / ar; } else { iw = imgH * ar; }
      doc.setFillColor("#f2f2f2"); doc.rect(x, yy, imgW, imgH, "F");
      doc.addImage(img.data, "JPEG", x + (imgW - iw) / 2, yy + (imgH - ih) / 2, iw, ih);
      col++;
      if (col >= cols) { col = 0; x = 15; yy += imgH + gap; }
      else { x += imgW + gap; }
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
  doc.setTextColor(BRAND.paper); doc.setFont("Montserrat", "normal"); doc.setFontSize(10);
  doc.text("CATEGORY", 20, H - 60, { charSpace: 3 });
  // Auto-shrink long category titles
  const titleText = fmt(type) || "Projects";
  let tSize = 56; let tLines: string[] = [];
  doc.setFont("Montserrat", "bold");
  while (tSize >= 24) {
    doc.setFontSize(tSize);
    tLines = doc.splitTextToSize(titleText, W - 40);
    if (tLines.length <= 2) break;
    tSize -= 4;
  }
  const tlh = tSize * 0.42;
  doc.text(tLines, 20, H - 28 - (tLines.length - 1) * tlh);
  doc.setFont("Montserrat", "normal"); doc.setFontSize(11); doc.setTextColor("#cccccc");
  doc.text(`${count} project${count === 1 ? "" : "s"}`, 20, H - 18);
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
  let y = sectionTitle(doc, "Trusted Partners", "Clients & Partners", 28);

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

  // Preload logos
  const logos = await Promise.all(
    partners.map(p => (showLogos && p.logo_url) ? loadImg(p.logo_url) : Promise.resolve(null))
  );

  const startNewPartnersPage = () => {
    addPageFooter(doc, company, page.n);
    doc.addPage(); page.n++;
    addPageHeader(doc, company);
    y = sectionTitle(doc, "Trusted Partners", "Clients & Partners (cont.)", 28);
  };

  let x = 15, col = 0;
  for (let i = 0; i < partners.length; i++) {
    if (y + cellH > H - 20) {
      startNewPartnersPage();
      x = 15; col = 0;
    }
    const p = partners[i];
    const img = logos[i];

    // Always fill the tile background white so transparent PNGs render cleanly
    doc.setFillColor("#ffffff");
    doc.rect(x, y, cellW, cellH, "F");

    if (tileStyle === "filled") {
      doc.setFillColor("#f4f4f4"); doc.rect(x, y, cellW, cellH, "F");
    } else if (tileStyle === "outlined") {
      doc.setDrawColor(BRAND.ink); doc.setLineWidth(0.3);
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
      doc.setFont("Montserrat", "bold"); doc.setFontSize(fontSize); doc.setTextColor(BRAND.ink);
      doc.text(p.name, x + cellW / 2, y + cellH / 2 + 2, { align: "center" });
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

export async function exportSelectedPDF(company: any, list: any[], categoryCovers: Record<string, string> = {}, contact?: any, companyFields?: CompanyFooterFields) {
  const doc = await newDoc();
  const tpls = await loadTemplates("portfolio");
  const logo = company?.logo_url ? await loadImg(company.logo_url) : null;
  const c = await resolveContact(contact);
  await addCover(doc, company, `Portfolio - ${list.length} Projects`, logo, tpls.cover);
  const page = { n: 1 };
  const groups = groupByType(list, true);
  for (const g of groups) {
    const coverUrl = categoryCovers[g.type] || g.items.find(p => p.cover_image)?.cover_image;
    const img = coverUrl ? await loadImg(coverUrl) : null;
    await addCategoryCover(doc, g.type, g.items.length, img, tpls.divider, coverUrl);
    page.n++;
    for (const p of g.items) await renderProject(doc, p, company, page, tpls.project);
  }
  await addClientsPage(doc, company, page);
  await addThankYou(doc, company, logo, tpls.thankyou, c, companyFields);
  doc.save(`SADECO-Portfolio.pdf`);
}

export async function exportFullProfilePDF(company: any, projects: any[], categoryCovers: Record<string, string> = {}, contact?: any, companyFields?: CompanyFooterFields) {
  const doc = await newDoc();
  const W = doc.internal.pageSize.getWidth();
  const tpls = await loadTemplates("profile");
  const logo = company?.logo_url ? await loadImg(company.logo_url) : null;
  const c = await resolveContact(contact);
  await addCover(doc, company, "Company Profile", logo, tpls.cover);
  const page = { n: 1 };

  // About page
  doc.addPage(); page.n++;
  addPageHeader(doc, company);
  const H = doc.internal.pageSize.getHeight();
  let y = sectionTitle(doc, "Introduction", "About " + (company?.name || "SADECO"), 28);
  doc.setFont("Montserrat", "normal"); doc.setFontSize(12); doc.setTextColor(BRAND.ink);
  const about = doc.splitTextToSize(company?.about || "", W - 30);
  for (const ln of about) {
    if (y > H - 25) { addPageFooter(doc, company, page.n); doc.addPage(); page.n++; addPageHeader(doc, company); y = 28; }
    doc.text(ln, 15, y); y += 6;
  }
  y += 10;

  if (y > H - 50) { addPageFooter(doc, company, page.n); doc.addPage(); page.n++; addPageHeader(doc, company); y = 28; }
  doc.setFont("Montserrat", "bold"); doc.setFontSize(9); doc.setTextColor(BRAND.muted);
  doc.text("CONTACT", 15, y, { charSpace: 3 }); y += 7;
  doc.setFontSize(10); doc.setFont("Montserrat", "normal"); doc.setTextColor(BRAND.ink);
  ([["Phone", company?.phone], ["Email", company?.email], ["Website", company?.website], ["Address", company?.address]] as [string, string][])
    .filter(([_, v]) => v).forEach(([k, v]) => {
      const lines = doc.splitTextToSize(String(v), W - 60);
      if (y + lines.length * 6 > H - 18) { addPageFooter(doc, company, page.n); doc.addPage(); page.n++; addPageHeader(doc, company); y = 28; }
      doc.setTextColor(BRAND.muted); doc.text(k, 15, y);
      doc.setTextColor(BRAND.ink); doc.text(lines, 45, y); y += lines.length * 6;
    });
  addPageFooter(doc, company, page.n);

  // Services page
  doc.addPage(); page.n++;
  addPageHeader(doc, company);
  y = sectionTitle(doc, "Capabilities", "Our Services", 28);
  doc.setFontSize(13); doc.setFont("Montserrat", "normal"); doc.setTextColor(BRAND.ink);
  (company?.services || []).forEach((s: string) => {
    const lines = doc.splitTextToSize(s, W - 35);
    if (y + lines.length * 6 > H - 18) { addPageFooter(doc, company, page.n); doc.addPage(); page.n++; addPageHeader(doc, company); y = 28; }
    doc.text(BULLET, 15, y);
    doc.text(lines, 22, y); y += lines.length * 6 + 3;
  });
  addPageFooter(doc, company, page.n);

  const groups = groupByType(projects);
  for (const g of groups) {
    const coverUrl = categoryCovers[g.type] || g.items.find(p => p.cover_image)?.cover_image;
    const img = coverUrl ? await loadImg(coverUrl) : null;
    await addCategoryCover(doc, g.type, g.items.length, img, tpls.divider, coverUrl);
    page.n++;
    for (const p of g.items) await renderProject(doc, p, company, page, tpls.project);
  }

  await addClientsPage(doc, company, page);
  await addThankYou(doc, company, logo, tpls.thankyou, c, companyFields);
  doc.save(`SADECO-Company-Profile.pdf`);
}

export async function exportProjectPDF(p: any, company: any, contact?: any, companyFields?: CompanyFooterFields) {
  const doc = await newDoc();
  const tpls = await loadTemplates("project");
  const logo = company?.logo_url ? await loadImg(company.logo_url) : null;
  const c = await resolveContact(contact);
  await addCover(doc, company, "Project Case Study", logo, tpls.cover);
  const page = { n: 1 };
  await renderProject(doc, p, company, page, tpls.project);
  await addThankYou(doc, company, logo, tpls.thankyou, c, companyFields);
  doc.save(`SADECO-${p.name.replace(/\s+/g, "-")}.pdf`);
}
