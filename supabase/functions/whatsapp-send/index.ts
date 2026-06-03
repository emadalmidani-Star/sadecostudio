// Send a single WhatsApp message via Meta Cloud API.
// Body: { to: string, template?: {name, language, variables?: string[]}, text?: string, user_id?: string }
// Requires WHATSAPP_ACCESS_TOKEN secret and a whatsapp_sender_config row for the user.
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

function json(b: any, s = 200) {
  return new Response(JSON.stringify(b), {
    status: s,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

export async function sendWhatsApp({
  phoneNumberId,
  accessToken,
  to,
  template,
  text,
}: {
  phoneNumberId: string;
  accessToken: string;
  to: string;
  template?: { name: string; language: string; variables?: string[] };
  text?: string;
}) {
  let payload: any;
  if (template) {
    payload = {
      messaging_product: "whatsapp",
      to,
      type: "template",
      template: {
        name: template.name,
        language: { code: template.language || "en" },
        components: template.variables && template.variables.length
          ? [{ type: "body", parameters: template.variables.map((v) => ({ type: "text", text: v })) }]
          : undefined,
      },
    };
  } else if (text) {
    payload = { messaging_product: "whatsapp", to, type: "text", text: { body: text } };
  } else {
    throw new Error("Either template or text is required");
  }

  const r = await fetch(`https://graph.facebook.com/v20.0/${phoneNumberId}/messages`, {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await r.json();
  if (!r.ok) {
    const err = data?.error?.message || JSON.stringify(data);
    throw new Error(`WhatsApp send failed [${r.status}]: ${err}`);
  }
  return data?.messages?.[0]?.id as string | undefined;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const body = await req.json().catch(() => ({}));
    const { to, template, text, user_id } = body || {};
    if (!to || (!template && !text)) return json({ error: "to + (template|text) required" }, 400);

    let userId = user_id;
    if (!userId) {
      const authHeader = req.headers.get("Authorization");
      if (authHeader?.startsWith("Bearer ")) {
        const anon = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
          global: { headers: { Authorization: authHeader } },
        });
        const { data } = await anon.auth.getClaims(authHeader.replace("Bearer ", ""));
        userId = data?.claims?.sub;
      }
    }
    if (!userId) return json({ error: "Unauthorized" }, 401);

    const { data: cfg } = await admin.from("whatsapp_sender_config").select("*").eq("user_id", userId).maybeSingle();
    if (!cfg?.phone_number_id) return json({ error: "WhatsApp sender not configured" }, 400);
    if (!cfg?.access_token) return json({ error: "Access token not set in WhatsApp Sender" }, 400);

    const cleanTo = String(to).replace(/\D/g, "");
    const msgId = await sendWhatsApp({
      phoneNumberId: cfg.phone_number_id,
      accessToken: cfg.access_token,
      to: cleanTo,
      template,
      text,
    });
    return json({ ok: true, message_id: msgId });
  } catch (e: any) {
    return json({ error: e.message || "send failed" }, 500);
  }
});
