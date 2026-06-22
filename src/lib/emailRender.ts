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
  | { type: "video"; url: string; thumbnail: string; title?: string; playLabel?: string; alt?: string }
  | { type: "gallery"; images: { url: string; alt?: string; caption?: string }[]; layout?: "grid" | "side" }
  | { type: "social"; links: { platform: SocialPlatform; url: string }[]; iconStyle?: "color" | "mono" };

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

// Font stacks Outlook understands (Outlook desktop falls back to Times if it doesn't recognize the family — always end with Arial/Georgia).
const SANS = "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";
const SERIF = "Georgia,'Times New Roman',serif";

export function renderBlocks(tpl: EmailTemplate, ctx: RenderContext): string {
  const p = tpl.preset === "minimal" ? MINIMAL : BRAND;
  const isBrand = tpl.preset !== "minimal";
  const btnText = isBrand ? "#0b0d10" : "#ffffff";

  const header = isBrand
    ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${p.card};border-bottom:1px solid ${p.border};mso-table-lspace:0;mso-table-rspace:0"><tr><td align="center" style="padding:24px">
        ${ctx.logoUrl ? `<img src="${esc(ctx.logoUrl)}" alt="${esc(ctx.siteName || "")}" height="48" style="max-height:48px;display:inline-block;border:0;outline:none;text-decoration:none" border="0"/>` : `<div style="font-family:${SERIF};font-size:22px;color:${p.accent};letter-spacing:.2em;mso-line-height-rule:exactly;line-height:28px">${esc(ctx.siteName || "")}</div>`}
      </td></tr></table>`
    : `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-bottom:1px solid ${p.border};mso-table-lspace:0;mso-table-rspace:0"><tr><td style="padding:24px 0">
        <div style="font-family:${SERIF};font-size:18px;color:${p.text};mso-line-height-rule:exactly;line-height:24px">${esc(ctx.siteName || "")}</div>
      </td></tr></table>`;

  const body = (tpl.blocks || [])
    .map((b) => {
      switch (b.type) {
        case "heading": {
          const size = b.level === 3 ? 16 : b.level === 2 ? 20 : 26;
          const lh = Math.round(size * 1.25);
          return `<h${b.level || 1} style="margin:24px 0 12px;font-family:${SERIF};font-weight:600;font-size:${size}px;color:${p.text};mso-line-height-rule:exactly;line-height:${lh}px">${esc(interp(b.text, ctx))}</h${b.level || 1}>`;
        }
        case "text":
          return `<p style="margin:0 0 16px;font-family:${SANS};font-size:15px;mso-line-height-rule:exactly;line-height:24px;color:${p.text}">${esc(interp(b.text, ctx)).split("\n").join("<br/>")}</p>`;
        case "image":
          return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:20px 0;mso-table-lspace:0;mso-table-rspace:0"><tr><td align="center"><img src="${esc(b.url)}" alt="${esc(b.alt || "")}" width="${b.width || 560}" style="max-width:${b.width || 560}px;width:100%;height:auto;border:0;outline:none;text-decoration:none;display:block" border="0"/></td></tr></table>`;
        case "button": {
          const label = esc(interp(b.text, ctx));
          const href = esc(b.url);
          // VML for Outlook desktop + bullet-proof <a> for everything else
          return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:24px 0;mso-table-lspace:0;mso-table-rspace:0"><tr><td align="center">
<!--[if mso]>
<v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word" href="${href}" style="height:44px;v-text-anchor:middle;width:220px;" arcsize="6%" strokecolor="${p.accent}" fillcolor="${p.accent}">
  <w:anchorlock/>
  <center style="color:${btnText};font-family:Arial,sans-serif;font-size:14px;font-weight:bold;letter-spacing:1px;">${label}</center>
</v:roundrect>
<![endif]-->
<!--[if !mso]><!-- -->
<a href="${href}" style="display:inline-block;padding:12px 28px;background:${p.accent};color:${btnText};text-decoration:none;font-family:${SANS};font-weight:600;font-size:14px;letter-spacing:.05em;border-radius:2px;mso-hide:all">${label}</a>
<!--<![endif]-->
          </td></tr></table>`;
        }
        case "divider":
          return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:24px 0"><tr><td style="border-top:1px solid ${p.border};font-size:0;line-height:0">&nbsp;</td></tr></table>`;
        case "spacer":
          return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td height="${b.height || 24}" style="height:${b.height || 24}px;font-size:0;line-height:0">&nbsp;</td></tr></table>`;
        case "video": {
          const altText = b.alt || b.title || "Watch video";
          const playLabel = b.playLabel || "Watch video";
          // Outlook can't render absolute-positioned play badge — show overlay only for non-Outlook clients;
          // Outlook still gets the thumbnail + caption with a ▶ marker.
          const overlay = `<!--[if !mso]><!-- --><div class="lv-video-play" style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);width:68px;height:68px;border-radius:50%;background:rgba(0,0,0,.65);color:#ffffff;font-size:28px;line-height:68px;text-align:center" aria-label="${esc(playLabel)}">&#9658;</div><!--<![endif]-->`;
          return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" class="lv-video" style="margin:20px 0;mso-table-lspace:0;mso-table-rspace:0"><tr><td align="center">
            <a href="${esc(b.url)}" style="text-decoration:none;color:${p.text}">
              <div style="position:relative;display:inline-block;max-width:560px;width:100%">
                <img src="${esc(b.thumbnail)}" alt="${esc(altText)}" width="560" style="width:100%;max-width:560px;height:auto;border-radius:6px;display:block;border:0;outline:none;text-decoration:none" border="0"/>
                ${overlay}
              </div>
              <div style="margin-top:10px;font-family:${SANS};font-size:14px;color:${p.muted};mso-line-height-rule:exactly;line-height:20px">&#9658; ${esc(b.title ? `${b.title} — ${playLabel}` : playLabel)}</div>
            </a>
          </td></tr></table>`;
        }
        case "gallery": {
          const imgs = (b.images || []).slice(0, 4);
          if (imgs.length === 0) return "";
          const layout = b.layout || "side";
          const cell = (im: { url: string; alt?: string; caption?: string }, half = true) =>
            `<td class="lv-gallery-cell" ${half ? 'width="50%"' : ""} valign="top" style="padding:4px;vertical-align:top">
              <img src="${esc(im.url)}" alt="${esc(im.alt || "")}" width="270" style="width:100%;max-width:270px;height:auto;border-radius:4px;display:block;border:0;outline:none;text-decoration:none" border="0"/>
              ${im.caption ? `<div style="font-family:${SANS};font-size:12px;color:${p.muted};text-align:center;margin-top:6px;mso-line-height-rule:exactly;line-height:16px">${esc(im.caption)}</div>` : ""}
            </td>`;
          if (layout === "side" && imgs.length >= 2) {
            const two = imgs.slice(0, 2);
            return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" class="lv-gallery" style="margin:20px 0;mso-table-lspace:0;mso-table-rspace:0"><tr>${two.map(im => cell(im)).join("")}</tr></table>`;
          }
          const rows: typeof imgs[] = [];
          for (let i = 0; i < imgs.length; i += 2) rows.push(imgs.slice(i, i + 2));
          return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" class="lv-gallery" style="margin:20px 0;mso-table-lspace:0;mso-table-rspace:0">${rows.map(r => `<tr>${r.map(im => cell(im)).join("")}${r.length === 1 ? '<td width="50%">&nbsp;</td>' : ""}</tr>`).join("")}</table>`;
        }
        case "social": {
          const items = (b.links || []).filter(l => l.url);
          if (items.length === 0) return "";
          const labels: Record<SocialPlatform, string> = { instagram: "Instagram", facebook: "Facebook", linkedin: "LinkedIn", youtube: "YouTube", tiktok: "TikTok", twitter: "X", website: "Website" };
          const slugs: Record<SocialPlatform, string> = { instagram: "instagram-new", facebook: "facebook-new", linkedin: "linkedin", youtube: "youtube-play", tiktok: "tiktok", twitter: "twitterx", website: "domain" };
          const style = b.iconStyle || "color";
          const set = style === "color" ? "color" : (isBrand ? "ios-filled/ffffff" : "ios-filled/222222");
          // Use a table row with cells per icon so Outlook desktop spaces them correctly.
          return `<table role="presentation" align="center" cellpadding="0" cellspacing="0" border="0" class="lv-social" style="margin:24px auto;mso-table-lspace:0;mso-table-rspace:0"><tr>${items.map(l => {
            const label = esc(labels[l.platform] || l.platform);
            return `<td class="lv-social-link" align="center" style="padding:0 8px"><a href="${esc(l.url)}" style="text-decoration:none" aria-label="${label}"><img src="https://img.icons8.com/${set}/48/${slugs[l.platform] || "domain"}.png" alt="${label}" width="28" height="28" style="display:block;border:0;outline:none;text-decoration:none;width:28px;height:28px" border="0"/></a></td>`;
          }).join("")}</tr></table>`;
        }
        default:
          return "";
      }
    })
    .join("");

  const footer = `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-top:1px solid ${p.border};mso-table-lspace:0;mso-table-rspace:0"><tr><td align="center" style="padding:24px;font-family:${SANS};color:${p.muted};font-size:12px;mso-line-height-rule:exactly;line-height:18px">
    ${ctx.physicalAddress ? `<div style="margin-bottom:8px">${esc(ctx.physicalAddress)}</div>` : ""}
    <div>You received this email because you opted in. <a href="${esc(ctx.unsubscribeUrl)}" style="color:${p.muted};text-decoration:underline">Unsubscribe</a></div>
  </td></tr></table>`;

  const preheader = tpl.preheader
    ? `<div style="display:none;visibility:hidden;opacity:0;height:0;width:0;overflow:hidden;max-height:0;mso-hide:all">${esc(tpl.preheader)}</div>`
    : "";

  const headExtras = `
    <!--[if mso]>
    <xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch><o:AllowPNG/></o:OfficeDocumentSettings></xml>
    <![endif]-->
    <style>
      html,body{margin:0 !important;padding:0 !important;width:100% !important;}
      table{border-collapse:collapse;mso-table-lspace:0pt;mso-table-rspace:0pt;}
      img{-ms-interpolation-mode:bicubic;border:0;outline:none;text-decoration:none;display:block;}
      a{text-decoration:none;}
      /* iOS auto-link colors */
      a[x-apple-data-detectors]{color:inherit !important;text-decoration:none !important;}
      @media only screen and (max-width:480px) {
        .lv-container { padding: 16px 8px !important; }
        .lv-body { padding: 8px 16px 16px !important; }
        .lv-video { margin: 14px 0 !important; }
        .lv-video-play { width:54px !important; height:54px !important; line-height:54px !important; font-size:22px !important; }
        .lv-gallery { margin: 14px 0 !important; }
        .lv-gallery-cell { display:block !important; width:100% !important; padding:6px 0 !important; }
        .lv-social { margin: 18px auto !important; }
        .lv-social-link { padding:0 6px !important; }
        .lv-social-link img { width:24px !important; height:24px !important; }
      }
    </style>`;

  return `<!doctype html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office" lang="en">
<head>
  <meta charset="utf-8"/>
  <meta http-equiv="X-UA-Compatible" content="IE=edge"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <meta name="format-detection" content="telephone=no,address=no,email=no,date=no,url=no"/>
  <title>${esc(tpl.subject || "")}</title>
  ${headExtras}
</head>
<body style="margin:0;padding:0;background:${p.bg};font-family:${SANS};">
${preheader}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" class="lv-container" style="background:${p.bg};padding:32px 16px;mso-table-lspace:0;mso-table-rspace:0">
  <tr><td align="center">
    <!--[if mso | IE]><table role="presentation" align="center" cellpadding="0" cellspacing="0" border="0" width="600" style="width:600px"><tr><td><![endif]-->
    <table role="presentation" align="center" cellpadding="0" cellspacing="0" border="0" width="600" style="max-width:600px;width:100%;background:${p.card};border:1px solid ${p.border};border-radius:8px;mso-table-lspace:0;mso-table-rspace:0">
      <tr><td>${header}</td></tr>
      <tr><td class="lv-body" style="padding:8px 32px 24px">${body}</td></tr>
      <tr><td>${footer}</td></tr>
    </table>
    <!--[if mso | IE]></td></tr></table><![endif]-->
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
