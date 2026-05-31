import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (b: any, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const GATEWAY_URL = "https://connector-gateway.lovable.dev/resend";

// --- inline renderer (mirrors src/lib/emailRender.ts) ---
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
  const footer = `<div style="padding:24px;text-align:center;border-top:1px solid ${p.border};color:${p.muted};font-size:12px;line-height:1.6">
    ${ctx.physicalAddress ? `<div style="margin-bottom:8px">${esc(ctx.physicalAddress)}</div>` : ""}
    <div>You received this email because you opted in. <a href="${esc(ctx.unsubscribeUrl)}" style="color:${p.muted};text-decoration:underline">Unsubscribe</a></div>
  </div>`;
  const preheader = tpl.preheader ? `<div style="display:none;visibility:hidden;opacity:0;height:0;width:0;overflow:hidden;max-height:0;mso-hide:all">${esc(tpl.preheader)}</div>` : "";
  return `<!doctype html><html><head><meta charset="utf-8"/><title>${esc(tpl.subject || "")}</title></head>
<body style="margin:0;padding:0;background:${p.bg};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
${preheader}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${p.bg};padding:32px 16px">
<tr><td align="center"><table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:${p.card};border:1px solid ${p.border};border-radius:8px;overflow:hidden">
<tr><td>${header}</td></tr><tr><td style="padding:8px 32px 24px">${body}</td></tr><tr><td>${footer}</td></tr>
</table></td></tr></table></body></html>`;
}

function randToken(len = 28) {
  const arr = new Uint8Array(len);
  crypto.getRandomValues(arr);
  return Array.from(arr).map((b) => b.toString(36).padStart(2, "0")).join("").slice(0, len);
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
    const adminAuth = req.headers.get("x-admin-auth") === Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    let userId: string | null = null;
    if (!adminAuth) {
      if (!authHeader?.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);
      const userClient = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
        global: { headers: { Authorization: authHeader } },
      });
      const { data, error } = await userClient.auth.getClaims(authHeader.replace("Bearer ", ""));
      if (error || !data?.claims) return json({ error: "Unauthorized" }, 401);
      userId = data.claims.sub as string;
    }

    const body = await req.json();
    const campaignId = String(body.campaignId || "");
    if (!campaignId) return json({ error: "campaignId required" }, 400);

    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const { data: campaign, error: cErr } = await admin
      .from("email_campaigns").select("*").eq("id", campaignId).maybeSingle();
    if (cErr || !campaign) return json({ error: "Campaign not found" }, 404);
    if (userId && campaign.user_id !== userId) return json({ error: "Forbidden" }, 403);

    if (!["draft", "scheduled", "failed"].includes(campaign.status))
      return json({ error: `Cannot send (status=${campaign.status})` }, 400);

    // Mark sending
    await admin.from("email_campaigns").update({ status: "sending" }).eq("id", campaignId);

    const ownerId = campaign.user_id;
    const [{ data: settings }, { data: company }, { data: template }] = await Promise.all([
      admin.from("email_marketing_settings").select("*").eq("user_id", ownerId).maybeSingle(),
      admin.from("company_profile").select("name,logo_url,address").maybeSingle(),
      admin.from("email_templates").select("*").eq("id", campaign.template_id).maybeSingle(),
    ]);

    if (!template) {
      await admin.from("email_campaigns").update({ status: "failed" }).eq("id", campaignId);
      return json({ error: "Template missing" }, 400);
    }
    if (!settings?.from_email) {
      await admin.from("email_campaigns").update({ status: "failed" }).eq("id", campaignId);
      return json({ error: "Sender email not configured. Set it in Email → Sender." }, 400);
    }

    // Recipients (subscribed members of the list)
    const { data: members } = await admin
      .from("email_list_members")
      .select("contact_id, email_contacts!inner(id,email,name,status)")
      .eq("list_id", campaign.list_id)
      .eq("user_id", ownerId);

    const recipients = (members || [])
      .map((m: any) => m.email_contacts)
      .filter((c: any) => c && c.status === "subscribed" && c.email);

    const FROM = settings.from_name ? `${settings.from_name} <${settings.from_email}>` : settings.from_email;
    const replyTo = settings.reply_to || undefined;
    const physical = settings.physical_address || company?.address || "";

    const unsubBase = `${Deno.env.get("SUPABASE_URL")}/functions/v1/email-unsubscribe`;
    const siteName = company?.name || "Our Team";
    const logoUrl = company?.logo_url || null;

    let sent = 0, failed = 0;
    for (const c of recipients) {
      // ensure unsubscribe token
      let token = randToken();
      const { data: existing } = await admin.from("email_unsubs")
        .select("token").eq("contact_id", c.id).is("used_at", null).maybeSingle();
      if (existing?.token) token = existing.token;
      else await admin.from("email_unsubs").insert({ token, user_id: ownerId, contact_id: c.id });

      const unsubscribeUrl = `${unsubBase}?token=${encodeURIComponent(token)}`;
      const html = renderBlocks(template, {
        siteName, logoUrl, physicalAddress: physical, unsubscribeUrl, recipientName: c.name,
      });
      const subject = (campaign.subject || template.subject || "(no subject)")
        .replaceAll("{{name}}", c.name || "")
        .replaceAll("{{site}}", siteName);

      try {
        const r = await fetch(`${GATEWAY_URL}/emails`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${LOVABLE_API_KEY}`,
            "X-Connection-Api-Key": RESEND_API_KEY,
          },
          body: JSON.stringify({
            from: FROM,
            to: [c.email],
            subject,
            html,
            reply_to: replyTo,
            headers: {
              "List-Unsubscribe": `<${unsubscribeUrl}>`,
              "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
            },
            tags: [{ name: "campaign", value: campaignId.slice(0, 30) }],
          }),
        });
        const out = await r.json();
        if (!r.ok) {
          failed++;
          await admin.from("email_sends").upsert({
            user_id: ownerId, campaign_id: campaignId, contact_id: c.id,
            recipient_email: c.email, status: "failed",
            error: typeof out === "object" ? JSON.stringify(out).slice(0, 500) : String(out).slice(0, 500),
          }, { onConflict: "campaign_id,contact_id" });
        } else {
          sent++;
          await admin.from("email_sends").upsert({
            user_id: ownerId, campaign_id: campaignId, contact_id: c.id,
            recipient_email: c.email, status: "sent",
            message_id: out.id || null, sent_at: new Date().toISOString(),
          }, { onConflict: "campaign_id,contact_id" });
        }
      } catch (e: any) {
        failed++;
        await admin.from("email_sends").upsert({
          user_id: ownerId, campaign_id: campaignId, contact_id: c.id,
          recipient_email: c.email, status: "failed", error: String(e).slice(0, 500),
        }, { onConflict: "campaign_id,contact_id" });
      }
    }

    const stats = {
      ...(campaign.stats || {}),
      recipients: recipients.length,
      sent,
      failed,
    };
    await admin.from("email_campaigns").update({
      status: failed > 0 && sent === 0 ? "failed" : "sent",
      sent_at: new Date().toISOString(),
      stats,
    }).eq("id", campaignId);

    return json({ ok: true, sent, failed, total: recipients.length });
  } catch (e: any) {
    return json({ error: e?.message || "Server error" }, 500);
  }
});
