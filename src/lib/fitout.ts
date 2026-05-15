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
