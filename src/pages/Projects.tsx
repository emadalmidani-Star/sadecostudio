import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Plus, Search, Pencil, Trash2, LayoutGrid, List as ListIcon, FileDown, ChevronUp, ChevronDown, CheckSquare, Square } from "lucide-react";
import { toast } from "sonner";
import LazyImage from "@/components/LazyImage";
import EmptyState from "@/components/EmptyState";
import ProjectProgress from "@/components/ProjectProgress";
import { exportSelectedPDF } from "@/lib/pdf";
import { statusLabel } from "@/lib/projectPhase";

type View = "grid" | "table";
type StatusValue = "ongoing" | "in_progress" | "completed";
const STATUSES: StatusValue[] = ["ongoing", "in_progress", "completed"];

const SORT_COLS = ["name", "client_name", "location", "status", "area_sqm", "created_at", "estimated_completion"] as const;
type SortCol = (typeof SORT_COLS)[number];

const VIEW_KEY = "sadeco.projects.view";

export default function Projects() {
  const [projects, setProjects] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [searchParams, setSearchParams] = useSearchParams();
  const initialStatus = (searchParams.get("status") || "all") as "all" | StatusValue;
  const [filter, setFilter] = useState<"all" | StatusValue>(initialStatus);
  const [view, setView] = useState<View>(() => (localStorage.getItem(VIEW_KEY) as View) || "grid");
  const [selectMode, setSelectMode] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [sortCol, setSortCol] = useState<SortCol>("name");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [exporting, setExporting] = useState(false);
  const nav = useNavigate();

  useEffect(() => { localStorage.setItem(VIEW_KEY, view); }, [view]);
  useEffect(() => { load(); }, []);
  async function load() {
    setLoading(true);
    const { data } = await supabase.from("projects").select("*").order("updated_at", { ascending: false });
    setProjects(data || []);
    setLoading(false);
  }

  function setFilterAndUrl(f: "all" | StatusValue) {
    setFilter(f);
    const params = new URLSearchParams(searchParams);
    if (f === "all") params.delete("status"); else params.set("status", f);
    setSearchParams(params, { replace: true });
  }

  async function handleDelete(e: React.MouseEvent, id: string, name: string) {
    e.preventDefault(); e.stopPropagation();
    if (!confirm(`Delete "${name}" permanently?`)) return;
    const { error } = await supabase.from("projects").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Project deleted");
    load();
  }

  async function updateStatus(id: string, status: StatusValue) {
    const prev = projects;
    setProjects(prev.map(p => p.id === id ? { ...p, status } : p));
    const { error } = await supabase.from("projects").update({ status }).eq("id", id);
    if (error) { setProjects(prev); toast.error(error.message); }
    else toast.success(`Status set to ${statusLabel(status)}`);
  }

  function toggleSel(id: string) {
    setSelected(s => {
      const n = new Set(s);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  }

  async function exportSelected() {
    if (selected.size === 0) return toast.error("Select at least one project");
    setExporting(true);
    try {
      const { data: company } = await supabase.from("company_profile").select("*").single();
      const byId = new Map(projects.map(p => [p.id, p]));
      const list = Array.from(selected).map(id => byId.get(id)).filter(Boolean);
      await exportSelectedPDF(company, list, {}, null, { phone: true, email: true, website: true, address: false });
      toast.success("Portfolio PDF generated");
    } catch (e: any) { toast.error(e.message || "Export failed"); }
    setExporting(false);
  }

  const filtered = useMemo(() => {
    const text = q.toLowerCase();
    return projects.filter(p =>
      (filter === "all" || p.status === filter) &&
      (q === "" || p.name?.toLowerCase().includes(text) || (p.location || "").toLowerCase().includes(text) || (p.client_name || "").toLowerCase().includes(text))
    );
  }, [projects, q, filter]);

  const sorted = useMemo(() => {
    const arr = [...filtered];
    arr.sort((a, b) => {
      const av = a[sortCol] ?? ""; const bv = b[sortCol] ?? "";
      if (av < bv) return sortDir === "asc" ? -1 : 1;
      if (av > bv) return sortDir === "asc" ? 1 : -1;
      return 0;
    });
    return arr;
  }, [filtered, sortCol, sortDir]);

  function clickSort(c: SortCol) {
    if (sortCol === c) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortCol(c); setSortDir("asc"); }
  }

  return (
    <div className="p-6 md:p-10 max-w-7xl mx-auto">
      <div className="flex items-end justify-between mb-8 gap-4 flex-wrap">
        <div>
          <p className="eyebrow mb-2">PORTFOLIO</p>
          <h1 className="page-title">Projects</h1>
        </div>
        <Button asChild size="lg"><Link to="/projects/new"><Plus className="w-4 h-4 mr-2" />New Project</Link></Button>
      </div>

      <div className="flex flex-wrap items-center gap-3 mb-6">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input value={q} onChange={e => setQ(e.target.value)} placeholder="Search projects…" className="pl-9" />
        </div>
        <div className="flex gap-1 bg-muted p-1 rounded">
          {(["all", "ongoing", "in_progress", "completed"] as const).map(f => (
            <button key={f} onClick={() => setFilterAndUrl(f)}
              className={`px-3 py-1.5 text-sm rounded transition-colors capitalize ${filter === f ? "bg-background shadow-sm" : "text-muted-foreground"}`}>
              {f === "in_progress" ? "In Progress" : f}
            </button>
          ))}
        </div>
        <div className="flex gap-1 bg-muted p-1 rounded ml-auto">
          <button onClick={() => setView("grid")} aria-label="Grid view"
            className={`px-2.5 py-1.5 rounded ${view === "grid" ? "bg-background shadow-sm" : "text-muted-foreground"}`}>
            <LayoutGrid className="w-4 h-4" />
          </button>
          <button onClick={() => setView("table")} aria-label="Table view"
            className={`px-2.5 py-1.5 rounded ${view === "table" ? "bg-background shadow-sm" : "text-muted-foreground"}`}>
            <ListIcon className="w-4 h-4" />
          </button>
        </div>
        <Button variant={selectMode ? "default" : "outline"} size="sm" onClick={() => { setSelectMode(v => !v); setSelected(new Set()); }}>
          {selectMode ? <CheckSquare className="w-4 h-4 mr-2" /> : <Square className="w-4 h-4 mr-2" />}
          Select
        </Button>
      </div>

      {selectMode && selected.size > 0 && (
        <Card className="p-3 mb-4 flex items-center justify-between gap-3 border-accent/40">
          <span className="text-sm">{selected.size} selected</span>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => setSelected(new Set())}>Clear</Button>
            <Button size="sm" onClick={exportSelected} disabled={exporting}>
              <FileDown className="w-4 h-4 mr-2" />{exporting ? "Exporting…" : "Export Selected to PDF"}
            </Button>
          </div>
        </Card>
      )}

      {loading ? (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i} className="overflow-hidden shadow-card">
              <Skeleton className="aspect-[4/3] w-full" />
              <div className="p-5 space-y-2"><Skeleton className="h-3 w-20" /><Skeleton className="h-5 w-3/4" /></div>
            </Card>
          ))}
        </div>
      ) : sorted.length === 0 ? (
        <EmptyState title="No projects match your filters." actionLabel="Create Project" actionTo="/projects/new" />
      ) : view === "grid" ? (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {sorted.map(p => (
            <div key={p.id} className="relative">
              {selectMode && (
                <Checkbox checked={selected.has(p.id)} onCheckedChange={() => toggleSel(p.id)}
                  className="absolute top-3 left-3 z-10 bg-background" />
              )}
              <Link to={`/projects/${p.id}`} onClick={(e) => { if (selectMode) { e.preventDefault(); toggleSel(p.id); } }}>
                <Card className={`overflow-hidden hover:shadow-elegant transition-all group h-full shadow-card ${selected.has(p.id) ? "ring-2 ring-accent" : ""}`}>
                  <div className="aspect-[4/3] bg-muted relative overflow-hidden">
                    {p.cover_image
                      ? <LazyImage src={p.cover_image} alt={p.name} className="group-hover:scale-105 transition-transform duration-500" />
                      : <div className="w-full h-full luxury-gradient" />}
                    <div className="absolute top-3 right-3" onClick={(e) => { e.preventDefault(); e.stopPropagation(); }}>
                      <StatusInline status={p.status} onChange={(s) => updateStatus(p.id, s)} />
                    </div>
                    {!selectMode && (
                      <div className="absolute bottom-3 right-3 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button size="icon" variant="secondary" className="h-8 w-8"
                          onClick={(e) => { e.preventDefault(); nav(`/projects/${p.id}`); }}>
                          <Pencil className="w-3.5 h-3.5" />
                        </Button>
                        <Button size="icon" variant="destructive" className="h-8 w-8"
                          onClick={(e) => handleDelete(e, p.id, p.name)}>
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    )}
                  </div>
                  <div className="p-5 space-y-3">
                    <div>
                      <p className="text-xs text-accent uppercase tracking-wider mb-1">{p.type} {p.area_sqm && `· ${p.area_sqm} sqm`}</p>
                      <h3 className="font-serif text-xl mb-1">{p.name}</h3>
                      <p className="text-sm text-muted-foreground">{p.location || "—"}</p>
                    </div>
                    <ProjectProgress project={p} size="sm" />
                  </div>
                </Card>
              </Link>
            </div>
          ))}
        </div>
      ) : (
        <Card className="overflow-hidden shadow-card">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  {selectMode && <TableHead className="w-10" />}
                  <SortHead col="name" label="Name" sortCol={sortCol} sortDir={sortDir} onClick={clickSort} />
                  <SortHead col="client_name" label="Brand / Client" sortCol={sortCol} sortDir={sortDir} onClick={clickSort} />
                  <SortHead col="location" label="City" sortCol={sortCol} sortDir={sortDir} onClick={clickSort} />
                  <SortHead col="status" label="Status" sortCol={sortCol} sortDir={sortDir} onClick={clickSort} />
                  <SortHead col="area_sqm" label="Size (m²)" sortCol={sortCol} sortDir={sortDir} onClick={clickSort} />
                  <SortHead col="created_at" label="Start" sortCol={sortCol} sortDir={sortDir} onClick={clickSort} />
                  <SortHead col="estimated_completion" label="Target Opening" sortCol={sortCol} sortDir={sortDir} onClick={clickSort} />
                </TableRow>
              </TableHeader>
              <TableBody>
                {sorted.map(p => (
                  <TableRow key={p.id} className="cursor-pointer" onClick={() => selectMode ? toggleSel(p.id) : nav(`/projects/${p.id}`)}>
                    {selectMode && (
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <Checkbox checked={selected.has(p.id)} onCheckedChange={() => toggleSel(p.id)} />
                      </TableCell>
                    )}
                    <TableCell className="font-medium font-serif">{p.name}</TableCell>
                    <TableCell>{p.client_name || "—"}</TableCell>
                    <TableCell>{p.location || "—"}</TableCell>
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <StatusInline status={p.status} onChange={(s) => updateStatus(p.id, s)} />
                    </TableCell>
                    <TableCell>{p.area_sqm || "—"}</TableCell>
                    <TableCell>{p.created_at ? new Date(p.created_at).toLocaleDateString() : "—"}</TableCell>
                    <TableCell>{p.estimated_completion ? new Date(p.estimated_completion).toLocaleDateString() : "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </Card>
      )}
    </div>
  );
}

function SortHead({ col, label, sortCol, sortDir, onClick }: { col: SortCol; label: string; sortCol: SortCol; sortDir: "asc" | "desc"; onClick: (c: SortCol) => void }) {
  const active = sortCol === col;
  return (
    <TableHead>
      <button onClick={() => onClick(col)} className="inline-flex items-center gap-1 hover:text-accent">
        {label}
        {active && (sortDir === "asc" ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />)}
      </button>
    </TableHead>
  );
}

function StatusInline({ status, onChange }: { status: string; onChange: (s: StatusValue) => void }) {
  const label = status === "completed" ? "Completed" : status === "in_progress" ? "In Progress" : "Ongoing";
  const cls = status === "completed"
    ? "bg-emerald-500/15 text-emerald-700 border-emerald-500/30"
    : status === "in_progress"
      ? "bg-sky-500/15 text-sky-700 border-sky-500/30"
      : "bg-amber-500/15 text-amber-700 border-amber-500/30";
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className={`px-2 py-1 text-xs rounded border ${cls} hover:opacity-80`}>{label} ▾</button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {STATUSES.map(s => (
          <DropdownMenuItem key={s} onClick={() => onChange(s)}>{statusLabel(s)}</DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
