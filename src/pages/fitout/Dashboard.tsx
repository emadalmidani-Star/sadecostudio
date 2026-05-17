import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarComp } from "@/components/ui/calendar";
import { Skeleton } from "@/components/ui/skeleton";
import { FitoutProject, daysFromToday } from "@/lib/fitout";
import StatusBadge from "@/components/fitout/StatusBadge";
import PMAvatar from "@/components/PMAvatar";
import { FileSpreadsheet, X, Calendar as CalIcon } from "lucide-react";
import { toast } from "sonner";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, LineChart, Line, Cell,
} from "recharts";

type Range = "30" | "90" | "180" | "custom" | "all";

export default function FitoutDashboard() {
  const [rows, setRows] = useState<FitoutProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [range, setRange] = useState<Range>("90");
  const [customFrom, setCustomFrom] = useState<Date | undefined>();
  const [customTo, setCustomTo] = useState<Date | undefined>();
  const [chartFilter, setChartFilter] = useState<{ field: keyof FitoutProject; value: string } | null>(null);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("fitout_projects" as any).select("*");
      setRows((data || []) as any);
      setLoading(false);
    })();
  }, []);

  const [from, to] = useMemo<[Date | null, Date | null]>(() => {
    if (range === "all") return [null, null];
    if (range === "custom") return [customFrom || null, customTo || null];
    const days = Number(range);
    const t = new Date(); t.setHours(0, 0, 0, 0);
    const f = new Date(t); f.setDate(f.getDate() - days);
    const upper = new Date(t); upper.setDate(upper.getDate() + days);
    return [f, upper];
  }, [range, customFrom, customTo]);

  const inRange = (iso?: string | null) => {
    if (!iso) return true;
    const d = new Date(iso);
    if (isNaN(d.getTime())) return true;
    if (from && d < from) return false;
    if (to && d > to) return false;
    return true;
  };

  const ranged = useMemo(() => rows.filter(r => inRange(r.start_on_site) || inRange(r.store_opening)), [rows, from, to]);

  const stats = useMemo(() => {
    const total = ranged.length;
    const inProg = ranged.filter((r) => r.status === "In Progress").length;
    const done = ranged.filter((r) => r.status === "Completed").length;
    const periods = ranged.map((r) => r.fitout_period_days).filter((x): x is number => !!x);
    const avg = periods.length ? Math.round(periods.reduce((a, b) => a + b, 0) / periods.length) : 0;
    const size = ranged.reduce((a, r) => a + (r.size_m2 || 0), 0);
    return { total, inProg, done, avg, size };
  }, [ranged]);

  const byKey = (k: keyof FitoutProject) => {
    const m = new Map<string, number>();
    ranged.forEach((r) => {
      const v = (r[k] as string) || "Unknown";
      m.set(v, (m.get(v) || 0) + 1);
    });
    return Array.from(m, ([name, value]) => ({ name, value }));
  };

  const monthly = useMemo(() => {
    const m = new Map<string, number>();
    ranged.forEach((r) => {
      if (!r.start_on_site) return;
      m.set(r.start_on_site.slice(0, 7), (m.get(r.start_on_site.slice(0, 7)) || 0) + 1);
    });
    return Array.from(m, ([name, value]) => ({ name, value })).sort((a, b) => a.name.localeCompare(b.name));
  }, [ranged]);

  const upcoming = useMemo(() => {
    let list = ranged
      .filter((r) => {
        const d = daysFromToday(r.store_opening);
        return d != null && d >= 0 && d <= 60;
      })
      .sort((a, b) => (a.store_opening || "").localeCompare(b.store_opening || ""));
    if (chartFilter) list = list.filter(r => (r[chartFilter.field] || "Unknown") === chartFilter.value);
    return list;
  }, [ranged, chartFilter]);

  async function exportExcel() {
    if (upcoming.length === 0) return toast.error("Nothing to export");
    const XLSX = await import("xlsx");
    const data = upcoming.map(r => ({
      Brand: r.brand, Location: r.location, City: r.city_province, PM: r.pm,
      Status: r.status, "Store Opening": r.store_opening,
      "Days Until": daysFromToday(r.store_opening),
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Upcoming Openings");
    const out = XLSX.write(wb, { bookType: "xlsx", type: "array" });
    const blob = new Blob([out], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `upcoming-openings-${new Date().toISOString().slice(0, 10)}.xlsx`; a.click();
    URL.revokeObjectURL(url);
    toast.success("Excel exported");
  }

  return (
    <div className="p-6 md:p-8 max-w-[1600px] mx-auto">
      <div className="mb-6 flex items-end justify-between flex-wrap gap-4">
        <div>
          <p className="eyebrow mb-1">FITOUT OPERATIONS</p>
          <h1 className="page-title">Dashboard</h1>
        </div>
        <div className="flex items-center gap-2">
          <Select value={range} onValueChange={(v) => setRange(v as Range)}>
            <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="30">Last/Next 30 days</SelectItem>
              <SelectItem value="90">Last/Next 90 days</SelectItem>
              <SelectItem value="180">Last/Next 180 days</SelectItem>
              <SelectItem value="custom">Custom range</SelectItem>
              <SelectItem value="all">All time</SelectItem>
            </SelectContent>
          </Select>
          {range === "custom" && (
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm"><CalIcon className="w-4 h-4 mr-2" />
                  {customFrom && customTo ? `${customFrom.toLocaleDateString()} – ${customTo.toLocaleDateString()}` : "Pick dates"}
                </Button>
              </PopoverTrigger>
              <PopoverContent align="end" className="p-0 w-auto">
                <CalendarComp mode="range" selected={{ from: customFrom, to: customTo }}
                  onSelect={(r: any) => { setCustomFrom(r?.from); setCustomTo(r?.to); }}
                  className="p-3 pointer-events-auto" numberOfMonths={2} />
              </PopoverContent>
            </Popover>
          )}
        </div>
      </div>

      {chartFilter && (
        <div className="mb-4">
          <button onClick={() => setChartFilter(null)}
            className="inline-flex items-center gap-2 px-3 py-1.5 text-xs rounded-full border border-accent bg-accent/10 text-accent">
            Filtered by {String(chartFilter.field)}: <strong>{chartFilter.value}</strong>
            <X className="w-3 h-3" />
          </button>
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
        <KPI label="Total Projects" value={loading ? "—" : stats.total} />
        <KPI label="In Progress" value={loading ? "—" : stats.inProg} />
        <KPI label="Completed" value={loading ? "—" : stats.done} />
        <KPI label="Avg Fitout (days)" value={loading ? "—" : stats.avg} />
        <KPI label="Total Size (m²)" value={loading ? "—" : stats.size.toLocaleString()} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
        <Chart title="By Status"><BarChartView data={byKey("status")} onPick={(v) => setChartFilter({ field: "status", value: v })} active={chartFilter?.field === "status" ? chartFilter.value : null} /></Chart>
        <Chart title="By Brand"><BarChartView data={byKey("brand")} onPick={(v) => setChartFilter({ field: "brand", value: v })} active={chartFilter?.field === "brand" ? chartFilter.value : null} /></Chart>
        <Chart title="By City / Province"><BarChartView data={byKey("city_province")} onPick={(v) => setChartFilter({ field: "city_province", value: v })} active={chartFilter?.field === "city_province" ? chartFilter.value : null} /></Chart>
        <Chart title="By Project Type"><BarChartView data={byKey("project_type")} onPick={(v) => setChartFilter({ field: "project_type", value: v })} active={chartFilter?.field === "project_type" ? chartFilter.value : null} /></Chart>
        <Chart title="Projects Started per Month" wide>
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={monthly}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={11} />
              <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} allowDecimals={false} />
              <Tooltip contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))" }} />
              <Line type="monotone" dataKey="value" stroke="hsl(var(--accent))" strokeWidth={2} dot />
            </LineChart>
          </ResponsiveContainer>
        </Chart>
      </div>

      <Card className="p-6 shadow-card">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
          <h2 className="font-serif text-2xl">Upcoming Store Openings</h2>
          <Button size="sm" variant="outline" onClick={exportExcel}><FileSpreadsheet className="w-4 h-4 mr-2" />Export to Excel</Button>
        </div>
        {loading ? (
          <div className="space-y-2">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-14 w-full" />)}</div>
        ) : upcoming.length === 0 ? (
          <p className="text-muted-foreground text-sm">No openings match the current filters.</p>
        ) : (
          <div className="space-y-2">
            {upcoming.map((r) => {
              const days = daysFromToday(r.store_opening);
              const dCls = days == null ? "" : days < 7 ? "bg-red-500/15 text-red-600 border-red-500/30" :
                days <= 14 ? "bg-amber-500/15 text-amber-700 border-amber-500/30" :
                "bg-emerald-500/15 text-emerald-700 border-emerald-500/30";
              return (
                <Link key={r.id} to={`/fitout/projects/${r.id}`}
                  className="flex items-center justify-between p-3 rounded border hover:bg-muted/30 gap-3 flex-wrap">
                  <div className="flex items-center gap-3 min-w-0">
                    <PMAvatar name={r.pm} />
                    <div className="min-w-0">
                      <div className="font-medium truncate">{r.brand ?? "—"} — {r.location ?? "—"}</div>
                      <div className="text-xs text-muted-foreground">{r.city_province} · PM: {r.pm ?? "—"}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <StatusBadge status={r.status} />
                    <div className="text-right">
                      <div className="text-sm">{r.store_opening}</div>
                      <span className={`inline-block mt-0.5 px-2 py-0.5 text-[10px] rounded-full border ${dCls}`}>
                        {days != null && (days === 0 ? "Today" : `${days}d`)}
                      </span>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
}

function KPI({ label, value }: { label: string; value: any }) {
  return (
    <Card className="p-5 shadow-card">
      <p className="text-xs text-muted-foreground mb-2">{label}</p>
      <p className="font-serif text-3xl">{value}</p>
    </Card>
  );
}

function Chart({ title, children, wide }: { title: string; children: React.ReactNode; wide?: boolean }) {
  return (
    <Card className={`p-5 shadow-card ${wide ? "lg:col-span-2" : ""}`}>
      <h3 className="font-serif text-lg mb-3">{title}</h3>
      {children}
    </Card>
  );
}

function BarChartView({ data, onPick, active }: { data: { name: string; value: number }[]; onPick: (v: string) => void; active: string | null }) {
  return (
    <ResponsiveContainer width="100%" height={240}>
      <BarChart data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
        <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={11} />
        <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} allowDecimals={false} />
        <Tooltip contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))" }} />
        <Bar dataKey="value" radius={[4, 4, 0, 0]} cursor="pointer"
          onClick={(d: any) => d?.name && onPick(d.name)}>
          {data.map((d, i) => (
            <Cell key={i} fill={active && active === d.name ? "hsl(var(--primary))" : "hsl(var(--accent))"} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
