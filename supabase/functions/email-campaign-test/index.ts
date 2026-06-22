import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (b: any, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const GATEWAY_URL = "https://connector-gateway.lovable.dev/resend";

import { renderBlocks as renderBlocksShared } from "../_shared/emailRender.ts";

function renderBlocks(tpl: any, ctx: any): string {
  const html = renderBlocksShared(tpl, ctx);
  const banner = `<div style="padding:10px 16px;background:#fef3c7;color:#92400e;text-align:center;font-size:12px;font-weight:600;letter-spacing:.05em">⚠ TEST EMAIL — not sent to your list</div>`;
  // Inject banner just after <body...>
  return html.replace(/(<body[^>]*>)/, `$1${banner}`);
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
