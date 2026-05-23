import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};
function json(body: any, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  // Meta verification handshake
  if (req.method === "GET") {
    const url = new URL(req.url);
    const mode = url.searchParams.get("hub.mode");
    const token = url.searchParams.get("hub.verify_token");
    const challenge = url.searchParams.get("hub.challenge");
    if (mode === "subscribe" && token) {
      const { data: tk } = await admin.from("lead_intake_tokens").select("active, kind").eq("token", token).maybeSingle();
      if (tk?.active && tk.kind === "whatsapp") return new Response(challenge || "ok", { status: 200, headers: corsHeaders });
    }
    return new Response("forbidden", { status: 403, headers: corsHeaders });
  }

  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const url = new URL(req.url);
    const token = url.searchParams.get("token") || "";
    if (!token) return json({ error: "Missing token query param" }, 400);

    const { data: tk } = await admin.from("lead_intake_tokens").select("user_id, kind, active").eq("token", token).maybeSingle();
    if (!tk || !tk.active || tk.kind !== "whatsapp") return json({ error: "Invalid token" }, 401);

    const body = await req.json();
    const entries = body?.entry || [];
    for (const entry of entries) {
      for (const change of entry.changes || []) {
        const value = change.value || {};
        const contacts = value.contacts || [];
        const messages = value.messages || [];
        for (const msg of messages) {
          const wa_id = msg.from;
          const contact = contacts.find((c: any) => c.wa_id === wa_id);
          const profileName = contact?.profile?.name || `WhatsApp ${wa_id}`;
          const text = msg.text?.body || msg.button?.text || msg.interactive?.body?.text || `(${msg.type})`;
          await admin.from("leads").insert({
            user_id: tk.user_id,
            name: profileName,
            phone: wa_id || null,
            message: String(text).slice(0, 2000),
            source: "whatsapp",
            source_meta: { wa_id, phone_number_id: value.metadata?.phone_number_id, raw: msg },
          });
        }
      }
    }
    return json({ ok: true });
  } catch (e: any) {
    return json({ error: e.message || "Bad request" }, 400);
  }
});
