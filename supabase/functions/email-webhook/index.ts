import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, svix-id, svix-timestamp, svix-signature",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (b: any, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });

// Resend webhook events: email.sent, email.delivered, email.opened, email.clicked,
//   email.bounced, email.complained, email.delivery_delayed
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  let payload: any;
  try { payload = await req.json(); } catch { return json({ error: "Invalid JSON" }, 400); }

  const type = String(payload?.type || "");
  const data = payload?.data || {};
  const messageId = String(data?.email_id || data?.id || "");
  if (!messageId) return json({ ok: true, skipped: "no message id" });

  const { data: send } = await admin.from("email_sends").select("id,user_id,contact_id").eq("message_id", messageId).maybeSingle();

  const now = new Date().toISOString();
  const updates: any = {};
  if (type === "email.delivered") { updates.status = "delivered"; updates.delivered_at = now; }
  if (type === "email.opened") { updates.opened_at = now; }
  if (type === "email.clicked") { updates.clicked_at = now; }
  if (type === "email.bounced") { updates.status = "bounced"; updates.bounced_at = now; }
  if (type === "email.complained") { updates.status = "complained"; }

  if (send && Object.keys(updates).length) {
    await admin.from("email_sends").update(updates).eq("id", send.id);
  }
  if (send) {
    await admin.from("email_events").insert({
      user_id: send.user_id, send_id: send.id, message_id: messageId, event_type: type, payload,
    });
    if (type === "email.bounced" && send.contact_id) {
      await admin.from("email_contacts").update({ status: "bounced" }).eq("id", send.contact_id);
    }
    if (type === "email.complained" && send.contact_id) {
      await admin.from("email_contacts").update({ status: "complained" }).eq("id", send.contact_id);
    }
  }

  return json({ ok: true });
});
