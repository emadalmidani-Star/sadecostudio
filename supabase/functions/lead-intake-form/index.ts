import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: any, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const body = await req.json();
    const token = String(body.token || "").trim();
    const name = String(body.name || "").trim();
    if (!token || !name) return json({ error: "token and name are required" }, 400);
    if (name.length > 200) return json({ error: "name too long" }, 400);

    const email = body.email ? String(body.email).trim().slice(0, 255) : null;
    const phone = body.phone ? String(body.phone).trim().slice(0, 50) : null;
    const company = body.company ? String(body.company).trim().slice(0, 200) : null;
    const message = body.message ? String(body.message).trim().slice(0, 2000) : null;

    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: tk, error: tkErr } = await admin
      .from("lead_intake_tokens")
      .select("user_id, kind, active")
      .eq("token", token)
      .maybeSingle();
    if (tkErr || !tk) return json({ error: "Invalid token" }, 401);
    if (!tk.active || tk.kind !== "web_form") return json({ error: "Token disabled" }, 403);

    const { error } = await admin.from("leads").insert({
      user_id: tk.user_id,
      name, email, phone, company, message,
      source: "web_form",
      source_meta: { ua: req.headers.get("user-agent") || null },
    });
    if (error) return json({ error: error.message }, 500);
    return json({ ok: true });
  } catch (e: any) {
    return json({ error: e.message || "Bad request" }, 400);
  }
});
