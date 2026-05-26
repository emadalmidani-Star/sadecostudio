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

  if (req.method === "GET") {
    const url = new URL(req.url);
    const token = (url.searchParams.get("token") || "").trim();
    if (!token) return json({ error: "token required" }, 400);
    const { data: tk } = await admin.from("dropin_tokens").select("user_id, active").eq("token", token).maybeSingle();
    if (!tk || !tk.active) return json({ error: "Invalid token" }, 401);
    const [{ data: profile }, { data: company }] = await Promise.all([
      admin.from("profiles").select("full_name").eq("id", tk.user_id).maybeSingle(),
      admin.from("company_profile").select("name, logo_url").limit(1).maybeSingle(),
    ]);
    return json({ ok: true, designer: profile?.full_name || "", company: company?.name || "", logo_url: company?.logo_url || null });
  }

  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  try {
    const body = await req.json();
    const token = String(body.token || "").trim();
    const name = String(body.client_name || "").trim();
    const message = body.message ? String(body.message).trim().slice(0, 1000) : null;
    if (!token || !name) return json({ error: "Missing fields" }, 400);
    if (name.length > 200) return json({ error: "Name too long" }, 400);

    const { data: tk } = await admin.from("dropin_tokens").select("user_id, active").eq("token", token).maybeSingle();
    if (!tk || !tk.active) return json({ error: "Invalid token" }, 401);

    const { error } = await admin.from("dropin_requests").insert({
      user_id: tk.user_id, client_name: name, message, status: "pending",
    });
    if (error) return json({ error: error.message }, 500);
    return json({ ok: true });
  } catch (e: any) {
    return json({ error: e.message || "Bad request" }, 400);
  }
});
