export const FITOUT_STATUSES = [
  "Planning",
  "In Progress",
  "Snag",
  "Completed",
  "On Hold",
  "Cancelled",
] as const;
export type FitoutStatus = (typeof FITOUT_STATUSES)[number];

export type FitoutProject = {
  id: string;
  date_added: string | null;
  hod: string | null;
  pm: string | null;
  city_province: string | null;
  brand: string | null;
  location: string | null;
  project_type: string | null;
  size_m2: number | null;
  fitout_period_days: number | null;
  start_on_site: string | null;
  fitout_completion: string | null;
  store_handover: string | null;
  snag_prep_date: string | null;
  contract_period_days: number | null;
  store_opening: string | null;
  snag_completion_date: string | null;
  comments: string | null;
  status: FitoutStatus;
  supervisor: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export const STATUS_TOKEN: Record<FitoutStatus, string> = {
  Planning: "bg-slate-500/15 text-slate-300 border-slate-500/30",
  "In Progress": "bg-sky-500/15 text-sky-300 border-sky-500/40",
  Snag: "bg-amber-500/15 text-amber-300 border-amber-500/40",
  Completed: "bg-emerald-500/15 text-emerald-300 border-emerald-500/40",
  "On Hold": "bg-orange-500/15 text-orange-300 border-orange-500/40",
  Cancelled: "bg-red-500/15 text-red-300 border-red-500/40",
};

export function daysBetween(a: Date, b: Date) {
  return Math.round((b.getTime() - a.getTime()) / 86400000);
}

export function daysFromToday(iso?: string | null) {
  if (!iso) return null;
  const d = new Date(iso);
  if (isNaN(d.getTime())) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  d.setHours(0, 0, 0, 0);
  return daysBetween(today, d);
}

export function fitoutProgress(p: Pick<FitoutProject, "start_on_site" | "fitout_period_days">) {
  if (!p.start_on_site || !p.fitout_period_days || p.fitout_period_days <= 0) return null;
  const start = new Date(p.start_on_site);
  const today = new Date();
  const elapsed = daysBetween(start, today);
  return Math.max(0, Math.min(100, (elapsed / p.fitout_period_days) * 100));
}

export const COLUMNS: { key: keyof FitoutProject; label: string }[] = [
  { key: "date_added", label: "Date Added" },
  { key: "hod", label: "HOD" },
  { key: "pm", label: "PM" },
  { key: "city_province", label: "City/Province" },
  { key: "brand", label: "Brand" },
  { key: "location", label: "Location" },
  { key: "project_type", label: "Project Type" },
  { key: "size_m2", label: "Size (m²)" },
  { key: "fitout_period_days", label: "Fitout Period (Days)" },
  { key: "start_on_site", label: "Start on Site" },
  { key: "fitout_completion", label: "Fitout Completion" },
  { key: "store_handover", label: "Store Handover" },
  { key: "snag_prep_date", label: "Snag Prep Date" },
  { key: "contract_period_days", label: "Contract Period (Days)" },
  { key: "store_opening", label: "Store Opening" },
  { key: "snag_completion_date", label: "Snag Completion" },
  { key: "supervisor", label: "Supervisor" },
  { key: "status", label: "Status" },
  { key: "comments", label: "Comments" },
];

export function exportCsv(rows: FitoutProject[]) {
  const headers = COLUMNS.map((c) => c.label);
  const data = rows.map((r) =>
    COLUMNS.map((c) => {
      const v = r[c.key];
      const s = v == null ? "" : String(v);
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    }).join(",")
  );
  const csv = [headers.join(","), ...data].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `fitout-projects-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// ---------- Import template (blank file with headers + sample row) ----------

const SAMPLE_ROW: Record<string, string | number> = {
  date_added: new Date().toISOString().slice(0, 10),
  hod: "Jane Smith",
  pm: "John Doe",
  city_province: "Dubai",
  brand: "Acme Coffee",
  location: "Mall of the Emirates",
  project_type: "Cafe",
  size_m2: 120,
  fitout_period_days: 45,
  start_on_site: "2026-06-01",
  fitout_completion: "2026-07-15",
  store_handover: "2026-07-20",
  snag_prep_date: "2026-07-22",
  contract_period_days: 60,
  store_opening: "2026-08-01",
  snag_completion_date: "2026-08-10",
  supervisor: "Mike Lee",
  status: "Planning",
  comments: "Replace this row with your data — the header row above must stay intact.",
};

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

export function downloadCsvTemplate() {
  const headers = COLUMNS.map((c) => c.label);
  const sample = COLUMNS.map((c) => {
    const v = SAMPLE_ROW[c.key as string] ?? "";
    const s = String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  });
  const csv = [headers.join(","), sample.join(",")].join("\n");
  downloadBlob(new Blob([csv], { type: "text/csv;charset=utf-8" }), "fitout-tracker-template.csv");
}

export async function downloadXlsxTemplate() {
  const XLSX = await import("xlsx");
  const headers = COLUMNS.map((c) => c.label);
  const sampleRow: Record<string, any> = {};
  COLUMNS.forEach((c) => { sampleRow[c.label] = SAMPLE_ROW[c.key as string] ?? ""; });

  const ws = XLSX.utils.json_to_sheet([sampleRow], { header: headers });
  // Set reasonable column widths
  (ws as any)["!cols"] = headers.map((h) => ({ wch: Math.max(14, h.length + 2) }));

  // Instructions sheet so users know how the importer reads each column.
  const instructions = [
    ["Fitout Tracker — Import Template"],
    [],
    ["1. Keep the header row in 'Projects' exactly as provided."],
    ["2. One project per row. Replace the example row with your data."],
    ["3. Dates can be Excel dates, YYYY-MM-DD, or DD/MM/YYYY."],
    ["4. Status must be one of: " + (FITOUT_STATUSES as readonly string[]).join(", ") + "."],
    ["5. At minimum each row needs Brand or Location."],
    ["6. Numeric fields: Size (m²), Fitout Period (Days), Contract Period (Days)."],
    ["7. Unknown columns are ignored. Empty cells are saved as blank."],
    [],
    ["Column", "Required", "Type", "Notes"],
    ...COLUMNS.map((c) => {
      const required = c.key === "brand" || c.key === "location" ? "Brand or Location" : "";
      const type = ["size_m2", "fitout_period_days", "contract_period_days"].includes(c.key as string)
        ? "Number"
        : ["date_added", "start_on_site", "fitout_completion", "store_handover", "snag_prep_date", "store_opening", "snag_completion_date"].includes(c.key as string)
          ? "Date"
          : c.key === "status" ? "Enum" : "Text";
      return [c.label, required, type, ""];
    }),
  ];
  const wsInfo = XLSX.utils.aoa_to_sheet(instructions);
  (wsInfo as any)["!cols"] = [{ wch: 28 }, { wch: 18 }, { wch: 10 }, { wch: 40 }];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Projects");
  XLSX.utils.book_append_sheet(wb, wsInfo, "Instructions");
  const out = XLSX.write(wb, { bookType: "xlsx", type: "array" });
  downloadBlob(new Blob([out], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }), "fitout-tracker-template.xlsx");
}

// ---------- Excel / CSV import ----------

const NUMERIC_KEYS = new Set<keyof FitoutProject>(["size_m2", "fitout_period_days", "contract_period_days"]);
const DATE_KEYS = new Set<keyof FitoutProject>([
  "date_added", "start_on_site", "fitout_completion", "store_handover",
  "snag_prep_date", "store_opening", "snag_completion_date",
]);

// Map common header variants -> canonical column key
const HEADER_ALIASES: Record<string, keyof FitoutProject> = {};
function regAlias(key: keyof FitoutProject, ...aliases: string[]) {
  for (const a of aliases) HEADER_ALIASES[normalizeHeader(a)] = key;
}
function normalizeHeader(s: string) {
  return s.toLowerCase().replace(/[\s_\-/().²]+/g, "").replace(/m2|sqm|sqmeters?/g, "m2");
}
COLUMNS.forEach((c) => regAlias(c.key, c.label, c.key));
regAlias("size_m2", "Size", "Area", "Area m2", "Sqm", "Size sqm");
regAlias("fitout_period_days", "Fitout Days", "Fitout Period", "Fit-out Period (Days)");
regAlias("contract_period_days", "Contract Days", "Contract Period");
regAlias("city_province", "City", "Province", "City / Province");
regAlias("project_type", "Type", "Project Type");
regAlias("start_on_site", "Start", "Start Date", "Site Start");
regAlias("fitout_completion", "Fitout Done", "Fit-out Completion");
regAlias("store_handover", "Handover", "Store Hand Over");
regAlias("snag_prep_date", "Snag Prep");
regAlias("store_opening", "Opening", "Store Open");
regAlias("snag_completion_date", "Snag Completion", "Snag Done");
regAlias("hod", "Head of Department", "H.O.D");
regAlias("pm", "Project Manager", "P.M");
regAlias("date_added", "Added", "Created");

function excelSerialToISO(n: number): string | null {
  // Excel epoch (with the 1900 leap-year bug)
  const ms = Math.round((n - 25569) * 86400 * 1000);
  const d = new Date(ms);
  if (isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
}
function parseDateCell(v: any): string | null {
  if (v == null || v === "") return null;
  if (v instanceof Date && !isNaN(v.getTime())) return v.toISOString().slice(0, 10);
  if (typeof v === "number") return excelSerialToISO(v);
  const s = String(v).trim();
  if (!s) return null;
  // dd/mm/yyyy or dd-mm-yyyy
  const m = s.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{2,4})$/);
  if (m) {
    let [_, dd, mm, yy] = m;
    if (yy.length === 2) yy = (Number(yy) > 50 ? "19" : "20") + yy;
    return `${yy}-${mm.padStart(2, "0")}-${dd.padStart(2, "0")}`;
  }
  const d = new Date(s);
  if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  return null;
}
function parseNumberCell(v: any): number | null {
  if (v == null || v === "") return null;
  if (typeof v === "number") return v;
  const n = Number(String(v).replace(/[^\d.\-]/g, ""));
  return isNaN(n) ? null : n;
}

export type ParsedRow = {
  rowNumber: number; // 1-based row in source file (excluding header)
  data: Partial<FitoutProject>;
  errors: string[];   // hard errors — block this row from being committed
  warnings: string[]; // soft notes (e.g. status defaulted)
  include: boolean;   // user toggle in preview
  matchedId?: string | null; // existing project id when upsert mode finds a match
};

export type ParseResult = {
  rows: ParsedRow[];
  unknownHeaders: string[];
  totalRows: number;
};

export async function parseFitoutFile(file: File): Promise<ParseResult> {
  const XLSX = await import("xlsx");
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: "array", cellDates: true });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const json = XLSX.utils.sheet_to_json<any>(ws, { defval: null, raw: true });
  const rows: ParsedRow[] = [];
  const unknown = new Set<string>();
  const validStatuses = new Set<string>(FITOUT_STATUSES as readonly string[]);

  json.forEach((obj, idx) => {
    const data: any = {};
    const errors: string[] = [];
    const warnings: string[] = [];

    for (const [header, val] of Object.entries(obj)) {
      const key = HEADER_ALIASES[normalizeHeader(header)];
      if (!key) { unknown.add(header); continue; }
      if (val == null || val === "") { data[key] = null; continue; }
      if (DATE_KEYS.has(key)) {
        const d = parseDateCell(val);
        if (d == null) errors.push(`${header}: cannot parse date "${val}"`);
        data[key] = d;
      } else if (NUMERIC_KEYS.has(key)) {
        const n = parseNumberCell(val);
        if (n == null) errors.push(`${header}: not a number "${val}"`);
        data[key] = n;
      } else if (key === "status") {
        const s = String(val).trim();
        const match = [...validStatuses].find((x) => x.toLowerCase() === s.toLowerCase());
        if (match) data[key] = match;
        else { data[key] = "Planning"; warnings.push(`Status "${s}" not recognized — defaulted to Planning`); }
      } else data[key] = String(val).trim();
    }

    // Skip fully-empty rows entirely
    if (!Object.values(data).some((v) => v != null && v !== "")) return;

    // Required fields
    if (!data.brand && !data.location) {
      errors.push("Missing both Brand and Location — at least one is required");
    }

    // Cross-field date sanity (warning, not error)
    const start = data.start_on_site ? new Date(data.start_on_site) : null;
    const done = data.fitout_completion ? new Date(data.fitout_completion) : null;
    if (start && done && done < start) {
      warnings.push("Fitout Completion is before Start on Site");
    }

    rows.push({
      rowNumber: idx + 2, // +1 header, +1 to be 1-based
      data,
      errors,
      warnings,
      include: errors.length === 0,
    });
  });

  return { rows, unknownHeaders: [...unknown], totalRows: json.length };
}

// Match an imported row against existing projects by brand + location (case-insensitive).
export function matchExistingProjects(
  parsed: ParsedRow[],
  existing: Pick<FitoutProject, "id" | "brand" | "location">[],
): ParsedRow[] {
  const key = (b?: string | null, l?: string | null) =>
    `${(b || "").trim().toLowerCase()}|${(l || "").trim().toLowerCase()}`;
  const map = new Map<string, string>();
  existing.forEach((e) => {
    const k = key(e.brand, e.location);
    if (k !== "|") map.set(k, e.id);
  });
  return parsed.map((r) => {
    const k = key(r.data.brand as string, r.data.location as string);
    return { ...r, matchedId: k === "|" ? null : map.get(k) || null };
  });
}


