import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
function json(body: any, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}
function rand(len = 10) {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  let out = "";
  const arr = new Uint32Array(len);
  crypto.getRandomValues(arr);
  for (let i = 0; i < len; i++) out += chars[arr[i] % chars.length];
  return out;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  try {
    const body = await req.json();
    const token = body.token ? String(body.token).trim() : "";
    const username = body.username ? String(body.username).trim().toLowerCase() : "";
    const slot = String(body.slot_iso || "").trim();
    const name = String(body.client_name || "").trim();
    const email = body.client_email ? String(body.client_email).trim().slice(0, 255) : null;
    const note = body.note ? String(body.note).trim().slice(0, 2000) : null;
    const duration = Number.isFinite(+body.duration_minutes) ? Math.min(240, Math.max(5, +body.duration_minutes)) : 30;

    if ((!token && !username) || !slot || !name) return json({ error: "Missing fields" }, 400);
    if (name.length > 200) return json({ error: "Name too long" }, 400);
    const slotDate = new Date(slot);
    if (Number.isNaN(slotDate.getTime())) return json({ error: "Invalid slot" }, 400);

    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    let userId: string | null = null;
    if (token) {
      const { data: tk } = await admin.from("meeting_booking_tokens").select("user_id, active").eq("token", token).maybeSingle();
      if (!tk || !tk.active) return json({ error: "Invalid token" }, 401);
      userId = tk.user_id;
    } else {
      const { data: p } = await admin.from("profiles").select("id").ilike("username", username).maybeSingle();
      if (!p) return json({ error: "Unknown user" }, 404);
      userId = p.id;
    }

    const { data: clash } = await admin.from("meetings")
      .select("id").eq("user_id", userId).eq("scheduled_at", slotDate.toISOString()).neq("status", "cancelled").maybeSingle();
    if (clash) return json({ error: "Slot just got taken" }, 409);

    // Determine video call URL
    const { data: settings } = await admin.from("meeting_settings").select("video_provider, custom_link_template").eq("user_id", userId).maybeSingle();
    const provider = settings?.video_provider || "jitsi";
    const roomId = `sadeco-${rand(10)}`;
    let meeting_url: string | null = null;
    if (provider === "jitsi") meeting_url = `https://meet.jit.si/${roomId}`;
    else if (provider === "google_meet") meeting_url = `https://meet.google.com/new`;
    else if (provider === "custom" && settings?.custom_link_template) {
      meeting_url = String(settings.custom_link_template).replace(/\{\{id\}\}/g, roomId);
    } else if (provider === "none") meeting_url = null;

    const { data: created, error } = await admin.from("meetings").insert({
      user_id: userId,
      client_name: name,
      client_email: email,
      note,
      scheduled_at: slotDate.toISOString(),
      duration_minutes: duration,
      status: "upcoming",
      source: "scheduled",
      meeting_url,
    }).select("id, scheduled_at, duration_minutes, meeting_url").maybeSingle();
    if (error) return json({ error: error.message }, 500);

    // Fetch designer + company info for confirmation
    const [{ data: profile }, { data: company }] = await Promise.all([
      admin.from("profiles").select("full_name, email").eq("id", userId).maybeSingle(),
      admin.from("company_profile").select("name").limit(1).maybeSingle(),
    ]);

    return json({
      ok: true,
      meeting: created,
      designer_name: profile?.full_name || "",
      designer_email: profile?.email || null,
      company_name: company?.name || "",
    });
  } catch (e: any) {
    return json({ error: e.message || "Bad request" }, 400);
  }
});
