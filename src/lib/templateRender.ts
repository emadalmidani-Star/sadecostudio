import jsPDF from "jspdf";

export type Slot = {
  field: string;
  x: number; y: number; w: number; h: number; // percent of page (0-100)
  fontSize?: number;
  align?: "left" | "center" | "right";
  bold?: boolean;
  color?: string;
};

export type Template = {
  page_type: "cover" | "divider" | "project" | "thankyou" | "idcard";
  background_url: string | null;
  slots: Slot[];
};

export const FIELDS_BY_TYPE: Record<Template["page_type"], { field: string; kind: "text" | "image"; label: string }[]> = {
  idcard: [
    { field: "member_name", kind: "text", label: "Member name" },
    { field: "member_title", kind: "text", label: "Job title" },
    { field: "member_email", kind: "text", label: "Email" },
    { field: "member_phone", kind: "text", label: "Phone" },
    { field: "member_whatsapp", kind: "text", label: "WhatsApp" },
    { field: "company_name", kind: "text", label: "Company name" },
    { field: "company_website", kind: "text", label: "Website" },
    { field: "company_phone", kind: "text", label: "Company phone" },
    { field: "member_photo", kind: "image", label: "Member photo" },
    { field: "company_logo", kind: "image", label: "Company logo" },
    { field: "qr_code", kind: "image", label: "QR code" },
  ],
  cover: [
    { field: "company_name", kind: "text", label: "Company name" },
    { field: "subtitle", kind: "text", label: "Subtitle" },
    { field: "date", kind: "text", label: "Date" },
    { field: "logo", kind: "image", label: "Logo" },
  ],
  divider: [
    { field: "category_title", kind: "text", label: "Category title" },
    { field: "category_subtitle", kind: "text", label: "Project count" },
    { field: "category_image", kind: "image", label: "Category image" },
  ],
  project: [
    { field: "project_title", kind: "text", label: "Project title" },
    { field: "project_type", kind: "text", label: "Type" },
    { field: "client", kind: "text", label: "Client" },
    { field: "location", kind: "text", label: "Location" },
    { field: "area", kind: "text", label: "Area" },
    { field: "status", kind: "text", label: "Status" },
    { field: "description", kind: "text", label: "Description" },
    { field: "highlights", kind: "text", label: "Highlights" },
    { field: "cover_image", kind: "image", label: "Cover image" },
    { field: "gallery_1", kind: "image", label: "Gallery 1" },
    { field: "gallery_2", kind: "image", label: "Gallery 2" },
    { field: "gallery_3", kind: "image", label: "Gallery 3" },
    { field: "gallery_4", kind: "image", label: "Gallery 4" },
  ],
  thankyou: [
    { field: "company_name", kind: "text", label: "Company name" },
    { field: "contact", kind: "text", label: "Contact line" },
    { field: "logo", kind: "image", label: "Logo" },
  ],
};

export async function loadImage(url: string): Promise<{ data: string; w: number; h: number } | null> {
  try {
    const res = await fetch(url, { mode: "cors" });
    const blob = await res.blob();
    const data = await new Promise<string>((r) => { const fr = new FileReader(); fr.onload = () => r(fr.result as string); fr.readAsDataURL(blob); });
    const dim = await new Promise<{ w: number; h: number }>((r) => { const i = new Image(); i.onload = () => r({ w: i.width, h: i.height }); i.onerror = () => r({ w: 1, h: 1 }); i.src = data; });
    return { data, ...dim };
  } catch { return null; }
}

function fmt(s?: string | null) { return s ? s.charAt(0).toUpperCase() + s.slice(1) : ""; }

function resolveText(field: string, ctx: any): string {
  const { project: p, company: c, category, count } = ctx;
  switch (field) {
    case "company_name": return c?.name || "";
    case "subtitle": return ctx.subtitle || "";
    case "date": return new Date().toLocaleDateString("en-US", { year: "numeric", month: "long" });
    case "category_title": return fmt(category) || "";
    case "category_subtitle": return count != null ? `${count} project${count === 1 ? "" : "s"}` : "";
    case "project_title": return p?.name || "";
    case "project_type": return fmt(p?.type) || "";
    case "client": return p?.client_name || "";
    case "location": return p?.location || "";
    case "area": return p?.area_sqm ? `${p.area_sqm} sqm` : "";
    case "status": return fmt(p?.status) || "";
    case "description": return p?.description || "";
    case "highlights": return (p?.highlights || []).map((h: string) => "• " + h).join("\n");
    case "contact": return [c?.phone, c?.email, c?.website].filter(Boolean).join("   |   ");
    default: return "";
  }
}

function resolveImageUrl(field: string, ctx: any): string | null {
  const { project: p, company: c } = ctx;
  if (field === "logo") return c?.logo_url || null;
  if (field === "cover_image") return p?.cover_image || null;
  if (field === "category_image") return ctx.categoryImageUrl || null;
  if (field.startsWith("gallery_")) {
    const idx = parseInt(field.split("_")[1], 10) - 1;
    const gallery = (p?.images || []).filter((u: string) => u !== p?.cover_image);
    return gallery[idx] || null;
  }
  return null;
}

export async function renderTemplatePage(
  doc: jsPDF,
  tpl: Template,
  ctx: any
) {
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();

  if (tpl.background_url) {
    const bg = await loadImage(tpl.background_url);
    if (bg) doc.addImage(bg.data, "JPEG", 0, 0, W, H);
  }

  for (const slot of tpl.slots) {
    const x = (slot.x / 100) * W;
    const y = (slot.y / 100) * H;
    const w = (slot.w / 100) * W;
    const h = (slot.h / 100) * H;
    const meta = FIELDS_BY_TYPE[tpl.page_type].find(f => f.field === slot.field);
    if (!meta) continue;

    if (meta.kind === "image") {
      const url = resolveImageUrl(slot.field, ctx);
      if (!url) continue;
      const img = await loadImage(url);
      if (!img) continue;
      const ar = img.w / img.h, slotAr = w / h;
      let iw = w, ih = h;
      if (ar > slotAr) { ih = w / ar; } else { iw = h * ar; }
      doc.addImage(img.data, "JPEG", x + (w - iw) / 2, y + (h - ih) / 2, iw, ih);
    } else {
      const text = resolveText(slot.field, ctx);
      if (!text) continue;
      const fs = slot.fontSize || 12;
      doc.setFont("Montserrat", slot.bold ? "bold" : "normal");
      doc.setFontSize(fs);
      doc.setTextColor(slot.color || "#000000");
      const align = slot.align || "left";
      const tx = align === "center" ? x + w / 2 : align === "right" ? x + w : x;
      const lines = doc.splitTextToSize(text, w);
      const lh = fs * 0.45;
      lines.forEach((ln: string, i: number) => {
        const ty = y + lh + i * lh;
        if (ty > y + h) return;
        doc.text(ln, tx, ty, { align });
      });
    }
  }
}
