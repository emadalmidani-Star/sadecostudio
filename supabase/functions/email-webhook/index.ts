import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, svix-id, svix-timestamp, svix-signature",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (b: any, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });

// Verify Svix/Resend webhook signature.
async function verifySvix(secret: string, id: string, ts: string, body: string, sigHeader: string): Promise<boolean> {
  try {
    const key = secret.startsWith("whsec_") ? secret.slice(6) : secret;
    const keyBytes = Uint8Array.from(atob(key), (c) => c.charCodeAt(0));
    const cryptoKey = await crypto.subtle.importKey(
      "raw", keyBytes, { name: "HMAC", hash: "SHA-256" }, false, ["sign"],
    );
    const data = new TextEncoder().encode(`${id}.${ts}.${body}`);
    const sigBuf = await crypto.subtle.sign("HMAC", cryptoKey, data);
    const expected = btoa(String.fromCharCode(...new Uint8Array(sigBuf)));
    // sigHeader format: "v1,<base64> v1,<base64> ..."
    const provided = sigHeader.split(" ").map((p) => p.split(",")[1]).filter(Boolean);
    return provided.some((s) => s === expected);
  } catch {
    return false;
  }
}

// Resend webhook events: email.sent, email.delivered, email.opened, email.clicked,
//   email.bounced, email.complained, email.delivery_delayed
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const rawBody = await req.text();

  // Verify signature when secret is configured
  const secret = Deno.env.get("RESEND_WEBHOOK_SECRET");
  if (secret) {
    const svixId = req.headers.get("svix-id") || "";
    const svixTs = req.headers.get("svix-timestamp") || "";
    const svixSig = req.headers.get("svix-signature") || "";
    if (!svixId || !svixTs || !svixSig) return json({ error: "Missing signature headers" }, 401);
    const ok = await verifySvix(secret, svixId, svixTs, rawBody, svixSig);
    if (!ok) return json({ error: "Invalid signature" }, 401);
  }

  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  let payload: any;
  try { payload = JSON.parse(rawBody); } catch { return json({ error: "Invalid JSON" }, 400); }

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
