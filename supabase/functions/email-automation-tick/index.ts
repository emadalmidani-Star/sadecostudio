import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "*" };
const json = (b: any, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const GATEWAY_URL = "https://connector-gateway.lovable.dev/resend";

// --- minimal inline renderer (mirror) ---
const esc = (s: string) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const interp = (s: string, ctx: any) => s.replaceAll("{{name}}", esc(ctx.recipientName || "there")).replaceAll("{{site}}", esc(ctx.siteName || ""));
const BRAND = { bg: "#0b0d10", card: "#11141a", text: "#e7e4dc", muted: "#9a958a", accent: "#c9a84c", border: "#1f242c" };
const MINIMAL = { bg: "#ffffff", card: "#ffffff", text: "#222222", muted: "#666666", accent: "#0d0d0d", border: "#e6e6e6" };
function renderBlocks(tpl: any, ctx: any): string {
  const p = tpl.preset === "minimal" ? MINIMAL : BRAND;
  const isBrand = tpl.preset !== "minimal";
  const header = isBrand
    ? `<div style="padding:24px;text-align:center;background:${p.card};border-bottom:1px solid ${p.border}">${ctx.logoUrl ? `<img src="${esc(ctx.logoUrl)}" alt="" style="max-height:48px"/>` : `<div style="font-family:Georgia,serif;font-size:22px;color:${p.accent}">${esc(ctx.siteName || "")}</div>`}</div>`
    : `<div style="padding:24px 0;border-bottom:1px solid ${p.border}"><div style="font-family:Georgia,serif;font-size:18px;color:${p.text}">${esc(ctx.siteName || "")}</div></div>`;
  const body = (tpl.blocks || []).map((b: any) => {
    if (b.type === "heading") return `<h${b.level || 1} style="margin:24px 0 12px;font-family:Georgia,serif;font-size:${b.level === 3 ? 16 : b.level === 2 ? 20 : 26}px;color:${p.text}">${esc(interp(b.text, ctx))}</h${b.level || 1}>`;
    if (b.type === "text") return `<p style="margin:0 0 16px;font-size:15px;line-height:1.65;color:${p.text}">${esc(interp(b.text, ctx)).replaceAll("\n", "<br/>")}</p>`;
    if (b.type === "image") return `<div style="margin:20px 0;text-align:center"><img src="${esc(b.url)}" alt="" style="max-width:${b.width || 560}px;width:100%"/></div>`;
    if (b.type === "button") return `<div style="margin:24px 0;text-align:center"><a href="${esc(b.url)}" style="display:inline-block;padding:12px 28px;background:${p.accent};color:${isBrand ? "#0b0d10" : "#fff"};text-decoration:none;font-weight:600;border-radius:2px">${esc(interp(b.text, ctx))}</a></div>`;
    if (b.type === "divider") return `<hr style="border:none;border-top:1px solid ${p.border};margin:24px 0"/>`;
    if (b.type === "spacer") return `<div style="height:${b.height || 24}px"></div>`;
    return "";
  }).join("");
  const footer = `<div style="padding:24px;text-align:center;border-top:1px solid ${p.border};color:${p.muted};font-size:12px">${ctx.physicalAddress ? `<div>${esc(ctx.physicalAddress)}</div>` : ""}<div style="margin-top:8px">You received this email because you opted in. <a href="${esc(ctx.unsubscribeUrl)}" style="color:${p.muted}">Unsubscribe</a></div></div>`;
  return `<!doctype html><html><body style="margin:0;background:${p.bg};font-family:-apple-system,sans-serif"><table width="100%" cellpadding="0" cellspacing="0" style="background:${p.bg};padding:32px 16px"><tr><td align="center"><table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:${p.card};border:1px solid ${p.border};border-radius:8px;overflow:hidden"><tr><td>${header}</td></tr><tr><td style="padding:8px 32px 24px">${body}</td></tr><tr><td>${footer}</td></tr></table></td></tr></table></body></html>`;
}
function randToken(len = 28) { const a = new Uint8Array(len); crypto.getRandomValues(a); return Array.from(a).map(b => b.toString(36).padStart(2, "0")).join("").slice(0, len); }

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY") || "";
  const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") || "";

  let enrolled = 0, sent = 0, advanced = 0, failed = 0;

  // 1) Enrollment: for each active automation, find contacts not yet in a run.
  const { data: automations } = await admin.from("email_automations").select("*").eq("status", "active");
  for (const a of automations || []) {
    const since = a.last_checked_at || a.created_at;
    let candidateIds: string[] = [];

    if (a.trigger === "lead_created") {
      const { data: contacts } = await admin.from("email_contacts").select("id")
        .eq("user_id", a.user_id).eq("source", "lead").eq("status", "subscribed").gt("created_at", since).limit(500);
      candidateIds = (contacts || []).map((c: any) => c.id);
    } else if (a.trigger === "contact_added") {
      const { data: contacts } = await admin.from("email_contacts").select("id")
        .eq("user_id", a.user_id).eq("status", "subscribed").gt("created_at", since).limit(500);
      candidateIds = (contacts || []).map((c: any) => c.id);
    } else if (a.trigger === "list_added") {
      const listId = a.trigger_config?.list_id;
      if (listId) {
        const { data: members } = await admin.from("email_list_members").select("contact_id,added_at")
          .eq("list_id", listId).gt("added_at", since).limit(500);
        candidateIds = (members || []).map((m: any) => m.contact_id);
      }
    }

    for (const cid of candidateIds) {
      const { error } = await admin.from("email_automation_runs").insert({
        user_id: a.user_id, automation_id: a.id, contact_id: cid,
        current_step: 0, next_run_at: new Date().toISOString(), status: "active",
      });
      if (!error) enrolled++;
    }
    await admin.from("email_automations").update({ last_checked_at: new Date().toISOString() }).eq("id", a.id);
  }

  // 2) Advance due runs
  const { data: dueRuns } = await admin.from("email_automation_runs")
    .select("*").eq("status", "active").lte("next_run_at", new Date().toISOString()).limit(50);

  for (const run of dueRuns || []) {
    const { data: steps } = await admin.from("email_automation_steps")
      .select("*").eq("automation_id", run.automation_id).order("step_order", { ascending: true });
    const step = (steps || [])[run.current_step];
    if (!step) {
      await admin.from("email_automation_runs").update({ status: "completed" }).eq("id", run.id);
      continue;
    }

    const [{ data: contact }, { data: template }, { data: settings }, { data: company }] = await Promise.all([
      admin.from("email_contacts").select("*").eq("id", run.contact_id).maybeSingle(),
      admin.from("email_templates").select("*").eq("id", step.template_id).maybeSingle(),
      admin.from("email_marketing_settings").select("*").eq("user_id", run.user_id).maybeSingle(),
      admin.from("company_profile").select("name,logo_url,address").maybeSingle(),
    ]);

    if (!contact || contact.status !== "subscribed" || !template || !settings?.from_email) {
      // skip this step but advance
      const nextIdx = run.current_step + 1;
      const nextStep = (steps || [])[nextIdx];
      const nextAt = nextStep ? new Date(Date.now() + (nextStep.delay_minutes || 0) * 60_000).toISOString() : null;
      await admin.from("email_automation_runs").update({
        current_step: nextIdx,
        next_run_at: nextAt || new Date().toISOString(),
        status: nextStep ? "active" : "completed",
      }).eq("id", run.id);
      continue;
    }

    // send
    let token = randToken();
    const { data: existing } = await admin.from("email_unsubs").select("token").eq("contact_id", contact.id).is("used_at", null).maybeSingle();
    if (existing?.token) token = existing.token;
    else await admin.from("email_unsubs").insert({ token, user_id: run.user_id, contact_id: contact.id });

    const unsubscribeUrl = `${Deno.env.get("SUPABASE_URL")}/functions/v1/email-unsubscribe?token=${encodeURIComponent(token)}`;
    const ctx = { siteName: company?.name || "Our Team", logoUrl: company?.logo_url, physicalAddress: settings.physical_address || company?.address || "", unsubscribeUrl, recipientName: contact.name };
    const html = renderBlocks(template, ctx);
    const subject = (step.subject || template.subject || "(no subject)").replaceAll("{{name}}", contact.name || "").replaceAll("{{site}}", ctx.siteName);
    const FROM = settings.from_name ? `${settings.from_name} <${settings.from_email}>` : settings.from_email;

    try {
      const r = await fetch(`${GATEWAY_URL}/emails`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${LOVABLE_API_KEY}`, "X-Connection-Api-Key": RESEND_API_KEY },
        body: JSON.stringify({
          from: FROM, to: [contact.email], subject, html,
          reply_to: settings.reply_to || undefined,
          headers: { "List-Unsubscribe": `<${unsubscribeUrl}>`, "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" },
        }),
      });
      const out = await r.json();
      if (!r.ok) { failed++; }
      else {
        sent++;
        await admin.from("email_sends").insert({
          user_id: run.user_id, automation_run_id: run.id, contact_id: contact.id,
          recipient_email: contact.email, status: "sent", message_id: out.id || null,
          sent_at: new Date().toISOString(),
        });
      }
    } catch (_) { failed++; }

    const nextIdx = run.current_step + 1;
    const nextStep = (steps || [])[nextIdx];
    const nextAt = nextStep ? new Date(Date.now() + (nextStep.delay_minutes || 0) * 60_000).toISOString() : null;
    await admin.from("email_automation_runs").update({
      current_step: nextIdx,
      next_run_at: nextAt || new Date().toISOString(),
      status: nextStep ? "active" : "completed",
    }).eq("id", run.id);
    advanced++;
  }

  return json({ enrolled, sent, advanced, failed });
});
