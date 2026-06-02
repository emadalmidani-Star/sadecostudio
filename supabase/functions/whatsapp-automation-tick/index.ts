// Advance whatsapp_automation_runs: send the next step's template if due, schedule next.
import { createClient } from "npm:@supabase/supabase-js@2";
import { sendWhatsApp } from "../whatsapp-send/index.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (_req) => {
  const accessToken = Deno.env.get("WHATSAPP_ACCESS_TOKEN");
  if (!accessToken) {
    return new Response(JSON.stringify({ skipped: "no token" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const nowIso = new Date().toISOString();

  // 1) Enqueue runs for triggers (lead_created with phone)
  const { data: activeAutos } = await admin.from("whatsapp_automations").select("*").eq("status", "active");
  for (const a of activeAutos || []) {
    if (a.trigger === "lead_created") {
      const since = a.last_checked_at || new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString();
      const { data: leads } = await admin
        .from("leads")
        .select("id, phone, name, user_id")
        .eq("user_id", a.user_id)
        .gte("created_at", since)
        .not("phone", "is", null);
      for (const l of leads || []) {
        const phone = String(l.phone || "").replace(/\D/g, "");
        if (!phone) continue;
        const { data: contact } = await admin
          .from("whatsapp_contacts")
          .select("id")
          .eq("user_id", l.user_id)
          .eq("phone", phone)
          .maybeSingle();
        if (!contact) continue;
        const { data: existing } = await admin
          .from("whatsapp_automation_runs")
          .select("id")
          .eq("automation_id", a.id)
          .eq("contact_id", contact.id)
          .maybeSingle();
        if (existing) continue;
        await admin.from("whatsapp_automation_runs").insert({
          user_id: a.user_id,
          automation_id: a.id,
          contact_id: contact.id,
          status: "active",
          next_run_at: nowIso,
        });
      }
      await admin.from("whatsapp_automations").update({ last_checked_at: nowIso }).eq("id", a.id);
    }
  }

  // 2) Process due runs
  const { data: runs } = await admin
    .from("whatsapp_automation_runs")
    .select("*")
    .eq("status", "active")
    .lte("next_run_at", nowIso)
    .limit(50);

  for (const run of runs || []) {
    const { data: step } = await admin
      .from("whatsapp_automation_steps")
      .select("*")
      .eq("automation_id", run.automation_id)
      .eq("step_order", run.current_step)
      .maybeSingle();
    if (!step) {
      await admin.from("whatsapp_automation_runs").update({ status: "completed" }).eq("id", run.id);
      continue;
    }
    const { data: cfg } = await admin
      .from("whatsapp_sender_config")
      .select("phone_number_id")
      .eq("user_id", run.user_id)
      .maybeSingle();
    const { data: contact } = await admin
      .from("whatsapp_contacts")
      .select("phone, name, status")
      .eq("id", run.contact_id)
      .maybeSingle();
    if (!cfg?.phone_number_id || !contact || contact.status !== "subscribed") {
      await admin.from("whatsapp_automation_runs").update({ status: "skipped" }).eq("id", run.id);
      continue;
    }
    try {
      const map = (step.variables_map as Record<string, string>) || {};
      const keys = Object.keys(map).sort((a, b) => Number(a) - Number(b));
      const vars = keys.map((k) =>
        String(map[k] ?? "").replace(/\{\{\s*name\s*\}\}/gi, contact.name || ""),
      );
      const msgId = await sendWhatsApp({
        phoneNumberId: cfg.phone_number_id,
        accessToken,
        to: contact.phone,
        template: { name: step.template_name, language: step.template_language || "en", variables: vars },
      });
      await admin.from("whatsapp_sends").insert({
        user_id: run.user_id,
        automation_run_id: run.id,
        contact_id: run.contact_id,
        recipient_phone: contact.phone,
        wa_message_id: msgId,
        status: "sent",
        sent_at: nowIso,
      });
    } catch (e: any) {
      await admin.from("whatsapp_sends").insert({
        user_id: run.user_id,
        automation_run_id: run.id,
        contact_id: run.contact_id,
        recipient_phone: contact.phone,
        status: "failed",
        error: e.message,
        failed_at: nowIso,
      });
    }

    const { data: nextStep } = await admin
      .from("whatsapp_automation_steps")
      .select("delay_minutes")
      .eq("automation_id", run.automation_id)
      .eq("step_order", run.current_step + 1)
      .maybeSingle();
    if (!nextStep) {
      await admin.from("whatsapp_automation_runs").update({ status: "completed" }).eq("id", run.id);
    } else {
      const next = new Date(Date.now() + (nextStep.delay_minutes || 0) * 60_000).toISOString();
      await admin
        .from("whatsapp_automation_runs")
        .update({ current_step: run.current_step + 1, next_run_at: next })
        .eq("id", run.id);
    }
  }

  return new Response(JSON.stringify({ ok: true, processed: (runs || []).length }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
