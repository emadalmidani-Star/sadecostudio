import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (b: any, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const GATEWAY_URL = "https://connector-gateway.lovable.dev/resend";

import { renderBlocks } from "../_shared/emailRender.ts";

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
    const CONCURRENCY = 10; // parallel sends per batch (Resend default ~2/s on free, 10/s on paid)

    async function sendOne(c: any) {
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

    // Process recipients in parallel batches of CONCURRENCY
    for (let i = 0; i < recipients.length; i += CONCURRENCY) {
      const batch = recipients.slice(i, i + CONCURRENCY);
      await Promise.all(batch.map(sendOne));
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
