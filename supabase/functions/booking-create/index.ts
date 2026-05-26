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
    const slot = String(body.slot_iso || "").trim();
    const name = String(body.client_name || "").trim();
    const email = body.client_email ? String(body.client_email).trim().slice(0, 255) : null;
    const note = body.note ? String(body.note).trim().slice(0, 2000) : null;
    const duration = Number.isFinite(+body.duration_minutes) ? Math.min(240, Math.max(5, +body.duration_minutes)) : 30;

    if (!token || !slot || !name) return json({ error: "Missing fields" }, 400);
    if (name.length > 200) return json({ error: "Name too long" }, 400);
    const slotDate = new Date(slot);
    if (Number.isNaN(slotDate.getTime())) return json({ error: "Invalid slot" }, 400);

    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: tk } = await admin.from("meeting_booking_tokens").select("user_id, active").eq("token", token).maybeSingle();
    if (!tk || !tk.active) return json({ error: "Invalid token" }, 401);

    // Prevent double-booking
    const { data: clash } = await admin.from("meetings")
      .select("id").eq("user_id", tk.user_id).eq("scheduled_at", slotDate.toISOString()).neq("status", "cancelled").maybeSingle();
    if (clash) return json({ error: "Slot just got taken" }, 409);

    const { error } = await admin.from("meetings").insert({
      user_id: tk.user_id,
      client_name: name,
      client_email: email,
      note,
      scheduled_at: slotDate.toISOString(),
      duration_minutes: duration,
      status: "upcoming",
      source: "scheduled",
    });
    if (error) return json({ error: error.message }, 500);
    return json({ ok: true });
  } catch (e: any) {
    return json({ error: e.message || "Bad request" }, 400);
  }
});
