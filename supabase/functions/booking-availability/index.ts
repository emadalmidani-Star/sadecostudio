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
  try {
    const url = new URL(req.url);
    const token = (url.searchParams.get("token") || "").trim();
    const username = (url.searchParams.get("username") || "").trim().toLowerCase();
    if (!token && !username) return json({ error: "token or username required" }, 400);

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

    const [{ data: avail }, { data: profile }, { data: company }, { data: bookings }] = await Promise.all([
      admin.from("meeting_availability").select("weekday, start_time, end_time, slot_minutes").eq("user_id", userId),
      admin.from("profiles").select("full_name, username").eq("id", userId).maybeSingle(),
      admin.from("company_profile").select("name, logo_url").limit(1).maybeSingle(),
      admin.from("meetings").select("scheduled_at, duration_minutes, status").eq("user_id", userId).neq("status", "cancelled"),
    ]);

    const slots: { iso: string; label: string }[] = [];
    const now = new Date();
    const booked = new Set((bookings || []).map((b: any) => new Date(b.scheduled_at).toISOString()));
    for (let d = 0; d < 14; d++) {
      const day = new Date(now); day.setDate(now.getDate() + d);
      const wd = day.getDay();
      const dayRules = (avail || []).filter((a: any) => a.weekday === wd);
      for (const rule of dayRules) {
        const [sh, sm] = String(rule.start_time).split(":").map(Number);
        const [eh, em] = String(rule.end_time).split(":").map(Number);
        const start = new Date(day); start.setHours(sh, sm || 0, 0, 0);
        const end = new Date(day); end.setHours(eh, em || 0, 0, 0);
        const step = (rule.slot_minutes || 30) * 60000;
        for (let t = start.getTime(); t + step <= end.getTime(); t += step) {
          if (t < now.getTime()) continue;
          const iso = new Date(t).toISOString();
          if (booked.has(iso)) continue;
          slots.push({ iso, label: new Date(t).toLocaleString() });
        }
      }
    }

    return json({
      ok: true,
      designer: profile?.full_name || "",
      username: profile?.username || null,
      company: company?.name || "",
      logo_url: company?.logo_url || null,
      slots,
    });
  } catch (e: any) {
    return json({ error: e.message || "Bad request" }, 400);
  }
});
