import jsPDF from "jspdf";

const BRAND = { ink: "#141414", accent: "#B89368", muted: "#666666", paper: "#FAF8F4" };

async function loadImg(url: string): Promise<{ data: string; w: number; h: number } | null> {
  try {
    const res = await fetch(url, { mode: "cors" });
    const blob = await res.blob();
    const data = await new Promise<string>((r) => { const fr = new FileReader(); fr.onload = () => r(fr.result as string); fr.readAsDataURL(blob); });
    const dim = await new Promise<{ w: number; h: number }>((r) => { const i = new Image(); i.onload = () => r({ w: i.width, h: i.height }); i.onerror = () => r({ w: 1, h: 1 }); i.src = data; });
    return { data, ...dim };
  } catch { return null; }
}

function fmt(s?: string | null) { return s ? s.charAt(0).toUpperCase() + s.slice(1) : ""; }

function addCover(doc: jsPDF, company: any, subtitle: string, logo: any) {
  const W = doc.internal.pageSize.getWidth(), H = doc.internal.pageSize.getHeight();
  doc.setFillColor(BRAND.ink); doc.rect(0, 0, W, H, "F");
  // accent line
  doc.setDrawColor(BRAND.accent); doc.setLineWidth(0.8); doc.line(20, 40, 60, 40);
  if (logo) {
    const ratio = logo.w / logo.h; const w = 80; const h = w / ratio;
    doc.addImage(logo.data, "PNG", (W - w) / 2, H / 2 - h - 20, w, h);
  }
  doc.setTextColor("#ffffff"); doc.setFont("times", "normal"); doc.setFontSize(36);
  doc.text(company?.name || "SADECO", W / 2, H / 2 + 10, { align: "center" });
  doc.setFontSize(11); doc.setTextColor(BRAND.accent);
  doc.text(subtitle.toUpperCase(), W / 2, H / 2 + 22, { align: "center", charSpace: 3 });
  doc.setFontSize(9); doc.setTextColor("#999");
  doc.text(new Date().toLocaleDateString("en-US", { year: "numeric", month: "long" }), W / 2, H - 25, { align: "center" });
}

function addPageHeader(doc: jsPDF, company: any) {
  const W = doc.internal.pageSize.getWidth();
  doc.setTextColor(BRAND.muted); doc.setFontSize(8); doc.setFont("helvetica", "normal");
  doc.text((company?.name || "SADECO").toUpperCase(), 20, 12, { charSpace: 2 });
  doc.setDrawColor(BRAND.accent); doc.setLineWidth(0.3); doc.line(20, 15, W - 20, 15);
}

function addPageFooter(doc: jsPDF, company: any, page: number, total?: number) {
  const W = doc.internal.pageSize.getWidth(), H = doc.internal.pageSize.getHeight();
  doc.setDrawColor("#eee"); doc.setLineWidth(0.2); doc.line(20, H - 15, W - 20, H - 15);
  doc.setFontSize(7); doc.setTextColor(BRAND.muted);
  doc.text(company?.website || company?.email || "", 20, H - 9);
  doc.text(total ? `${page} / ${total}` : `${page}`, W - 20, H - 9, { align: "right" });
}

function sectionTitle(doc: jsPDF, label: string, title: string, y: number) {
  doc.setFontSize(8); doc.setTextColor(BRAND.accent); doc.setFont("helvetica", "normal");
  doc.text(label.toUpperCase(), 20, y, { charSpace: 3 });
  doc.setFontSize(24); doc.setTextColor(BRAND.ink); doc.setFont("times", "normal");
  doc.text(title, 20, y + 10);
  return y + 18;
}

async function renderProject(doc: jsPDF, p: any, company: any, page: { n: number }) {
  const W = doc.internal.pageSize.getWidth(), H = doc.internal.pageSize.getHeight();
  const cover = p.cover_image ? await loadImg(p.cover_image) : null;

  // Hero page
  doc.addPage(); page.n++;
  if (cover) {
    const ratio = cover.h / cover.w; const w = W; const h = Math.min(W * ratio, H * 0.55);
    doc.addImage(cover.data, "JPEG", 0, 0, w, h);
    doc.setFillColor(BRAND.ink); doc.rect(0, h, W, H - h, "F");
    doc.setTextColor("#fff");
    doc.setFontSize(8); doc.setTextColor(BRAND.accent);
    doc.text(fmt(p.type).toUpperCase(), 20, h + 14, { charSpace: 3 });
    doc.setFontSize(28); doc.setFont("times", "normal"); doc.setTextColor("#fff");
    const lines = doc.splitTextToSize(p.name, W - 40);
    doc.text(lines, 20, h + 26);
    doc.setFontSize(10); doc.setTextColor("#bbb"); doc.setFont("helvetica", "normal");
    doc.text(p.location || "", 20, h + 26 + lines.length * 10);
  } else {
    doc.setFillColor(BRAND.ink); doc.rect(0, 0, W, H, "F");
    doc.setTextColor("#fff"); doc.setFontSize(8); doc.setTextColor(BRAND.accent);
    doc.text(fmt(p.type).toUpperCase(), 20, 60, { charSpace: 3 });
    doc.setFontSize(36); doc.setFont("times", "normal"); doc.setTextColor("#fff");
    doc.text(doc.splitTextToSize(p.name, W - 40), 20, 80);
  }
  addPageFooter(doc, company, page.n);

  // Detail page
  doc.addPage(); page.n++;
  addPageHeader(doc, company);
  let y = sectionTitle(doc, "Case Study", "Overview", 30);

  // Key facts row
  const facts = [
    ["Type", fmt(p.type)],
    ["Location", p.location || "—"],
    ["Area", p.area_sqm ? `${p.area_sqm} sqm` : "—"],
    ["Status", fmt(p.status)],
    ["Client", p.client_name || "Confidential"],
  ];
  doc.setFontSize(8); doc.setFont("helvetica", "normal");
  const colW = (W - 40) / facts.length;
  facts.forEach((f, i) => {
    doc.setTextColor(BRAND.muted); doc.text(f[0].toUpperCase(), 20 + i * colW, y, { charSpace: 1.5 });
    doc.setTextColor(BRAND.ink); doc.setFontSize(11);
    doc.text(f[1], 20 + i * colW, y + 6);
    doc.setFontSize(8);
  });
  y += 18;
  doc.setDrawColor("#eee"); doc.line(20, y, W - 20, y); y += 10;

  // Description
  doc.setFont("times", "italic"); doc.setFontSize(11); doc.setTextColor(BRAND.ink);
  const descLines = doc.splitTextToSize(p.description || "No description available.", W - 40);
  doc.text(descLines, 20, y); y += descLines.length * 5.5 + 8;

  // Highlights
  if (p.highlights?.length) {
    doc.setFontSize(8); doc.setTextColor(BRAND.accent); doc.setFont("helvetica", "normal");
    doc.text("KEY HIGHLIGHTS", 20, y, { charSpace: 3 }); y += 8;
    doc.setFontSize(10); doc.setTextColor(BRAND.ink);
    p.highlights.forEach((h: string) => {
      if (y > H - 30) { addPageFooter(doc, company, page.n); doc.addPage(); page.n++; addPageHeader(doc, company); y = 30; }
      doc.setTextColor(BRAND.accent); doc.text("◆", 20, y);
      doc.setTextColor(BRAND.ink);
      const hl = doc.splitTextToSize(h, W - 50);
      doc.text(hl, 28, y); y += hl.length * 5 + 3;
    });
  }
  addPageFooter(doc, company, page.n);

  // Gallery
  const gallery = (p.images || []).filter((u: string) => u !== p.cover_image);
  if (gallery.length) {
    doc.addPage(); page.n++;
    addPageHeader(doc, company);
    let yy = sectionTitle(doc, "Gallery", "Visual Story", 30);
    const cols = 2, gap = 6, imgW = (W - 40 - gap) / cols, imgH = imgW * 0.7;
    let x = 20;
    for (let i = 0; i < gallery.length; i++) {
      const img = await loadImg(gallery[i]);
      if (!img) continue;
      if (yy + imgH > H - 25) {
        addPageFooter(doc, company, page.n);
        doc.addPage(); page.n++; addPageHeader(doc, company); yy = 30; x = 20;
      }
      doc.addImage(img.data, "JPEG", x, yy, imgW, imgH);
      if (x + imgW + gap < W - 20) { x += imgW + gap; } else { x = 20; yy += imgH + gap; }
    }
    addPageFooter(doc, company, page.n);
  }
}

export async function exportProjectPDF(p: any, company: any) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const logo = company?.logo_url ? await loadImg(company.logo_url) : null;
  addCover(doc, company, "Project Case Study", logo);
  // remove default first blank page tracking
  const page = { n: 1 };
  await renderProject(doc, p, company, page);
  doc.save(`SADECO-${p.name.replace(/\s+/g, "-")}.pdf`);
}

export async function exportSelectedPDF(company: any, list: any[]) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const logo = company?.logo_url ? await loadImg(company.logo_url) : null;
  addCover(doc, company, `Portfolio · ${list.length} Projects`, logo);
  const page = { n: 1 };
  for (const p of list) await renderProject(doc, p, company, page);
  doc.save(`SADECO-Portfolio.pdf`);
}

export async function exportFullProfilePDF(company: any, projects: any[]) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const W = doc.internal.pageSize.getWidth(), H = doc.internal.pageSize.getHeight();
  const logo = company?.logo_url ? await loadImg(company.logo_url) : null;
  addCover(doc, company, "Company Profile", logo);
  const page = { n: 1 };

  // About page
  doc.addPage(); page.n++;
  addPageHeader(doc, company);
  let y = sectionTitle(doc, "Introduction", "About " + (company?.name || "SADECO"), 30);
  doc.setFont("times", "italic"); doc.setFontSize(12); doc.setTextColor(BRAND.ink);
  const about = doc.splitTextToSize(company?.about || "", W - 40);
  doc.text(about, 20, y); y += about.length * 6 + 10;

  // Contact
  doc.setFont("helvetica", "normal"); doc.setFontSize(8); doc.setTextColor(BRAND.accent);
  doc.text("CONTACT", 20, y, { charSpace: 3 }); y += 6;
  doc.setFontSize(10); doc.setTextColor(BRAND.ink);
  [["Phone", company?.phone], ["Email", company?.email], ["Website", company?.website], ["Address", company?.address]]
    .filter(([_, v]) => v).forEach(([k, v]) => {
      doc.setTextColor(BRAND.muted); doc.text(`${k}`, 20, y);
      doc.setTextColor(BRAND.ink); doc.text(String(v), 50, y); y += 6;
    });
  addPageFooter(doc, company, page.n);

  // Services page
  doc.addPage(); page.n++;
  addPageHeader(doc, company);
  y = sectionTitle(doc, "Capabilities", "Our Services", 30);
  doc.setFontSize(13); doc.setFont("times", "normal");
  (company?.services || []).forEach((s: string) => {
    doc.setTextColor(BRAND.accent); doc.text("◆", 20, y);
    doc.setTextColor(BRAND.ink); doc.text(s, 28, y); y += 9;
  });
  addPageFooter(doc, company, page.n);

  // Projects
  for (const p of projects) await renderProject(doc, p, company, page);

  doc.save(`SADECO-Company-Profile.pdf`);
}
