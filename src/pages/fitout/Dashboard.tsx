import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { FitoutProject, daysFromToday } from "@/lib/fitout";
import StatusBadge from "@/components/fitout/StatusBadge";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, LineChart, Line,
} from "recharts";

export default function FitoutDashboard() {
  const [rows, setRows] = useState<FitoutProject[]>([]);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("fitout_projects" as any).select("*");
      setRows((data || []) as any);
    })();
  }, []);

  const stats = useMemo(() => {
    const total = rows.length;
    const inProg = rows.filter((r) => r.status === "In Progress").length;
    const done = rows.filter((r) => r.status === "Completed").length;
    const periods = rows.map((r) => r.fitout_period_days).filter((x): x is number => !!x);
    const avg = periods.length ? Math.round(periods.reduce((a, b) => a + b, 0) / periods.length) : 0;
    const size = rows.reduce((a, r) => a + (r.size_m2 || 0), 0);
    return { total, inProg, done, avg, size };
  }, [rows]);

  const byKey = (k: keyof FitoutProject) => {
    const m = new Map<string, number>();
    rows.forEach((r) => {
      const v = (r[k] as string) || "Unknown";
      m.set(v, (m.get(v) || 0) + 1);
    });
    return Array.from(m, ([name, value]) => ({ name, value }));
  };

  const monthly = useMemo(() => {
    const m = new Map<string, number>();
    rows.forEach((r) => {
      if (!r.start_on_site) return;
      const k = r.start_on_site.slice(0, 7);
      m.set(k, (m.get(k) || 0) + 1);
    });
    return Array.from(m, ([name, value]) => ({ name, value })).sort((a, b) => a.name.localeCompare(b.name));
  }, [rows]);

  const upcoming = useMemo(() => {
    return rows
      .filter((r) => {
        const d = daysFromToday(r.store_opening);
        return d != null && d >= 0 && d <= 30;
      })
      .sort((a, b) => (a.store_opening || "").localeCompare(b.store_opening || ""));
  }, [rows]);

  return (
    <div className="p-8 max-w-[1600px] mx-auto">
      <div className="mb-6">
        <p className="text-xs tracking-[0.3em] text-accent mb-1">FITOUT TRACKER</p>
        <h1 className="font-serif text-4xl">Dashboard</h1>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
        <KPI label="Total Projects" value={stats.total} />
        <KPI label="In Progress" value={stats.inProg} />
        <KPI label="Completed" value={stats.done} />
        <KPI label="Avg Fitout (days)" value={stats.avg} />
        <KPI label="Total Size (m²)" value={stats.size.toLocaleString()} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
        <Chart title="By Status"><BarChartView data={byKey("status")} /></Chart>
        <Chart title="By Brand"><BarChartView data={byKey("brand")} /></Chart>
        <Chart title="By City / Province"><BarChartView data={byKey("city_province")} /></Chart>
        <Chart title="By Project Type"><BarChartView data={byKey("project_type")} /></Chart>
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

      <Card className="p-6">
        <h2 className="font-serif text-2xl mb-4">Upcoming Store Openings (next 30 days)</h2>
        {upcoming.length === 0 ? (
          <p className="text-muted-foreground text-sm">No openings in the next 30 days.</p>
        ) : (
          <div className="space-y-2">
            {upcoming.map((r) => (
              <Link key={r.id} to={`/fitout/projects/${r.id}`} className="flex items-center justify-between p-3 rounded border hover:bg-muted/30">
                <div>
                  <div className="font-medium">{r.brand ?? "—"} — {r.location ?? "—"}</div>
                  <div className="text-xs text-muted-foreground">{r.city_province} · PM: {r.pm ?? "—"}</div>
                </div>
                <div className="flex items-center gap-3">
                  <StatusBadge status={r.status} />
                  <div className="text-right">
                    <div className="text-sm">{r.store_opening}</div>
                    <div className="text-xs text-muted-foreground">in {daysFromToday(r.store_opening)} day(s)</div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

function KPI({ label, value }: { label: string; value: any }) {
  return (
    <Card className="p-5">
      <p className="text-xs text-muted-foreground mb-2">{label}</p>
      <p className="font-serif text-3xl">{value}</p>
    </Card>
  );
}

function Chart({ title, children, wide }: { title: string; children: React.ReactNode; wide?: boolean }) {
  return (
    <Card className={`p-5 ${wide ? "lg:col-span-2" : ""}`}>
      <h3 className="font-serif text-lg mb-3">{title}</h3>
      {children}
    </Card>
  );
}

function BarChartView({ data }: { data: { name: string; value: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height={240}>
      <BarChart data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
        <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={11} />
        <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} allowDecimals={false} />
        <Tooltip contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))" }} />
        <Bar dataKey="value" fill="hsl(var(--accent))" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
