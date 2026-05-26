import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
};
function json(body: any, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const url = new URL(req.url);
  const token = (url.searchParams.get("token") || "").trim();
  if (!token) return json({ error: "token required" }, 400);

  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const { data: note } = await admin.from("meeting_notes")
    .select("title, meeting_date, attendees, summary, action_items, user_id")
    .eq("share_token", token).maybeSingle();
  if (!note) return json({ error: "Not found" }, 404);
  const { data: company } = await admin.from("company_profile").select("name, logo_url").limit(1).maybeSingle();
  return json({
    ok: true,
    note: {
      title: note.title, meeting_date: note.meeting_date,
      attendees: note.attendees, summary: note.summary, action_items: note.action_items,
    },
    company: company?.name || "", logo_url: company?.logo_url || null,
  });
});
