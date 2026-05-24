import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
function json(body: any, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

// Generic inbound-email webhook. Expects JSON with fields commonly provided by
// Mailgun/Resend/SendGrid inbound parsers. The recipient address embeds the
// intake token like: leads+<token>@yourdomain.com
function extractToken(recipient: string | null): string | null {
  if (!recipient) return null;
  const m = recipient.match(/\+([^@]+)@/);
  return m ? m[1] : null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    let payload: any = {};
    const ct = req.headers.get("content-type") || "";
    if (ct.includes("application/json")) payload = await req.json();
    else {
      const fd = await req.formData();
      fd.forEach((v, k) => (payload[k] = v));
    }

    const recipient = String(payload.recipient || payload.to || payload["envelope-to"] || "");
    const tokenFromAddr = extractToken(recipient);
    const token = String(payload.token || tokenFromAddr || "");
    if (!token) return json({ error: "Missing token" }, 400);

    const from = String(payload.from || payload.sender || "").slice(0, 255);
    const subject = String(payload.subject || "").slice(0, 500);
    const text = String(payload["body-plain"] || payload.text || payload.html || "").slice(0, 5000);
    const emailMatch = from.match(/<([^>]+)>/);
    const fromEmail = (emailMatch ? emailMatch[1] : from).trim().slice(0, 255);
    const fromName = from.replace(/<[^>]+>/, "").replace(/"/g, "").trim() || fromEmail;

    const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!fromEmail || !emailRe.test(fromEmail)) return json({ error: "Invalid sender email" }, 400);
    if (!subject && !text) return json({ error: "Empty email body" }, 400);

    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: tk } = await admin.from("lead_intake_tokens").select("user_id, kind, active").eq("token", token).maybeSingle();
    if (!tk || !tk.active || tk.kind !== "email") return json({ error: "Invalid token" }, 401);

    const { error } = await admin.from("leads").insert({
      user_id: tk.user_id,
      name: fromName || "Email lead",
      email: fromEmail || null,
      message: `${subject}\n\n${text}`.trim() || null,
      source: "email",
      source_meta: { from, subject, recipient },
    });
    if (error) return json({ error: error.message }, 500);
    return json({ ok: true });
  } catch (e: any) {
    return json({ error: e.message || "Bad request" }, 400);
  }
});
