import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

function page(title: string, body: string) {
  return new Response(
    `<!doctype html><html><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><title>${title}</title>
<style>body{margin:0;background:#0b0d10;color:#e7e4dc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;min-height:100vh;display:flex;align-items:center;justify-content:center;padding:24px}
.card{max-width:480px;width:100%;background:#11141a;border:1px solid #1f242c;border-radius:8px;padding:40px;text-align:center}
h1{font-family:Georgia,serif;font-size:22px;color:#c9a84c;margin:0 0 12px;letter-spacing:.05em}
p{color:#9a958a;line-height:1.6;margin:0 0 16px;font-size:14px}
button,a.btn{display:inline-block;padding:10px 22px;background:#c9a84c;color:#0b0d10;border:none;border-radius:2px;font-weight:600;font-size:13px;letter-spacing:.05em;cursor:pointer;text-decoration:none;margin-top:8px}
</style></head><body><div class="card">${body}</div></body></html>`,
    { status: 200, headers: { ...corsHeaders, "Content-Type": "text/html; charset=utf-8" } },
  );
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const url = new URL(req.url);
  const token = url.searchParams.get("token");
  if (!token) return page("Unsubscribe", `<h1>Invalid link</h1><p>This unsubscribe link is missing a token.</p>`);

  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const { data: tk } = await admin.from("email_unsubs").select("token,user_id,contact_id,used_at").eq("token", token).maybeSingle();
  if (!tk) return page("Unsubscribe", `<h1>Invalid link</h1><p>We couldn't find this unsubscribe token.</p>`);

  if (req.method === "POST" || url.searchParams.get("confirm") === "1") {
    if (!tk.used_at) {
      await admin.from("email_contacts").update({
        status: "unsubscribed", unsubscribed_at: new Date().toISOString(),
      }).eq("id", tk.contact_id);
      await admin.from("email_unsubs").update({ used_at: new Date().toISOString() }).eq("token", token);
    }
    return page("Unsubscribed", `<h1>You're unsubscribed</h1><p>You will no longer receive marketing emails from us. Transactional emails (receipts, account notifications) may still be sent.</p>`);
  }

  if (tk.used_at) return page("Already unsubscribed", `<h1>Already unsubscribed</h1><p>This email address has already been removed from our marketing list.</p>`);

  return page("Confirm unsubscribe",
    `<h1>Unsubscribe?</h1><p>Click below to stop receiving marketing emails from us.</p>
     <form method="POST"><button type="submit">Confirm unsubscribe</button></form>`);
});
