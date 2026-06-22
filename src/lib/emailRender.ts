// Render block-based email templates to HTML.
// Shared between the in-app preview and the edge-function sender.

export type SocialPlatform = "instagram" | "facebook" | "linkedin" | "youtube" | "tiktok" | "twitter" | "website";
export type EmailBlock =
  | { type: "heading"; text: string; level?: 1 | 2 | 3 }
  | { type: "text"; text: string }
  | { type: "image"; url: string; alt?: string; width?: number }
  | { type: "button"; text: string; url: string }
  | { type: "divider" }
  | { type: "spacer"; height?: number }
  | { type: "video"; url: string; thumbnail: string; title?: string }
  | { type: "gallery"; images: { url: string; alt?: string; caption?: string }[]; layout?: "grid" | "side" }
  | { type: "social"; links: { platform: SocialPlatform; url: string }[] };

export type EmailTemplate = {
  preset?: "brand" | "minimal";
  subject?: string;
  preheader?: string;
  blocks: EmailBlock[];
};

export type RenderContext = {
  siteName?: string;
  logoUrl?: string | null;
  physicalAddress?: string | null;
  unsubscribeUrl: string;
  recipientName?: string | null;
};

const esc = (s: string) =>
  String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

const interp = (s: string, ctx: RenderContext) =>
  s
    .split("{{name}}").join(esc(ctx.recipientName || "there"))
    .split("{{site}}").join(esc(ctx.siteName || ""));

const BRAND = {
  bg: "#0b0d10",
  card: "#11141a",
  text: "#e7e4dc",
  muted: "#9a958a",
  accent: "#c9a84c",
  border: "#1f242c",
};

const MINIMAL = {
  bg: "#ffffff",
  card: "#ffffff",
  text: "#222222",
  muted: "#666666",
  accent: "#0d0d0d",
  border: "#e6e6e6",
};

export function renderBlocks(tpl: EmailTemplate, ctx: RenderContext): string {
  const p = tpl.preset === "minimal" ? MINIMAL : BRAND;
  const isBrand = tpl.preset !== "minimal";

  const header = isBrand
    ? `<div style="padding:24px;text-align:center;background:${p.card};border-bottom:1px solid ${p.border};">
        ${ctx.logoUrl ? `<img src="${esc(ctx.logoUrl)}" alt="${esc(ctx.siteName || "")}" style="max-height:48px;display:inline-block"/>` : `<div style="font-family:Georgia,serif;font-size:22px;color:${p.accent};letter-spacing:.2em">${esc(ctx.siteName || "")}</div>`}
      </div>`
    : `<div style="padding:24px 0;border-bottom:1px solid ${p.border};">
        <div style="font-family:Georgia,serif;font-size:18px;color:${p.text}">${esc(ctx.siteName || "")}</div>
      </div>`;

  const body = (tpl.blocks || [])
    .map((b) => {
      switch (b.type) {
        case "heading": {
          const size = b.level === 3 ? 16 : b.level === 2 ? 20 : 26;
          return `<h${b.level || 1} style="margin:24px 0 12px;font-family:Georgia,serif;font-weight:600;font-size:${size}px;color:${p.text};line-height:1.25">${esc(interp(b.text, ctx))}</h${b.level || 1}>`;
        }
        case "text":
          return `<p style="margin:0 0 16px;font-size:15px;line-height:1.65;color:${p.text}">${esc(interp(b.text, ctx)).split("\n").join("<br/>")}</p>`;
        case "image":
          return `<div style="margin:20px 0;text-align:center"><img src="${esc(b.url)}" alt="${esc(b.alt || "")}" style="max-width:${b.width || 560}px;width:100%;height:auto;border-radius:4px;display:inline-block"/></div>`;
        case "button":
          return `<div style="margin:24px 0;text-align:center"><a href="${esc(b.url)}" style="display:inline-block;padding:12px 28px;background:${p.accent};color:${isBrand ? "#0b0d10" : "#ffffff"};text-decoration:none;font-weight:600;font-size:14px;letter-spacing:.05em;border-radius:2px">${esc(interp(b.text, ctx))}</a></div>`;
        case "divider":
          return `<hr style="border:none;border-top:1px solid ${p.border};margin:24px 0"/>`;
        case "spacer":
          return `<div style="height:${b.height || 24}px"></div>`;
        default:
          return "";
      }
    })
    .join("");

  const footer = `<div style="padding:24px;text-align:center;border-top:1px solid ${p.border};color:${p.muted};font-size:12px;line-height:1.6">
    ${ctx.physicalAddress ? `<div style="margin-bottom:8px">${esc(ctx.physicalAddress)}</div>` : ""}
    <div>You received this email because you opted in. <a href="${esc(ctx.unsubscribeUrl)}" style="color:${p.muted};text-decoration:underline">Unsubscribe</a></div>
  </div>`;

  const preheader = tpl.preheader
    ? `<div style="display:none;visibility:hidden;opacity:0;height:0;width:0;overflow:hidden;max-height:0;mso-hide:all">${esc(tpl.preheader)}</div>`
    : "";

  return `<!doctype html><html><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><title>${esc(tpl.subject || "")}</title></head>
<body style="margin:0;padding:0;background:${p.bg};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
${preheader}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${p.bg};padding:32px 16px">
  <tr><td align="center">
    <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:${p.card};border:1px solid ${p.border};border-radius:8px;overflow:hidden">
      <tr><td>${header}</td></tr>
      <tr><td style="padding:8px 32px 24px">${body}</td></tr>
      <tr><td>${footer}</td></tr>
    </table>
  </td></tr>
</table>
</body></html>`;
}

export function defaultBlocks(preset: "brand" | "minimal"): EmailBlock[] {
  if (preset === "minimal") {
    return [
      { type: "heading", text: "Hi {{name}},", level: 2 },
      { type: "text", text: "Quick note from {{site}}. Replace this with whatever you want to say.\n\nKeep it short and personal — text-only emails land in the inbox more reliably than image-heavy ones." },
      { type: "text", text: "— The {{site}} team" },
    ];
  }
  return [
    { type: "heading", text: "Hello {{name}}" },
    { type: "text", text: "Welcome to our latest update. Replace this content with your message." },
    { type: "image", url: "https://images.unsplash.com/photo-1505691938895-1758d7feb511?w=1200&q=60", alt: "Cover" },
    { type: "button", text: "Read more", url: "https://example.com" },
    { type: "divider" },
    { type: "text", text: "Thanks for being part of our community." },
  ];
}
