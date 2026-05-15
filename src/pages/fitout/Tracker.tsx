import { useEffect, useMemo, useState, useRef } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Download, Pencil, Trash2, ExternalLink, Upload, Loader2 } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import StatusBadge from "@/components/fitout/StatusBadge";
import ProjectFormDrawer from "@/components/fitout/ProjectFormDrawer";
import { FITOUT_STATUSES, FitoutProject, exportCsv, parseFitoutFile, matchExistingProjects, downloadCsvTemplate, downloadXlsxTemplate, type ParsedRow } from "@/lib/fitout";
import ImportPreviewDialog from "@/components/fitout/ImportPreviewDialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { FileSpreadsheet, FileText, ChevronDown } from "lucide-react";
import { toast } from "sonner";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const ALL = "__all__";

export default function Tracker() {
  const [rows, setRows] = useState<FitoutProject[]>([]);
  const [search, setSearch] = useState("");
  const [params, setParams] = useSearchParams();
  const [filters, setFilters] = useState({
    status: params.get("status") || ALL,
    brand: params.get("brand") || ALL,
    city_province: params.get("city") || ALL,
    project_type: params.get("type") || ALL,
    pm: params.get("pm") || ALL,
    hod: params.get("hod") || ALL,
    supervisor: params.get("supervisor") || ALL,
  });
  const [drawer, setDrawer] = useState<{ open: boolean; project: FitoutProject | null }>({ open: false, project: null });
  const [del, setDel] = useState<FitoutProject | null>(null);
  const [importing, setImporting] = useState(false);
  const [committing, setCommitting] = useState(false);
  const [preview, setPreview] = useState<{ open: boolean; rows: ParsedRow[]; unknownHeaders: string[] }>({
    open: false, rows: [], unknownHeaders: [],
  });
  const fileRef = useRef<HTMLInputElement>(null);

  async function handleImport(file: File) {
    setImporting(true);
    try {
      const result = await parseFitoutFile(file);
      if (result.rows.length === 0) { toast.error("No rows found in file"); return; }
      const { data: existing } = await supabase
        .from("fitout_projects" as any)
        .select("id,brand,location");
      const matched = matchExistingProjects(result.rows, (existing || []) as any);
      setPreview({ open: true, rows: matched, unknownHeaders: result.unknownHeaders });
    } catch (e: any) {
      toast.error(e.message || "Import failed");
    } finally {
      setImporting(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function commitImport(rows: ParsedRow[], mode: "insert" | "upsert") {
    setCommitting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { toast.error("Not signed in"); return; }
      const selected = rows.filter((r) => r.include && r.errors.length === 0);
      if (selected.length === 0) { toast.error("Nothing to commit"); return; }

      const inserts = selected.filter((r) => mode === "insert" || !r.matchedId);
      const updates = mode === "upsert" ? selected.filter((r) => r.matchedId) : [];

      let inserted = 0, updated = 0, failed: { row: number; error: string }[] = [];

      if (inserts.length) {
        const payload = inserts.map((r) => ({ ...r.data, status: r.data.status || "Planning", created_by: user.id }));
        const { error, data } = await supabase.from("fitout_projects" as any).insert(payload as any).select("id");
        if (error) failed.push(...inserts.map((r) => ({ row: r.rowNumber, error: error.message })));
        else inserted = data?.length || inserts.length;
      }
      for (const r of updates) {
        const { error } = await supabase.from("fitout_projects" as any).update(r.data as any).eq("id", r.matchedId!);
        if (error) failed.push({ row: r.rowNumber, error: error.message });
        else updated++;
      }

      const parts: string[] = [];
      if (inserted) parts.push(`${inserted} inserted`);
      if (updated) parts.push(`${updated} updated`);
      if (failed.length) parts.push(`${failed.length} failed`);
      if (failed.length) toast.error(`Import done with errors — ${parts.join(", ")}. Row ${failed[0].row}: ${failed[0].error}`);
      else toast.success(`Import complete — ${parts.join(", ") || "no changes"}`);

      setPreview({ open: false, rows: [], unknownHeaders: [] });
      load();
    } catch (e: any) {
      toast.error(e.message || "Commit failed");
    } finally {
      setCommitting(false);
    }
  }

  async function load() {
    const { data, error } = await supabase.from("fitout_projects" as any).select("*").order("created_at", { ascending: false });
    if (error) { toast.error(error.message); return; }
    setRows((data || []) as any);
  }
  useEffect(() => { load(); }, []);

  const uniq = (k: keyof FitoutProject) =>
    Array.from(new Set(rows.map((r) => r[k]).filter(Boolean) as string[])).sort();

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (q) {
        const hay = [r.brand, r.location, r.pm, r.hod, r.city_province, r.supervisor].filter(Boolean).join(" ").toLowerCase();
        if (!hay.includes(q)) return false;
      }
      for (const [k, v] of Object.entries(filters)) {
        if (v !== ALL && (r as any)[k] !== v) return false;
      }
      return true;
    });
  }, [rows, search, filters]);

  function setFilter(k: string, v: string) {
    setFilters((f) => ({ ...f, [k]: v }));
    const next = new URLSearchParams(params);
    const map: Record<string, string> = { city_province: "city", project_type: "type" };
    const key = map[k] || k;
    if (v === ALL) next.delete(key); else next.set(key, v);
    setParams(next, { replace: true });
  }

  async function doDelete() {
    if (!del) return;
    const { error } = await supabase.from("fitout_projects" as any).delete().eq("id", del.id);
    if (error) { toast.error(error.message); return; }
    toast.success("Deleted");
    setDel(null);
    load();
  }

  return (
    <div className="p-8 max-w-[1600px] mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <p className="text-xs tracking-[0.3em] text-accent mb-1">FITOUT TRACKER</p>
          <h1 className="font-serif text-4xl">Projects</h1>
        </div>
        <div className="flex gap-2">
          <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) handleImport(f); }} />
          <Button variant="outline" onClick={() => fileRef.current?.click()} disabled={importing}>
            {importing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Upload className="w-4 h-4 mr-2" />}
            Import Excel
          </Button>
          <Button variant="outline" onClick={() => exportCsv(filtered)}><Download className="w-4 h-4 mr-2" />Export CSV</Button>
          <Button onClick={() => setDrawer({ open: true, project: null })}><Plus className="w-4 h-4 mr-2" />New Project</Button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-2 mb-4">
        <Input className="col-span-2" placeholder="Search brand, location, PM, HOD…" value={search} onChange={(e) => setSearch(e.target.value)} />
        <FilterSelect label="Status" value={filters.status} onChange={(v) => setFilter("status", v)} options={FITOUT_STATUSES as readonly string[]} />
        <FilterSelect label="Brand" value={filters.brand} onChange={(v) => setFilter("brand", v)} options={uniq("brand")} />
        <FilterSelect label="City" value={filters.city_province} onChange={(v) => setFilter("city_province", v)} options={uniq("city_province")} />
        <FilterSelect label="Type" value={filters.project_type} onChange={(v) => setFilter("project_type", v)} options={uniq("project_type")} />
        <FilterSelect label="PM" value={filters.pm} onChange={(v) => setFilter("pm", v)} options={uniq("pm")} />
        <FilterSelect label="HOD" value={filters.hod} onChange={(v) => setFilter("hod", v)} options={uniq("hod")} />
      </div>

      <div className="border rounded overflow-x-auto bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Brand</TableHead>
              <TableHead>Location</TableHead>
              <TableHead>City</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>PM</TableHead>
              <TableHead>HOD</TableHead>
              <TableHead>Supervisor</TableHead>
              <TableHead>Size m²</TableHead>
              <TableHead>Fitout Days</TableHead>
              <TableHead>Date Added</TableHead>
              <TableHead>Start</TableHead>
              <TableHead>Fitout Done</TableHead>
              <TableHead>Handover</TableHead>
              <TableHead>Snag Prep</TableHead>
              <TableHead>Contract Days</TableHead>
              <TableHead>Snag Done</TableHead>
              <TableHead>Opening</TableHead>
              <TableHead className="text-right sticky right-0 bg-card">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow><TableCell colSpan={19} className="text-center py-10 text-muted-foreground">No projects found.</TableCell></TableRow>
            ) : filtered.map((r) => (
              <TableRow key={r.id}>
                <TableCell className="font-medium">{r.brand ?? "—"}</TableCell>
                <TableCell>{r.location ?? "—"}</TableCell>
                <TableCell>{r.city_province ?? "—"}</TableCell>
                <TableCell>{r.project_type ?? "—"}</TableCell>
                <TableCell><StatusBadge status={r.status} /></TableCell>
                <TableCell>{r.pm ?? "—"}</TableCell>
                <TableCell>{r.hod ?? "—"}</TableCell>
                <TableCell>{r.supervisor ?? "—"}</TableCell>
                <TableCell>{r.size_m2 ?? "—"}</TableCell>
                <TableCell>{r.fitout_period_days ?? "—"}</TableCell>
                <TableCell>{r.date_added ?? "—"}</TableCell>
                <TableCell>{r.start_on_site ?? "—"}</TableCell>
                <TableCell>{r.fitout_completion ?? "—"}</TableCell>
                <TableCell>{r.store_handover ?? "—"}</TableCell>
                <TableCell>{r.snag_prep_date ?? "—"}</TableCell>
                <TableCell>{r.contract_period_days ?? "—"}</TableCell>
                <TableCell>{r.snag_completion_date ?? "—"}</TableCell>
                <TableCell>{r.store_opening ?? "—"}</TableCell>
                <TableCell className="text-right sticky right-0 bg-card">
                  <div className="flex justify-end gap-1">
                    <Button size="icon" variant="ghost" asChild><Link to={`/fitout/projects/${r.id}`}><ExternalLink className="w-4 h-4" /></Link></Button>
                    <Button size="icon" variant="ghost" onClick={() => setDrawer({ open: true, project: r })}><Pencil className="w-4 h-4" /></Button>
                    <Button size="icon" variant="ghost" onClick={() => setDel(r)}><Trash2 className="w-4 h-4 text-destructive" /></Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <ProjectFormDrawer open={drawer.open} onOpenChange={(o) => setDrawer({ open: o, project: o ? drawer.project : null })} project={drawer.project} onSaved={load} />

      <ImportPreviewDialog
        open={preview.open}
        onOpenChange={(o) => !committing && setPreview((p) => ({ ...p, open: o }))}
        rows={preview.rows}
        unknownHeaders={preview.unknownHeaders}
        busy={committing}
        onConfirm={commitImport}
      />

      <AlertDialog open={!!del} onOpenChange={(o) => !o && setDel(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete project?</AlertDialogTitle>
            <AlertDialogDescription>This permanently removes "{del?.brand ?? del?.location}".</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={doDelete}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function FilterSelect({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: readonly string[] }) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger><SelectValue placeholder={label} /></SelectTrigger>
      <SelectContent>
        <SelectItem value={ALL}>All {label}</SelectItem>
        {options.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}
      </SelectContent>
    </Select>
  );
}
