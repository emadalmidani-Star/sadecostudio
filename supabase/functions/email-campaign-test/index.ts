import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (b: any, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const GATEWAY_URL = "https://connector-gateway.lovable.dev/resend";

const esc = (s: string) =>
  String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const interp = (s: string, ctx: any) =>
  s.replaceAll("{{name}}", esc(ctx.recipientName || "there")).replaceAll("{{site}}", esc(ctx.siteName || ""));

const BRAND = { bg: "#0b0d10", card: "#11141a", text: "#e7e4dc", muted: "#9a958a", accent: "#c9a84c", border: "#1f242c" };
const MINIMAL = { bg: "#ffffff", card: "#ffffff", text: "#222222", muted: "#666666", accent: "#0d0d0d", border: "#e6e6e6" };

function renderBlocks(tpl: any, ctx: any): string {
  const p = tpl.preset === "minimal" ? MINIMAL : BRAND;
  const isBrand = tpl.preset !== "minimal";
  const header = isBrand
    ? `<div style="padding:24px;text-align:center;background:${p.card};border-bottom:1px solid ${p.border};">
        ${ctx.logoUrl ? `<img src="${esc(ctx.logoUrl)}" alt="${esc(ctx.siteName || "")}" style="max-height:48px"/>` : `<div style="font-family:Georgia,serif;font-size:22px;color:${p.accent};letter-spacing:.2em">${esc(ctx.siteName || "")}</div>`}
      </div>`
    : `<div style="padding:24px 0;border-bottom:1px solid ${p.border};"><div style="font-family:Georgia,serif;font-size:18px;color:${p.text}">${esc(ctx.siteName || "")}</div></div>`;
  const body = (tpl.blocks || []).map((b: any) => {
    switch (b.type) {
      case "heading": {
        const size = b.level === 3 ? 16 : b.level === 2 ? 20 : 26;
        return `<h${b.level || 1} style="margin:24px 0 12px;font-family:Georgia,serif;font-weight:600;font-size:${size}px;color:${p.text}">${esc(interp(b.text, ctx))}</h${b.level || 1}>`;
      }
      case "text": return `<p style="margin:0 0 16px;font-size:15px;line-height:1.65;color:${p.text}">${esc(interp(b.text, ctx)).replaceAll("\n", "<br/>")}</p>`;
      case "image": return `<div style="margin:20px 0;text-align:center"><img src="${esc(b.url)}" alt="${esc(b.alt || "")}" style="max-width:${b.width || 560}px;width:100%;height:auto;border-radius:4px"/></div>`;
      case "button": return `<div style="margin:24px 0;text-align:center"><a href="${esc(b.url)}" style="display:inline-block;padding:12px 28px;background:${p.accent};color:${isBrand ? "#0b0d10" : "#ffffff"};text-decoration:none;font-weight:600;font-size:14px;letter-spacing:.05em;border-radius:2px">${esc(interp(b.text, ctx))}</a></div>`;
      case "divider": return `<hr style="border:none;border-top:1px solid ${p.border};margin:24px 0"/>`;
      case "spacer": return `<div style="height:${b.height || 24}px"></div>`;
      default: return "";
    }
  }).join("");
  const testBanner = `<div style="padding:10px 16px;background:#fef3c7;color:#92400e;text-align:center;font-size:12px;font-weight:600;letter-spacing:.05em">⚠ TEST EMAIL — not sent to your list</div>`;
  const footer = `<div style="padding:24px;text-align:center;border-top:1px solid ${p.border};color:${p.muted};font-size:12px;line-height:1.6">
    ${ctx.physicalAddress ? `<div style="margin-bottom:8px">${esc(ctx.physicalAddress)}</div>` : ""}
    <div>You received this email because you opted in. <a href="${esc(ctx.unsubscribeUrl)}" style="color:${p.muted};text-decoration:underline">Unsubscribe</a></div>
  </div>`;
  return `<!doctype html><html><head><meta charset="utf-8"/><title>[TEST] ${esc(tpl.subject || "")}</title></head>
<body style="margin:0;padding:0;background:${p.bg};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${p.bg};padding:32px 16px">
<tr><td align="center"><table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:${p.card};border:1px solid ${p.border};border-radius:8px;overflow:hidden">
<tr><td>${testBanner}</td></tr><tr><td>${header}</td></tr><tr><td style="padding:8px 32px 24px">${body}</td></tr><tr><td>${footer}</td></tr>
</table></td></tr></table></body></html>`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    if (!LOVABLE_API_KEY) return json({ error: "LOVABLE_API_KEY missing" }, 500);
    if (!RESEND_API_KEY) return json({ error: "Resend not connected" }, 500);

    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);
    const userClient = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: claimsData, error: claimsErr } = await userClient.auth.getClaims(authHeader.replace("Bearer ", ""));
    if (claimsErr || !claimsData?.claims) return json({ error: "Unauthorized" }, 401);
    const userId = claimsData.claims.sub as string;

    const body = await req.json();
    const recipients: string[] = Array.isArray(body.recipients)
      ? body.recipients.map((s: any) => String(s).trim()).filter(Boolean)
      : String(body.recipient || "").split(/[,\s;]+/).map((s) => s.trim()).filter(Boolean);
    if (!recipients.length) return json({ error: "At least one recipient is required" }, 400);
    if (recipients.length > 5) return json({ error: "Max 5 test recipients" }, 400);
    const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    for (const r of recipients) if (!emailRe.test(r)) return json({ error: `Invalid email: ${r}` }, 400);

    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    // Resolve template + subject either from a campaignId or a templateId
    let templateId: string | null = body.templateId || null;
    let subjectOverride: string | null = body.subject || null;
    if (body.campaignId) {
      const { data: c } = await admin.from("email_campaigns").select("*").eq("id", body.campaignId).maybeSingle();
      if (!c) return json({ error: "Campaign not found" }, 404);
      if (c.user_id !== userId) return json({ error: "Forbidden" }, 403);
      templateId = c.template_id;
      subjectOverride = c.subject || null;
    }
    if (!templateId) return json({ error: "campaignId or templateId required" }, 400);

    const [{ data: settings }, { data: company }, { data: template }] = await Promise.all([
      admin.from("email_marketing_settings").select("*").eq("user_id", userId).maybeSingle(),
      admin.from("company_profile").select("name,logo_url,address").maybeSingle(),
      admin.from("email_templates").select("*").eq("id", templateId).maybeSingle(),
    ]);
    if (!template) return json({ error: "Template not found" }, 404);
    if (!settings?.from_email) return json({ error: "Sender email not configured. Set it in Email → Sender." }, 400);

    const FROM = settings.from_name ? `${settings.from_name} <${settings.from_email}>` : settings.from_email;
    const siteName = company?.name || "Our Team";
    const unsubscribeUrl = `${Deno.env.get("SUPABASE_URL")}/functions/v1/email-unsubscribe?token=preview`;
    const html = renderBlocks(template, {
      siteName,
      logoUrl: company?.logo_url || null,
      physicalAddress: settings.physical_address || company?.address || "",
      unsubscribeUrl,
      recipientName: "Test",
    });
    const subject = `[TEST] ${(subjectOverride || template.subject || "(no subject)").replaceAll("{{name}}", "Test").replaceAll("{{site}}", siteName)}`;

    let sent = 0, failed = 0;
    const errors: string[] = [];
    for (const to of recipients) {
      const r = await fetch(`${GATEWAY_URL}/emails`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${LOVABLE_API_KEY}`,
          "X-Connection-Api-Key": RESEND_API_KEY,
        },
        body: JSON.stringify({
          from: FROM,
          to: [to],
          subject,
          html,
          reply_to: settings.reply_to || undefined,
          tags: [{ name: "type", value: "test" }],
        }),
      });
      const out = await r.json().catch(() => ({}));
      if (r.ok) sent++;
      else { failed++; errors.push(`${to}: ${typeof out === "object" ? JSON.stringify(out).slice(0, 200) : String(out).slice(0, 200)}`); }
    }

    return json({ ok: failed === 0, sent, failed, total: recipients.length, errors });
  } catch (e: any) {
    return json({ error: e?.message || "Server error" }, 500);
  }
});
