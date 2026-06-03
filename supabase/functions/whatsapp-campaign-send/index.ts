// Send a campaign to all subscribed contacts in its list (rate-limited per call).
import { createClient } from "npm:@supabase/supabase-js@2";
import { sendWhatsApp } from "../whatsapp-send/index.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (b: any, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const BATCH = 80; // per invocation
const SLEEP_MS = 200;

function fillVars(map: Record<string, string>, contact: any): string[] {
  // Variables map is ordered { "1": "Hi {{name}}", "2": "Sadeco" } -> resolve {{name}} from contact fields
  const resolve = (s: string) =>
    s
      .replace(/\{\{\s*name\s*\}\}/gi, contact.name || "")
      .replace(/\{\{\s*phone\s*\}\}/gi, contact.phone || "");
  const keys = Object.keys(map).sort((a, b) => Number(a) - Number(b));
  return keys.map((k) => resolve(map[k] ?? ""));
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const { campaign_id } = await req.json().catch(() => ({}));
    if (!campaign_id) return json({ error: "campaign_id required" }, 400);

    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: c } = await admin.from("whatsapp_campaigns").select("*").eq("id", campaign_id).maybeSingle();
    if (!c) return json({ error: "Campaign not found" }, 404);
    if (c.status === "sent") return json({ ok: true, note: "already sent" });

    const { data: cfg } = await admin
      .from("whatsapp_sender_config")
      .select("phone_number_id, access_token")
      .eq("user_id", c.user_id)
      .maybeSingle();
    if (!cfg?.phone_number_id || !cfg?.access_token) {
      await admin.from("whatsapp_campaigns").update({ status: "failed" }).eq("id", campaign_id);
      return json({ error: "Sender not configured (missing phone number ID or access token)" }, 400);
    }
    const accessToken = cfg.access_token;

    // Mark sending
    if (c.status !== "sending") {
      await admin.from("whatsapp_campaigns").update({ status: "sending" }).eq("id", campaign_id);
    }

    // Get recipients not yet queued
    const { data: members } = await admin
      .from("whatsapp_list_members")
      .select("contact_id, whatsapp_contacts!inner(id, phone, name, status)")
      .eq("list_id", c.list_id)
      .eq("user_id", c.user_id);

    const subscribed = (members || []).filter((m: any) => m.whatsapp_contacts?.status === "subscribed");
    const { data: alreadyQueued } = await admin
      .from("whatsapp_sends")
      .select("contact_id")
      .eq("campaign_id", campaign_id);
    const queuedIds = new Set((alreadyQueued || []).map((s: any) => s.contact_id));
    const toSend = subscribed.filter((m: any) => !queuedIds.has(m.contact_id)).slice(0, BATCH);

    let ok = 0,
      fail = 0;
    for (const m of toSend) {
      const contact = (m as any).whatsapp_contacts;
      try {
        const vars = fillVars((c.variables_map as Record<string, string>) || {}, contact);
        const msgId = await sendWhatsApp({
          phoneNumberId: cfg.phone_number_id,
          accessToken,
          to: contact.phone,
          template: {
            name: c.template_name,
            language: c.template_language || "en",
            variables: vars,
          },
        });
        await admin.from("whatsapp_sends").insert({
          user_id: c.user_id,
          campaign_id: c.id,
          contact_id: contact.id,
          recipient_phone: contact.phone,
          wa_message_id: msgId,
          status: "sent",
          sent_at: new Date().toISOString(),
        });
        ok++;
      } catch (e: any) {
        await admin.from("whatsapp_sends").insert({
          user_id: c.user_id,
          campaign_id: c.id,
          contact_id: contact.id,
          recipient_phone: contact.phone,
          status: "failed",
          error: e.message || "send failed",
          failed_at: new Date().toISOString(),
        });
        fail++;
      }
      await new Promise((r) => setTimeout(r, SLEEP_MS));
    }

    // If everyone queued, mark sent
    const remaining = subscribed.length - queuedIds.size - toSend.length;
    if (remaining <= 0) {
      const { data: allSends } = await admin
        .from("whatsapp_sends")
        .select("status")
        .eq("campaign_id", campaign_id);
      const stats = {
        recipients: subscribed.length,
        sent: (allSends || []).filter((s: any) => s.status !== "failed").length,
        delivered: (allSends || []).filter((s: any) => s.status === "delivered").length,
        read: (allSends || []).filter((s: any) => s.status === "read").length,
        failed: (allSends || []).filter((s: any) => s.status === "failed").length,
      };
      await admin
        .from("whatsapp_campaigns")
        .update({ status: "sent", sent_at: new Date().toISOString(), stats })
        .eq("id", campaign_id);
    }

    return json({ ok: true, sent: ok, failed: fail, remaining });
  } catch (e: any) {
    return json({ error: e.message || "campaign send failed" }, 500);
  }
});
