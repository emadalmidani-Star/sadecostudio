// Cron-driven: pick scheduled / sending campaigns and dispatch the next batch.
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (_req) => {
  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const nowIso = new Date().toISOString();
  const { data: due } = await admin
    .from("whatsapp_campaigns")
    .select("id")
    .in("status", ["scheduled", "sending"])
    .or(`scheduled_for.lte.${nowIso},status.eq.sending`)
    .limit(20);

  const base = Deno.env.get("SUPABASE_URL")!;
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  let dispatched = 0;
  for (const c of due || []) {
    fetch(`${base}/functions/v1/whatsapp-campaign-send`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify({ campaign_id: c.id }),
    }).catch(() => {});
    dispatched++;
  }
  return new Response(JSON.stringify({ ok: true, dispatched }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
