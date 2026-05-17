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
  return s.toLowerCase().replace(/[\s_/().²\-\\]+/g, "").replace(/m2|sqm|sqmeters?/g, "m2");
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
  const m = s.match(/^(\d{1,2})[/.\-](\d{1,2})[/.\-](\d{2,4})$/);
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

function sheetRangeName(name: string): string {
  return `'${String(name).replace(/'/g, "''")}'`;
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
    const meta = await gatewayFetch(`/spreadsheets/${sheetId}?fields=sheets.properties.title`);
    const worksheets = (meta.sheets || [])
      .map((s: any) => s?.properties?.title)
      .filter(Boolean);
    if (!worksheets.length) throw new Error("No worksheets found in spreadsheet");

    const requestedWorksheet = String(cfg.worksheet_name || "").trim();
    const worksheet = requestedWorksheet
      ? worksheets.find((title: string) => title.toLowerCase() === requestedWorksheet.toLowerCase()) || worksheets[0]
      : worksheets[0];
    const worksheetWarning = requestedWorksheet && worksheet.toLowerCase() !== requestedWorksheet.toLowerCase()
      ? `Worksheet "${requestedWorksheet}" was not found. Used "${worksheet}" instead. Available worksheets: ${worksheets.join(", ")}`
      : null;

    const range = `${sheetRangeName(worksheet)}!A${cfg.header_row || 1}:Z10000`;
    const valuesRes = await gatewayFetch(`/spreadsheets/${sheetId}/values/${range}`);
    const values: any[][] = valuesRes.values || [];
    if (values.length < 1) throw new Error("Sheet is empty");

    const headerRow = values[0].map((h) => String(h ?? ""));
    const dataRows = values.slice(1);

    const colLetter = (i: number) => {
      let s = ""; let n = i;
      while (n >= 0) { s = String.fromCharCode(65 + (n % 26)) + s; n = Math.floor(n / 26) - 1; }
      return s;
    };
    const colMap: { idx: number; key: string; header: string; col: string }[] = [];
    const unmappedHeaders: { col: string; header: string }[] = [];
    headerRow.forEach((h, idx) => {
      const k = HEADER_ALIASES[normHeader(h)];
      const col = colLetter(idx);
      if (k) colMap.push({ idx, key: k, header: h, col });
      else if (h.trim()) unmappedHeaders.push({ col, header: h });
    });

    const requiredKeys = ["brand", "location"];
    const missingRequired = requiredKeys.filter((k) => !colMap.some((c) => c.key === k));
    if (missingRequired.length) {
      throw new Error(
        `Missing required column(s): ${missingRequired.map((k) => HEADER_LABELS[k]).join(", ")}. Found headers: ${headerRow.filter(Boolean).join(" | ")}`,
      );
    }

    const { data: existing } = await supabase.from("fitout_projects")
      .select("id, brand, city_province, store_opening");
    const dedupKey = (b: any, c: any, o: any) =>
      `${(b || "").toString().trim().toLowerCase()}|${(c || "").toString().trim().toLowerCase()}|${(o || "").toString().trim().toLowerCase()}`;
    const existingMap = new Map<string, string>();
    (existing || []).forEach((e) => {
      const k = dedupKey(e.brand, e.city_province, e.store_opening);
      if (!k.startsWith("|")) existingMap.set(k, e.id);
    });

    let inserted = 0, updated = 0, skipped = 0;
    const errors: any[] = [];

    for (let i = 0; i < dataRows.length; i++) {
      const row = dataRows[i];
      const rowNumber = i + 2 + ((cfg.header_row || 1) - 1);
      if (!row || row.every((v) => v == null || String(v).trim() === "")) { skipped++; continue; }

      const data: any = {};
      const rowErrors: { column: string; header: string; value: string; problem: string }[] = [];
      for (const { idx, key, header, col } of colMap) {
        const val = row[idx];
        if (val == null || val === "") { data[key] = null; continue; }
        if (DATE_KEYS.has(key)) {
          const d = parseDate(val);
          if (!d) rowErrors.push({ column: col, header, value: String(val), problem: "Invalid date — use DD/MM/YYYY or YYYY-MM-DD" });
          data[key] = d;
        } else if (NUMERIC_KEYS.has(key)) {
          const n = parseNum(val);
          if (n == null) rowErrors.push({ column: col, header, value: String(val), problem: "Not a number" });
          data[key] = n;
        } else if (key === "status") {
          const s = String(val).trim();
          const sl = s.toLowerCase();
          const aliases: Record<string, string> = {
            "running": "In Progress", "in-progress": "In Progress", "in progress": "In Progress",
            "ongoing": "In Progress", "active": "In Progress", "wip": "In Progress",
            "upcoming": "Planning", "planned": "Planning", "to start": "Planning", "not started": "Planning",
            "hold": "On Hold", "on-hold": "On Hold", "paused": "On Hold",
            "done": "Completed", "complete": "Completed", "finished": "Completed", "handover": "Completed",
            "snagging": "Snag", "snags": "Snag",
            "cancel": "Cancelled", "canceled": "Cancelled", "cancelled": "Cancelled",
          };
          let m = STATUSES.find((x) => x.toLowerCase() === sl);
          if (!m && aliases[sl]) m = aliases[sl];
          if (!m) rowErrors.push({ column: col, header, value: s, problem: `Unknown status — allowed: ${STATUSES.join(", ")}` });
          data[key] = m || "Planning";
        } else {
          data[key] = String(val).trim();
        }
      }

      if (!data.brand || !data.location) {
        const missing = [!data.brand && "Brand", !data.location && "Location"].filter(Boolean).join(" & ");
        rowErrors.push({ column: "-", header: missing as string, value: "", problem: `${missing} is required` });
      }
      if (rowErrors.length) {
        errors.push({
          row: rowNumber,
          brand: data.brand || "",
          location: data.location || "",
          city: data.city_province || "",
          errors: rowErrors,
        });
        skipped++;
        continue;
      }

      const k = dedupKey(data.brand, data.city_province, data.store_opening);
      const matchId = existingMap.get(k);

      if (matchId) {
        const { error } = await supabase.from("fitout_projects").update(data).eq("id", matchId);
        if (error) {
          errors.push({ row: rowNumber, brand: data.brand, location: data.location, city: data.city_province, action: "update", errors: [{ column: "-", header: "Database", value: "", problem: error.message }] });
          skipped++;
        } else updated++;
      } else {
        const { error, data: ins } = await supabase.from("fitout_projects").insert(data).select("id").single();
        if (error) {
          errors.push({ row: rowNumber, brand: data.brand, location: data.location, city: data.city_province, action: "insert", errors: [{ column: "-", header: "Database", value: "", problem: error.message }] });
          skipped++;
        } else { inserted++; if (ins?.id) existingMap.set(k, ins.id); }
      }
    }

    const result = {
      inserted, updated, skipped, errors,
      worksheet_warning: worksheetWarning,
      unmapped_headers: unmappedHeaders,
      mapped_headers: colMap.map((c) => ({ col: c.col, header: c.header, field: HEADER_LABELS[c.key] })),
    };
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
