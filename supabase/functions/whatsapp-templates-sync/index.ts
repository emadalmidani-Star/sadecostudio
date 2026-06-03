// Pull approved WhatsApp templates from Meta into whatsapp_templates.
import { createClient } from "npm:@supabase/supabase-js@2";

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
    const { data: claimsData } = await anon.auth.getClaims(authHeader.replace("Bearer ", ""));
    const userId = claimsData?.claims?.sub;
    if (!userId) return json({ error: "Unauthorized" }, 401);

    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: cfg } = await admin
      .from("whatsapp_sender_config")
      .select("waba_id, access_token")
      .eq("user_id", userId)
      .maybeSingle();
    if (!cfg?.waba_id) return json({ error: "WhatsApp Business Account ID not set" }, 400);
    if (!cfg?.access_token) return json({ error: "Access token not set in WhatsApp Sender" }, 400);

    const r = await fetch(
      `https://graph.facebook.com/v20.0/${cfg.waba_id}/message_templates?limit=200&fields=name,language,status,category,components`,
      { headers: { Authorization: `Bearer ${cfg.access_token}` } },
    );
    const data = await r.json();
    if (!r.ok) return json({ error: data?.error?.message || "Meta API error" }, 500);

    let synced = 0;
    for (const t of data?.data || []) {
      const bodyComp = (t.components || []).find((c: any) => c.type === "BODY");
      const body = bodyComp?.text || "";
      const vars = Array.from(new Set(Array.from(body.matchAll(/\{\{\s*(\w+)\s*\}\}/g)).map((m: any) => m[1])));
      await admin.from("whatsapp_templates").upsert(
        {
          user_id: userId,
          name: t.name,
          language: t.language,
          status: t.status,
          category: t.category,
          body,
          variables: vars,
          components: t.components || [],
        },
        { onConflict: "user_id,name,language" },
      );
      synced++;
    }
    await admin.from("whatsapp_sender_config").update({ last_synced_at: new Date().toISOString() }).eq("user_id", userId);
    return json({ ok: true, synced });
  } catch (e: any) {
    return json({ error: e.message || "sync failed" }, 500);
  }
});
