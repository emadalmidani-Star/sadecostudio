// Meta WhatsApp Cloud API webhook.
// GET = verification handshake (uses verify_token stored in whatsapp_sender_config row matching hub.verify_token)
// POST = inbound messages and status updates -> writes to whatsapp_messages / updates whatsapp_sends + whatsapp_conversations
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  // ---- Verification handshake ----
  if (req.method === "GET") {
    const url = new URL(req.url);
    const mode = url.searchParams.get("hub.mode");
    const token = url.searchParams.get("hub.verify_token");
    const challenge = url.searchParams.get("hub.challenge");
    if (mode === "subscribe" && token) {
      const { data } = await admin
        .from("whatsapp_sender_config")
        .select("user_id")
        .eq("verify_token", token)
        .maybeSingle();
      if (data) return new Response(challenge || "ok", { status: 200, headers: corsHeaders });
    }
    return new Response("forbidden", { status: 403, headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response("method not allowed", { status: 405, headers: corsHeaders });
  }

  try {
    const body = await req.json();
    for (const entry of body?.entry || []) {
      for (const change of entry.changes || []) {
        const value = change.value || {};
        const phoneNumberId = value.metadata?.phone_number_id;
        if (!phoneNumberId) continue;

        // Resolve owning user
        const { data: cfg } = await admin
          .from("whatsapp_sender_config")
          .select("user_id")
          .eq("phone_number_id", phoneNumberId)
          .maybeSingle();
        if (!cfg?.user_id) continue;
        const userId = cfg.user_id as string;

        // ---- Inbound messages ----
        const contacts = value.contacts || [];
        for (const msg of value.messages || []) {
          const fromWa = msg.from as string;
          const profileName = contacts.find((c: any) => c.wa_id === fromWa)?.profile?.name || `WhatsApp ${fromWa}`;
          const text =
            msg.text?.body ||
            msg.button?.text ||
            msg.interactive?.body?.text ||
            msg.interactive?.button_reply?.title ||
            msg.interactive?.list_reply?.title ||
            `(${msg.type})`;

          // STOP handling -> unsubscribe
          if (typeof text === "string" && /^\s*(stop|unsubscribe|cancel)\s*$/i.test(text)) {
            await admin
              .from("whatsapp_contacts")
              .update({ status: "unsubscribed", unsubscribed_at: new Date().toISOString() })
              .eq("user_id", userId)
              .eq("phone", fromWa);
          }

          // Upsert contact (light)
          const { data: contact } = await admin
            .from("whatsapp_contacts")
            .upsert(
              { user_id: userId, phone: fromWa, name: profileName, source: "whatsapp" },
              { onConflict: "user_id,phone" },
            )
            .select("id")
            .maybeSingle();

          // Upsert conversation
          const nowIso = new Date().toISOString();
          const { data: existingConv } = await admin
            .from("whatsapp_conversations")
            .select("id, unread_count")
            .eq("user_id", userId)
            .eq("phone", fromWa)
            .maybeSingle();

          let convId: string | undefined = existingConv?.id;
          if (convId) {
            await admin
              .from("whatsapp_conversations")
              .update({
                last_message_at: nowIso,
                last_inbound_at: nowIso,
                last_message_preview: String(text).slice(0, 200),
                unread_count: (existingConv!.unread_count || 0) + 1,
                contact_id: contact?.id || null,
                display_name: profileName,
              })
              .eq("id", convId);
          } else {
            const { data: newConv } = await admin
              .from("whatsapp_conversations")
              .insert({
                user_id: userId,
                phone: fromWa,
                contact_id: contact?.id || null,
                display_name: profileName,
                last_message_at: nowIso,
                last_inbound_at: nowIso,
                last_message_preview: String(text).slice(0, 200),
                unread_count: 1,
              })
              .select("id")
              .maybeSingle();
            convId = newConv?.id;
          }

          await admin.from("whatsapp_messages").insert({
            user_id: userId,
            conversation_id: convId,
            direction: "in",
            wa_message_id: msg.id,
            body: typeof text === "string" ? text : null,
            media_type: msg.type,
          });
        }

        // ---- Status updates ----
        for (const s of value.statuses || []) {
          const status = s.status as string; // sent, delivered, read, failed
          const wamId = s.id as string;
          const ts = s.timestamp ? new Date(Number(s.timestamp) * 1000).toISOString() : new Date().toISOString();
          const patch: any = { status };
          if (status === "sent") patch.sent_at = ts;
          if (status === "delivered") patch.delivered_at = ts;
          if (status === "read") patch.read_at = ts;
          if (status === "failed") {
            patch.failed_at = ts;
            patch.error = s.errors?.[0]?.title || s.errors?.[0]?.message || "failed";
          }
          await admin.from("whatsapp_sends").update(patch).eq("wa_message_id", wamId);
          await admin.from("whatsapp_messages").update({ status }).eq("wa_message_id", wamId);
        }
      }
    }
    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("webhook error", e);
    // Always 200 to Meta to avoid retries storm
    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
