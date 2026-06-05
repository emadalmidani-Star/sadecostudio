// Admin-only: fully delete a team member (auth user + profile + roles).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const ANON = Deno.env.get("SUPABASE_ANON_KEY")!;

    const authHeader = req.headers.get("Authorization") || "";
    const token = authHeader.replace("Bearer ", "");
    if (!token) return json({ error: "Missing auth" }, 401);

    // Identify caller
    const userClient = createClient(SUPABASE_URL, ANON, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: uErr } = await userClient.auth.getUser();
    if (uErr || !user) return json({ error: "Invalid session" }, 401);

    const admin = createClient(SUPABASE_URL, SERVICE);

    // Verify admin
    const { data: roleRow } = await admin
      .from("user_roles").select("role").eq("user_id", user.id).eq("role", "admin").maybeSingle();
    if (!roleRow) return json({ error: "Admin only" }, 403);

    const { target_user_id } = await req.json();
    if (!target_user_id) return json({ error: "target_user_id required" }, 400);
    if (target_user_id === user.id) return json({ error: "You cannot delete yourself" }, 400);

    // Cascade-clean app tables we own, then delete the auth user.
    await admin.from("user_roles").delete().eq("user_id", target_user_id);
    await admin.from("profiles").delete().eq("id", target_user_id);
    const { error: delErr } = await admin.auth.admin.deleteUser(target_user_id);
    if (delErr) return json({ error: delErr.message }, 500);

    return json({ ok: true });
  } catch (e: any) {
    return json({ error: e?.message || "Unknown error" }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status, headers: { ...cors, "Content-Type": "application/json" },
  });
}
