import jsPDF from "jspdf";

// Brand: pure black & white from SADECO logo
const BRAND = { ink: "#000000", paper: "#ffffff", muted: "#666666", line: "#000000" };
// Bullet that renders safely in jsPDF's standard WinAnsi fonts
const BULLET = "-";

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

function newDoc() {
  // Landscape A4
  return new jsPDF({ unit: "mm", format: "a4", orientation: "landscape" });
}

function addCover(doc: jsPDF, company: any, subtitle: string, logo: any) {
  const W = doc.internal.pageSize.getWidth(), H = doc.internal.pageSize.getHeight();
  doc.setFillColor(BRAND.paper); doc.rect(0, 0, W, H, "F");
  // black band on the left
  doc.setFillColor(BRAND.ink); doc.rect(0, 0, W * 0.38, H, "F");
  if (logo) {
    const ratio = logo.w / logo.h; const w = 60; const h = w / ratio;
    doc.addImage(logo.data, "PNG", (W * 0.38 - w) / 2, H / 2 - h / 2, w, h);
  }
  // right side
  doc.setTextColor(BRAND.ink); doc.setFont("helvetica", "bold"); doc.setFontSize(48);
  doc.text(company?.name || "SADECO", W * 0.42, H / 2 - 6);
  doc.setFont("helvetica", "normal"); doc.setFontSize(12); doc.setTextColor(BRAND.muted);
  doc.text(subtitle.toUpperCase(), W * 0.42, H / 2 + 6, { charSpace: 2 });
  // accent rule
  doc.setDrawColor(BRAND.ink); doc.setLineWidth(0.6); doc.line(W * 0.42, H / 2 + 12, W * 0.42 + 30, H / 2 + 12);
  doc.setFontSize(9); doc.setTextColor(BRAND.muted);
  doc.text(new Date().toLocaleDateString("en-US", { year: "numeric", month: "long" }), W * 0.42, H - 18);
}

function addPageHeader(doc: jsPDF, company: any) {
  const W = doc.internal.pageSize.getWidth();
  doc.setTextColor(BRAND.ink); doc.setFontSize(9); doc.setFont("helvetica", "bold");
  doc.text((company?.name || "SADECO").toUpperCase(), 15, 12, { charSpace: 2 });
  doc.setDrawColor(BRAND.ink); doc.setLineWidth(0.4); doc.line(15, 15, W - 15, 15);
}

function addPageFooter(doc: jsPDF, company: any, page: number) {
  const W = doc.internal.pageSize.getWidth(), H = doc.internal.pageSize.getHeight();
  doc.setDrawColor(BRAND.ink); doc.setLineWidth(0.2); doc.line(15, H - 12, W - 15, H - 12);
  doc.setFontSize(8); doc.setTextColor(BRAND.muted); doc.setFont("helvetica", "normal");
  doc.text(company?.website || company?.email || "", 15, H - 7);
  doc.text(String(page), W - 15, H - 7, { align: "right" });
}

function sectionTitle(doc: jsPDF, label: string, title: string, y: number) {
  doc.setFontSize(8); doc.setTextColor(BRAND.muted); doc.setFont("helvetica", "normal");
  doc.text(label.toUpperCase(), 15, y, { charSpace: 3 });
  doc.setFontSize(26); doc.setTextColor(BRAND.ink); doc.setFont("helvetica", "bold");
  doc.text(title, 15, y + 11);
  doc.setDrawColor(BRAND.ink); doc.setLineWidth(0.4); doc.line(15, y + 14, 50, y + 14);
  return y + 22;
}

function addThankYou(doc: jsPDF, company: any, logo: any) {
  doc.addPage();
  const W = doc.internal.pageSize.getWidth(), H = doc.internal.pageSize.getHeight();
  doc.setFillColor(BRAND.ink); doc.rect(0, 0, W, H, "F");
  if (logo) {
    const ratio = logo.w / logo.h; const w = 50; const h = w / ratio;
    doc.addImage(logo.data, "PNG", (W - w) / 2, H / 2 - h - 30, w, h);
  }
  doc.setTextColor(BRAND.paper); doc.setFont("helvetica", "bold"); doc.setFontSize(64);
  doc.text("Thank You", W / 2, H / 2 + 5, { align: "center" });
  doc.setFont("helvetica", "normal"); doc.setFontSize(11); doc.setTextColor("#bbbbbb");
  doc.text("We look forward to building with you.", W / 2, H / 2 + 18, { align: "center" });

  // contact row
  const parts = [company?.phone, company?.email, company?.website].filter(Boolean).join("   |   ");
  doc.setFontSize(9); doc.setTextColor("#cccccc");
  doc.text(parts, W / 2, H - 20, { align: "center" });
}

async function renderProject(doc: jsPDF, p: any, company: any, page: { n: number }) {
  const W = doc.internal.pageSize.getWidth(), H = doc.internal.pageSize.getHeight();
  const cover = p.cover_image ? await loadImg(p.cover_image) : null;

  // Hero page (landscape split)
  doc.addPage(); page.n++;
  if (cover) {
    const halfW = W * 0.6;
    doc.addImage(cover.data, "JPEG", 0, 0, halfW, H);
    doc.setFillColor(BRAND.paper); doc.rect(halfW, 0, W - halfW, H, "F");
    const tx = halfW + 12;
    doc.setFontSize(9); doc.setTextColor(BRAND.muted); doc.setFont("helvetica", "normal");
    doc.text(fmt(p.type).toUpperCase(), tx, 30, { charSpace: 2 });
    doc.setFontSize(28); doc.setFont("helvetica", "bold"); doc.setTextColor(BRAND.ink);
    const lines = doc.splitTextToSize(p.name, W - halfW - 20);
    doc.text(lines, tx, 44);
    doc.setDrawColor(BRAND.ink); doc.line(tx, 44 + lines.length * 10, tx + 25, 44 + lines.length * 10);
    doc.setFontSize(10); doc.setTextColor(BRAND.muted); doc.setFont("helvetica", "normal");
    doc.text(p.location || "", tx, 44 + lines.length * 10 + 8);
  } else {
    doc.setFillColor(BRAND.ink); doc.rect(0, 0, W, H, "F");
    doc.setTextColor(BRAND.paper); doc.setFontSize(10); doc.setFont("helvetica", "normal");
    doc.text(fmt(p.type).toUpperCase(), 20, H / 2 - 14, { charSpace: 3 });
    doc.setFontSize(40); doc.setFont("helvetica", "bold");
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
  doc.setFontSize(8); doc.setFont("helvetica", "normal");
  const colW = (W - 30) / facts.length;
  facts.forEach((f, i) => {
    doc.setTextColor(BRAND.muted); doc.text(f[0].toUpperCase(), 15 + i * colW, y, { charSpace: 1.5 });
    doc.setTextColor(BRAND.ink); doc.setFont("helvetica", "bold"); doc.setFontSize(11);
    doc.text(f[1], 15 + i * colW, y + 6);
    doc.setFont("helvetica", "normal"); doc.setFontSize(8);
  });
  y += 16;
  doc.setDrawColor(BRAND.ink); doc.setLineWidth(0.2); doc.line(15, y, W - 15, y); y += 10;

  doc.setFont("helvetica", "normal"); doc.setFontSize(11); doc.setTextColor(BRAND.ink);
  const descLines = doc.splitTextToSize(p.description || "No description available.", W - 30);
  doc.text(descLines, 15, y); y += descLines.length * 5.5 + 8;

  if (p.highlights?.length) {
    doc.setFontSize(9); doc.setTextColor(BRAND.muted); doc.setFont("helvetica", "bold");
    doc.text("KEY HIGHLIGHTS", 15, y, { charSpace: 3 }); y += 7;
    doc.setFontSize(10); doc.setFont("helvetica", "normal"); doc.setTextColor(BRAND.ink);
    p.highlights.forEach((h: string) => {
      if (y > H - 25) { addPageFooter(doc, company, page.n); doc.addPage(); page.n++; addPageHeader(doc, company); y = 28; }
      doc.text(BULLET, 15, y);
      const hl = doc.splitTextToSize(h, W - 35);
      doc.text(hl, 22, y); y += hl.length * 5 + 2;
    });
  }
  addPageFooter(doc, company, page.n);

  // Gallery
  const gallery = (p.images || []).filter((u: string) => u !== p.cover_image);
  if (gallery.length) {
    doc.addPage(); page.n++;
    addPageHeader(doc, company);
    let yy = sectionTitle(doc, "Gallery", "Visual Story", 28);
    const cols = 3, gap = 5, imgW = (W - 30 - gap * (cols - 1)) / cols, imgH = imgW * 0.7;
    let x = 15, col = 0;
    for (let i = 0; i < gallery.length; i++) {
      const img = await loadImg(gallery[i]);
      if (!img) continue;
      if (yy + imgH > H - 20) {
        addPageFooter(doc, company, page.n);
        doc.addPage(); page.n++; addPageHeader(doc, company); yy = 28; x = 15; col = 0;
      }
      doc.addImage(img.data, "JPEG", x, yy, imgW, imgH);
      col++;
      if (col >= cols) { col = 0; x = 15; yy += imgH + gap; }
      else { x += imgW + gap; }
    }
    addPageFooter(doc, company, page.n);
  }
}

export async function exportProjectPDF(p: any, company: any) {
  const doc = newDoc();
  const logo = company?.logo_url ? await loadImg(company.logo_url) : null;
  addCover(doc, company, "Project Case Study", logo);
  const page = { n: 1 };
  await renderProject(doc, p, company, page);
  addThankYou(doc, company, logo);
  doc.save(`SADECO-${p.name.replace(/\s+/g, "-")}.pdf`);
}

export async function exportSelectedPDF(company: any, list: any[]) {
  const doc = newDoc();
  const logo = company?.logo_url ? await loadImg(company.logo_url) : null;
  addCover(doc, company, `Portfolio - ${list.length} Projects`, logo);
  const page = { n: 1 };
  for (const p of list) await renderProject(doc, p, company, page);
  addThankYou(doc, company, logo);
  doc.save(`SADECO-Portfolio.pdf`);
}

export async function exportFullProfilePDF(company: any, projects: any[]) {
  const doc = newDoc();
  const W = doc.internal.pageSize.getWidth();
  const logo = company?.logo_url ? await loadImg(company.logo_url) : null;
  addCover(doc, company, "Company Profile", logo);
  const page = { n: 1 };

  // About page
  doc.addPage(); page.n++;
  addPageHeader(doc, company);
  let y = sectionTitle(doc, "Introduction", "About " + (company?.name || "SADECO"), 28);
  doc.setFont("helvetica", "normal"); doc.setFontSize(12); doc.setTextColor(BRAND.ink);
  const about = doc.splitTextToSize(company?.about || "", W - 30);
  doc.text(about, 15, y); y += about.length * 6 + 10;

  doc.setFont("helvetica", "bold"); doc.setFontSize(9); doc.setTextColor(BRAND.muted);
  doc.text("CONTACT", 15, y, { charSpace: 3 }); y += 7;
  doc.setFontSize(10); doc.setFont("helvetica", "normal"); doc.setTextColor(BRAND.ink);
  [["Phone", company?.phone], ["Email", company?.email], ["Website", company?.website], ["Address", company?.address]]
    .filter(([_, v]) => v).forEach(([k, v]) => {
      doc.setTextColor(BRAND.muted); doc.text(`${k}`, 15, y);
      doc.setTextColor(BRAND.ink); doc.text(String(v), 45, y); y += 6;
    });
  addPageFooter(doc, company, page.n);

  // Services page
  doc.addPage(); page.n++;
  addPageHeader(doc, company);
  y = sectionTitle(doc, "Capabilities", "Our Services", 28);
  doc.setFontSize(13); doc.setFont("helvetica", "normal"); doc.setTextColor(BRAND.ink);
  (company?.services || []).forEach((s: string) => {
    doc.text(BULLET, 15, y);
    doc.text(s, 22, y); y += 9;
  });
  addPageFooter(doc, company, page.n);

  for (const p of projects) await renderProject(doc, p, company, page);

  addThankYou(doc, company, logo);
  doc.save(`SADECO-Company-Profile.pdf`);
}
