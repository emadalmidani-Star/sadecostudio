import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, FolderKanban, CheckCircle2, Clock, Hammer, Search } from "lucide-react";
import LazyImage from "@/components/LazyImage";
import ProjectProgress from "@/components/ProjectProgress";
import EmptyState from "@/components/EmptyState";

type Filter = "all" | "ongoing" | "in_progress" | "completed";

export default function Dashboard() {
  const [projects, setProjects] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<Filter | { kind: "city" | "brand"; value: string }>("all");

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("projects").select("*").order("updated_at", { ascending: false });
      setProjects(data || []);
      setLoading(false);
    })();
  }, []);

  const stats = useMemo(() => ({
    total: projects.length,
    completed: projects.filter(p => p.status === "completed").length,
    ongoing: projects.filter(p => p.status === "ongoing").length,
    inProgress: projects.filter(p => p.status === "in_progress").length,
  }), [projects]);

  const cities = useMemo(() => Array.from(new Set(projects.map(p => p.location).filter(Boolean))).sort(), [projects]);
  const brands = useMemo(() => Array.from(new Set(projects.map(p => p.client_name).filter(Boolean))).sort(), [projects]);

  const recent = useMemo(() => {
    const text = q.trim().toLowerCase();
    return projects
      .filter(p => {
        if (typeof filter === "string") {
          if (filter !== "all" && p.status !== filter) return false;
        } else if (filter.kind === "city" && p.location !== filter.value) return false;
        else if (filter.kind === "brand" && p.client_name !== filter.value) return false;
        if (!text) return true;
        return [p.name, p.location, p.client_name, p.type].filter(Boolean).some((v: string) => v.toLowerCase().includes(text));
      })
      .slice(0, 9);
  }, [projects, q, filter]);

  return (
    <div className="p-6 md:p-10 max-w-7xl mx-auto">
      <div className="flex items-end justify-between mb-10 gap-4 flex-wrap">
        <div>
          <p className="eyebrow mb-2">OVERVIEW</p>
          <h1 className="page-title">Welcome back</h1>
          <p className="text-muted-foreground mt-2">Manage SADECO projects and generate client-ready documents.</p>
        </div>
        <Button asChild size="lg"><Link to="/projects/new"><Plus className="w-4 h-4 mr-2" />New Project</Link></Button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6 mb-10">
        <StatCard icon={FolderKanban} label="Total Projects" value={stats.total} to="/projects" loading={loading} />
        <StatCard icon={Hammer} label="In Progress" value={stats.inProgress} to="/projects?status=in_progress" loading={loading} />
        <StatCard icon={Clock} label="Ongoing" value={stats.ongoing} to="/projects?status=ongoing" loading={loading} />
        <StatCard icon={CheckCircle2} label="Completed" value={stats.completed} to="/projects?status=completed" loading={loading} />
      </div>

      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <h2 className="font-serif text-2xl">Recent Projects</h2>
        <Link to="/projects" className="text-sm text-accent hover:underline">View all →</Link>
      </div>

      <div className="flex flex-col md:flex-row md:items-center gap-3 mb-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input value={q} onChange={e => setQ(e.target.value)} placeholder="Search projects…" className="pl-9" />
        </div>
      </div>

      <div className="flex flex-wrap gap-2 mb-6">
        {([
          ["all", "All"],
          ["ongoing", "Ongoing"],
          ["in_progress", "In Progress"],
          ["completed", "Completed"],
        ] as [Filter, string][]).map(([f, label]) => (
          <Chip key={f} active={filter === f} onClick={() => setFilter(f)}>{label}</Chip>
        ))}
        <MenuChip label={typeof filter === "object" && filter.kind === "city" ? `City: ${filter.value}` : "By City"}
          options={cities} active={typeof filter === "object" && filter.kind === "city"}
          onPick={(v) => setFilter({ kind: "city", value: v })} />
        <MenuChip label={typeof filter === "object" && filter.kind === "brand" ? `Brand: ${filter.value}` : "By Brand"}
          options={brands} active={typeof filter === "object" && filter.kind === "brand"}
          onPick={(v) => setFilter({ kind: "brand", value: v })} />
      </div>

      {loading ? (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i} className="overflow-hidden shadow-card">
              <Skeleton className="aspect-[4/3] w-full" />
              <div className="p-5 space-y-2"><Skeleton className="h-3 w-20" /><Skeleton className="h-5 w-3/4" /><Skeleton className="h-3 w-1/2" /></div>
            </Card>
          ))}
        </div>
      ) : recent.length === 0 ? (
        <EmptyState
          title={projects.length === 0 ? "No projects yet" : "No projects match"}
          description={projects.length === 0 ? "Start by creating your first project." : "Try adjusting your search or filters."}
          actionLabel={projects.length === 0 ? "Create Project" : "Clear filters"}
          actionTo={projects.length === 0 ? "/projects/new" : undefined}
          onAction={projects.length === 0 ? undefined : () => { setQ(""); setFilter("all"); }}
        />
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {recent.map(p => (
            <Link key={p.id} to={`/projects/${p.id}`}>
              <Card className="overflow-hidden hover:shadow-elegant transition-all group h-full shadow-card">
                <div className="aspect-[4/3] bg-muted relative overflow-hidden">
                  {p.cover_image ? (
                    <LazyImage src={p.cover_image} alt={p.name} className="group-hover:scale-105 transition-transform duration-500" />
                  ) : <div className="w-full h-full luxury-gradient" />}
                  <div className="absolute top-3 right-3 px-2 py-1 text-xs bg-background/90 backdrop-blur rounded">
                    {p.status === "completed" ? "Completed" : p.status === "in_progress" ? "In Progress" : "Ongoing"}
                  </div>
                </div>
                <div className="p-5 space-y-3">
                  <div>
                    <p className="text-xs text-accent uppercase tracking-wider mb-1">{p.type}</p>
                    <h3 className="font-serif text-xl mb-1">{p.name}</h3>
                    <p className="text-sm text-muted-foreground">{p.location || "—"}</p>
                  </div>
                  <ProjectProgress project={p} size="sm" />
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

function StatCard({ icon: Icon, label, value, to, loading }: { icon: any; label: string; value: number; to: string; loading?: boolean }) {
  return (
    <Link to={to}>
      <Card className="p-6 shadow-card hover:shadow-elegant hover:border-accent/40 transition-all cursor-pointer h-full">
        <div className="flex items-start justify-between">
          <div className="min-w-0">
            <p className="text-sm text-muted-foreground mb-2">{label}</p>
            {loading ? <Skeleton className="h-9 w-12" /> : <p className="font-serif text-4xl">{value}</p>}
          </div>
          <div className="w-10 h-10 rounded brass-gradient flex items-center justify-center shrink-0">
            <Icon className="w-5 h-5 text-primary" />
          </div>
        </div>
      </Card>
    </Link>
  );
}

function Chip({ active, onClick, children }: { active?: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick}
      className={`px-3 py-1.5 text-xs rounded-full border transition-colors ${active ? "border-accent bg-accent/10 text-accent" : "border-border text-muted-foreground hover:text-foreground hover:border-accent/40"}`}>
      {children}
    </button>
  );
}

function MenuChip({ label, options, active, onPick }: { label: string; options: string[]; active?: boolean; onPick: (v: string) => void }) {
  const [open, setOpen] = useState(false);
  if (options.length === 0) return null;
  return (
    <div className="relative">
      <Chip active={active} onClick={() => setOpen(v => !v)}>{label} ▾</Chip>
      {open && (
        <div className="absolute z-20 mt-1 max-h-60 overflow-y-auto bg-popover border rounded shadow-elegant min-w-[180px]">
          {options.map(o => (
            <button key={o} onClick={() => { onPick(o); setOpen(false); }}
              className="block w-full text-left px-3 py-1.5 text-sm hover:bg-muted">{o}</button>
          ))}
        </div>
      )}
    </div>
  );
}
