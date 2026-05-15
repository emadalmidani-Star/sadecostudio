// Sync Fitout Tracker from a Google Sheet.
// One-way: Sheet -> fitout_projects. Dedup by Brand+Location+City (case-insensitive).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const GATEWAY = "https://connector-gateway.lovable.dev/google_sheets/v4";
const STATUSES = ["Planning", "In Progress", "Snag", "Completed", "On Hold", "Cancelled"];

const COLUMN_KEYS = [
  "date_added", "hod", "pm", "city_province", "brand", "location", "project_type",
  "size_m2", "fitout_period_days", "start_on_site", "fitout_completion",
  "store_handover", "snag_prep_date", "contract_period_days", "store_opening",
  "snag_completion_date", "supervisor", "status", "comments",
] as const;

const HEADER_LABELS: Record<string, string> = {
  date_added: "Date Added", hod: "HOD", pm: "PM", city_province: "City/Province",
  brand: "Brand", location: "Location", project_type: "Project Type",
  size_m2: "Size (m²)", fitout_period_days: "Fitout Period (Days)",
  start_on_site: "Start on Site", fitout_completion: "Fitout Completion",
  store_handover: "Store Handover", snag_prep_date: "Snag Prep Date",
  contract_period_days: "Contract Period (Days)", store_opening: "Store Opening",
  snag_completion_date: "Snag Completion", supervisor: "Supervisor",
  status: "Status", comments: "Comments",
};

const NUMERIC_KEYS = new Set(["size_m2", "fitout_period_days", "contract_period_days"]);
const DATE_KEYS = new Set([
  "date_added", "start_on_site", "fitout_completion", "store_handover",
  "snag_prep_date", "store_opening", "snag_completion_date",
]);

function normHeader(s: string) {
  return s.toLowerCase().replace(/[\s_\\-/().²]+/g, "").replace(/m2|sqm|sqmeters?/g, "m2");
}
const HEADER_ALIASES: Record<string, string> = {};
function regAlias(key: string, ...aliases: string[]) {
  for (const a of aliases) HEADER_ALIASES[normHeader(a)] = key;
}
for (const k of COLUMN_KEYS) { regAlias(k, HEADER_LABELS[k], k); }
regAlias("size_m2", "Size", "Area", "Area m2", "Sqm");
regAlias("fitout_period_days", "Fitout Days", "Fitout Period");
regAlias("contract_period_days", "Contract Days", "Contract Period");
regAlias("city_province", "City", "Province");
regAlias("project_type", "Type");
regAlias("start_on_site", "Start", "Start Date");
regAlias("store_handover", "Handover");
regAlias("snag_prep_date", "Snag Prep");
regAlias("store_opening", "Opening");
regAlias("snag_completion_date", "Snag Completion", "Snag Done");
regAlias("hod", "Head of Department");
regAlias("pm", "Project Manager");
regAlias("date_added", "Added", "Created");

function parseDate(v: any): string | null {
  if (v == null || v === "") return null;
  const s = String(v).trim();
  const m = s.match(/^(\d{1,2})[/\\-.](\d{1,2})[/\\-.](\d{2,4})$/);
  if (m) {
    let [_, dd, mm, yy] = m;
    if (yy.length === 2) yy = (Number(yy) > 50 ? "19" : "20") + yy;
    return `${yy}-${mm.padStart(2, "0")}-${dd.padStart(2, "0")}`;
  }
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
}
function parseNum(v: any): number | null {
  if (v == null || v === "") return null;
  const n = Number(String(v).replace(/[^\d.\-]/g, ""));
  return isNaN(n) ? null : n;
}

function extractSheetId(url: string): string | null {
  const m = url.match(/\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/);
  return m ? m[1] : null;
}

async function gatewayFetch(path: string, init?: RequestInit) {
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  const GS_KEY = Deno.env.get("GOOGLE_SHEETS_API_KEY");
  if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");
  if (!GS_KEY) throw new Error("GOOGLE_SHEETS_API_KEY not configured (connect Google Sheets)");
  const res = await fetch(`${GATEWAY}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${LOVABLE_API_KEY}`,
      "X-Connection-Api-Key": GS_KEY,
      "Content-Type": "application/json",
      ...(init?.headers || {}),
    },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Google Sheets gateway ${res.status}: ${text}`);
  }
  return res.json();
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  let triggeredBy = "manual";
  try {
    const body = await req.json().catch(() => ({}));
    triggeredBy = body?.triggered_by ?? "manual";
  } catch (_) {}

  const { data: cfg } = await supabase.from("fitout_sheet_config").select("*").limit(1).maybeSingle();
  if (!cfg || !cfg.sheet_url) {
    return new Response(JSON.stringify({ error: "Sheet not configured" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  if (triggeredBy === "cron" && !cfg.enabled) {
    return new Response(JSON.stringify({ skipped: "scheduled sync disabled" }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const sheetId = cfg.sheet_id || extractSheetId(cfg.sheet_url);
  if (!sheetId) {
    return new Response(JSON.stringify({ error: "Invalid sheet URL" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const { data: run } = await supabase.from("fitout_sheet_sync_runs")
    .insert({ triggered_by: triggeredBy, status: "running" }).select().single();

  try {
    let worksheet = cfg.worksheet_name;
    if (!worksheet) {
      const meta = await gatewayFetch(`/spreadsheets/${sheetId}?fields=sheets.properties.title`);
      worksheet = meta.sheets?.[0]?.properties?.title;
      if (!worksheet) throw new Error("No worksheets found in spreadsheet");
    }

    const range = `${worksheet}!A${cfg.header_row || 1}:Z`;
    const valuesRes = await gatewayFetch(`/spreadsheets/${sheetId}/values/${encodeURIComponent(range)}`);
    const values: any[][] = valuesRes.values || [];
    if (values.length < 1) throw new Error("Sheet is empty");

    const headerRow = values[0].map((h) => String(h ?? ""));
    const dataRows = values.slice(1);

    const colMap: { idx: number; key: string }[] = [];
    headerRow.forEach((h, idx) => {
      const k = HEADER_ALIASES[normHeader(h)];
      if (k) colMap.push({ idx, key: k });
    });

    const { data: existing } = await supabase.from("fitout_projects")
      .select("id, brand, location, city_province");
    const dedupKey = (b: any, l: any, c: any) =>
      `${(b || "").toString().trim().toLowerCase()}|${(l || "").toString().trim().toLowerCase()}|${(c || "").toString().trim().toLowerCase()}`;
    const existingMap = new Map<string, string>();
    (existing || []).forEach((e) => {
      const k = dedupKey(e.brand, e.location, e.city_province);
      if (k !== "||") existingMap.set(k, e.id);
    });

    let inserted = 0, updated = 0, skipped = 0;
    const errors: any[] = [];

    for (let i = 0; i < dataRows.length; i++) {
      const row = dataRows[i];
      const rowNumber = i + 2 + (cfg.header_row - 1);
      if (!row || row.every((v) => v == null || String(v).trim() === "")) { skipped++; continue; }

      const data: any = {};
      const rowErrors: string[] = [];
      for (const { idx, key } of colMap) {
        const val = row[idx];
        if (val == null || val === "") { data[key] = null; continue; }
        if (DATE_KEYS.has(key)) {
          const d = parseDate(val);
          if (!d) rowErrors.push(`${HEADER_LABELS[key]}: bad date "${val}"`);
          data[key] = d;
        } else if (NUMERIC_KEYS.has(key)) {
          const n = parseNum(val);
          if (n == null) rowErrors.push(`${HEADER_LABELS[key]}: not a number "${val}"`);
          data[key] = n;
        } else if (key === "status") {
          const s = String(val).trim();
          const m = STATUSES.find((x) => x.toLowerCase() === s.toLowerCase());
          data[key] = m || "Planning";
        } else {
          data[key] = String(val).trim();
        }
      }

      if (!data.brand && !data.location) {
        rowErrors.push("Missing Brand and Location");
      }
      if (rowErrors.length) {
        errors.push({ row: rowNumber, brand: data.brand, location: data.location, errors: rowErrors });
        skipped++;
        continue;
      }

      const k = dedupKey(data.brand, data.location, data.city_province);
      const matchId = existingMap.get(k);

      if (matchId) {
        const { error } = await supabase.from("fitout_projects").update(data).eq("id", matchId);
        if (error) { errors.push({ row: rowNumber, errors: [error.message] }); skipped++; }
        else updated++;
      } else {
        const { error, data: ins } = await supabase.from("fitout_projects").insert(data).select("id").single();
        if (error) { errors.push({ row: rowNumber, errors: [error.message] }); skipped++; }
        else { inserted++; if (ins?.id) existingMap.set(k, ins.id); }
      }
    }

    const result = { inserted, updated, skipped, errors };
    await supabase.from("fitout_sheet_sync_runs").update({
      finished_at: new Date().toISOString(),
      inserted, updated, skipped, errors, status: "success",
    }).eq("id", run!.id);
    await supabase.from("fitout_sheet_config").update({
      sheet_id: sheetId,
      worksheet_name: worksheet,
      last_synced_at: new Date().toISOString(),
      last_result: result,
    }).eq("id", cfg.id);

    return new Response(JSON.stringify({ ok: true, ...result }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    const msg = err?.message || String(err);
    await supabase.from("fitout_sheet_sync_runs").update({
      finished_at: new Date().toISOString(),
      status: "failed", errors: [{ message: msg }],
    }).eq("id", run!.id);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
