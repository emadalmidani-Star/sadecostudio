// Send a test campaign to one or more phone numbers (no DB log).
import { createClient } from "npm:@supabase/supabase-js@2";
import { sendWhatsApp } from "../whatsapp-send/index.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (b: any, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);
    const anon = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: claims } = await anon.auth.getClaims(authHeader.replace("Bearer ", ""));
    const userId = claims?.claims?.sub;
    if (!userId) return json({ error: "Unauthorized" }, 401);

    const { campaign_id, phones } = await req.json();
    if (!campaign_id || !Array.isArray(phones) || !phones.length)
      return json({ error: "campaign_id + phones[] required" }, 400);

    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: c } = await admin
      .from("whatsapp_campaigns")
      .select("*")
      .eq("id", campaign_id)
      .eq("user_id", userId)
      .maybeSingle();
    if (!c) return json({ error: "Campaign not found" }, 404);

    const { data: cfg } = await admin
      .from("whatsapp_sender_config")
      .select("phone_number_id, access_token")
      .eq("user_id", userId)
      .maybeSingle();
    if (!cfg?.phone_number_id || !cfg?.access_token)
      return json({ error: "Sender not configured (missing phone number ID or access token)" }, 400);
    const accessToken = cfg.access_token;

    const map = (c.variables_map as Record<string, string>) || {};
    const keys = Object.keys(map).sort((a, b) => Number(a) - Number(b));
    const vars = keys.map((k) =>
      String(map[k] ?? "").replace(/\{\{\s*name\s*\}\}/gi, "Test").replace(/\{\{\s*phone\s*\}\}/gi, ""),
    );

    const results: any[] = [];
    for (const raw of phones.slice(0, 5)) {
      const to = String(raw).replace(/\D/g, "");
      try {
        const id = await sendWhatsApp({
          phoneNumberId: cfg.phone_number_id,
          accessToken,
          to,
          template: { name: c.template_name, language: c.template_language || "en", variables: vars },
        });
        results.push({ to, ok: true, id });
      } catch (e: any) {
        results.push({ to, ok: false, error: e.message });
      }
    }
    return json({ ok: true, results });
  } catch (e: any) {
    return json({ error: e.message || "test send failed" }, 500);
  }
});
