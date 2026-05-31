import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "*" };
const json = (b: any, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });

// Cron: dispatches scheduled campaigns whose time has arrived.
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  const { data: due } = await admin.from("email_campaigns")
    .select("id").eq("status", "scheduled").lte("scheduled_for", new Date().toISOString()).limit(20);

  const url = `${Deno.env.get("SUPABASE_URL")}/functions/v1/email-campaign-send`;
  const dispatched: string[] = [];
  for (const c of due || []) {
    try {
      await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-admin-auth": Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "",
        },
        body: JSON.stringify({ campaignId: c.id }),
      });
      dispatched.push(c.id);
    } catch (_) { /* swallow */ }
  }
  return json({ dispatched });
});
