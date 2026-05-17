import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Loader2, RefreshCw, Eye, Plus, PencilLine, AlertTriangle } from "lucide-react";
import { toast } from "sonner";

type Cfg = {
  id: string;
  sheet_url: string | null;
  sheet_id: string | null;
  worksheet_name: string | null;
  header_row: number;
  enabled: boolean;
  last_synced_at: string | null;
  last_result: any;
};

type Run = {
  id: string;
  started_at: string;
  finished_at: string | null;
  inserted: number; updated: number; skipped: number;
  errors: any[]; status: string; triggered_by: string;
};

export default function SheetSyncDialog({ open, onOpenChange, onSynced }: {
  open: boolean; onOpenChange: (o: boolean) => void; onSynced?: () => void;
}) {
  const [cfg, setCfg] = useState<Cfg | null>(null);
  const [runs, setRuns] = useState<Run[]>([]);
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  const [preview, setPreview] = useState<any>(null);

  async function load() {
    const { data: c } = await supabase.from("fitout_sheet_config" as any).select("*").limit(1).maybeSingle();
    setCfg(c as any);
    const { data: r } = await supabase.from("fitout_sheet_sync_runs" as any)
      .select("*").order("started_at", { ascending: false }).limit(5);
    setRuns((r as any) || []);
  }
  useEffect(() => { if (open) load(); }, [open]);

  async function save() {
    if (!cfg) return;
    setSaving(true);
    const { error } = await supabase.from("fitout_sheet_config" as any).update({
      sheet_url: cfg.sheet_url,
      worksheet_name: cfg.worksheet_name,
      header_row: cfg.header_row || 1,
      enabled: cfg.enabled,
      sheet_id: null, // reset; edge fn will resolve
    }).eq("id", cfg.id);
    setSaving(false);
    if (error) toast.error(error.message);
    else toast.success("Settings saved");
  }

  async function saveLatest() {
    if (!cfg) return;
    await supabase.from("fitout_sheet_config" as any).update({
      sheet_url: cfg.sheet_url, worksheet_name: cfg.worksheet_name,
      header_row: cfg.header_row || 1, enabled: cfg.enabled, sheet_id: null,
    }).eq("id", cfg.id);
  }

  async function previewSync() {
    if (!cfg?.sheet_url) { toast.error("Set the Google Sheet URL first"); return; }
    setPreviewing(true);
    setPreview(null);
    try {
      await saveLatest();
      const { data, error } = await supabase.functions.invoke("sync-fitout-sheet", {
        body: { triggered_by: "manual", dry_run: true },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setPreview(data);
    } catch (e: any) {
      toast.error(e.message || "Preview failed");
    } finally {
      setPreviewing(false);
    }
  }

  async function syncNow() {
    if (!cfg?.sheet_url) { toast.error("Set the Google Sheet URL first"); return; }
    setSyncing(true);
    try {
      await saveLatest();
      const { data, error } = await supabase.functions.invoke("sync-fitout-sheet", {
        body: { triggered_by: "manual" },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast.success(`Synced — ${data.inserted} new, ${data.updated} updated, ${data.skipped} skipped`);
      setPreview(null);
      await load();
      onSynced?.();
    } catch (e: any) {
      toast.error(e.message || "Sync failed");
    } finally {
      setSyncing(false);
    }
  }

  function fmt(v: any) {
    if (v == null || v === "") return <span className="text-muted-foreground">—</span>;
    return String(v);
  }

  if (!cfg) return null;
  const last = runs[0];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Google Sheet Sync</DialogTitle>
          <DialogDescription>
            Pull rows from a Google Sheet into the tracker. Matches existing projects by Brand + Location + City to avoid duplicates.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label>Google Sheet URL</Label>
            <Input
              placeholder="https://docs.google.com/spreadsheets/d/..."
              value={cfg.sheet_url || ""}
              onChange={(e) => setCfg({ ...cfg, sheet_url: e.target.value })}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Worksheet name (optional)</Label>
              <Input
                placeholder="defaults to first tab"
                value={cfg.worksheet_name || ""}
                onChange={(e) => setCfg({ ...cfg, worksheet_name: e.target.value })}
              />
            </div>
            <div>
              <Label>Header row</Label>
              <Input type="number" min={1} value={cfg.header_row}
                onChange={(e) => setCfg({ ...cfg, header_row: Number(e.target.value) || 1 })} />
            </div>
          </div>
          <div className="flex items-center justify-between rounded border p-3">
            <div>
              <p className="font-medium text-sm">Auto-sync every 15 minutes</p>
              <p className="text-xs text-muted-foreground">Runs in the background when enabled.</p>
            </div>
            <Switch checked={cfg.enabled} onCheckedChange={(v) => setCfg({ ...cfg, enabled: v })} />
          </div>

          {preview && (
            <div className="rounded border p-3 text-sm space-y-3 bg-muted/30">
              <div className="flex items-center justify-between">
                <span className="font-medium">Sync preview</span>
                <button type="button" className="text-xs text-muted-foreground hover:underline" onClick={() => setPreview(null)}>Dismiss</button>
              </div>
              <div className="flex flex-wrap gap-2 text-xs">
                <span className="inline-flex items-center gap-1 rounded bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 px-2 py-1">
                  <Plus className="w-3 h-3" /> {preview.creates?.length || 0} to create
                </span>
                <span className="inline-flex items-center gap-1 rounded bg-blue-500/10 text-blue-700 dark:text-blue-400 px-2 py-1">
                  <PencilLine className="w-3 h-3" /> {preview.updates?.length || 0} to update
                </span>
                <span className="inline-flex items-center gap-1 rounded bg-muted px-2 py-1">
                  {preview.unchanged || 0} unchanged
                </span>
                <span className="inline-flex items-center gap-1 rounded bg-amber-500/10 text-amber-700 dark:text-amber-400 px-2 py-1">
                  <AlertTriangle className="w-3 h-3" /> {preview.missing_from_sheet?.length || 0} not in sheet (kept)
                </span>
                {Array.isArray(preview.errors) && preview.errors.length > 0 && (
                  <span className="inline-flex items-center gap-1 rounded bg-destructive/10 text-destructive px-2 py-1">
                    {preview.errors.length} row(s) with errors
                  </span>
                )}
              </div>

              {preview.creates?.length > 0 && (
                <details open className="text-xs">
                  <summary className="cursor-pointer font-medium text-emerald-700 dark:text-emerald-400">To create ({preview.creates.length})</summary>
                  <div className="mt-2 max-h-48 overflow-auto rounded border bg-background">
                    <table className="w-full text-xs">
                      <thead className="bg-muted/50 sticky top-0"><tr className="text-left"><th className="p-2">Row</th><th className="p-2">Brand</th><th className="p-2">Location</th><th className="p-2">City</th><th className="p-2">Store Opening</th><th className="p-2">Status</th></tr></thead>
                      <tbody>
                        {preview.creates.map((c: any, i: number) => (
                          <tr key={i} className="border-t"><td className="p-2 font-mono">{c.row}</td><td className="p-2">{fmt(c.brand)}</td><td className="p-2">{fmt(c.location)}</td><td className="p-2">{fmt(c.city)}</td><td className="p-2 font-mono">{fmt(c.store_opening)}</td><td className="p-2">{fmt(c.status)}</td></tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </details>
              )}

              {preview.updates?.length > 0 && (
                <details open className="text-xs">
                  <summary className="cursor-pointer font-medium text-blue-700 dark:text-blue-400">To update ({preview.updates.length})</summary>
                  <div className="mt-2 max-h-72 overflow-auto rounded border bg-background">
                    <table className="w-full text-xs">
                      <thead className="bg-muted/50 sticky top-0"><tr className="text-left"><th className="p-2">Row</th><th className="p-2">Project</th><th className="p-2">Field</th><th className="p-2">From</th><th className="p-2">To</th></tr></thead>
                      <tbody>
                        {preview.updates.flatMap((u: any, i: number) =>
                          u.changes.map((ch: any, j: number) => (
                            <tr key={`${i}-${j}`} className="border-t align-top">
                              <td className="p-2 font-mono">{u.row}</td>
                              <td className="p-2">{u.brand}<div className="text-muted-foreground">{u.location}{u.city ? ` · ${u.city}` : ""}</div></td>
                              <td className="p-2">{ch.field}</td>
                              <td className="p-2 font-mono text-muted-foreground line-through max-w-[12rem] break-all">{fmt(ch.from)}</td>
                              <td className="p-2 font-mono text-emerald-700 dark:text-emerald-400 max-w-[12rem] break-all">{fmt(ch.to)}</td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </details>
              )}

              {preview.missing_from_sheet?.length > 0 && (
                <details className="text-xs">
                  <summary className="cursor-pointer font-medium text-amber-700 dark:text-amber-400">In tracker but not in sheet ({preview.missing_from_sheet.length}) — kept as-is</summary>
                  <div className="mt-2 max-h-48 overflow-auto rounded border bg-background">
                    <table className="w-full text-xs">
                      <thead className="bg-muted/50 sticky top-0"><tr className="text-left"><th className="p-2">Brand</th><th className="p-2">Location</th><th className="p-2">City</th><th className="p-2">Store Opening</th></tr></thead>
                      <tbody>
                        {preview.missing_from_sheet.map((m: any, i: number) => (
                          <tr key={i} className="border-t"><td className="p-2">{fmt(m.brand)}</td><td className="p-2">{fmt(m.location)}</td><td className="p-2">{fmt(m.city)}</td><td className="p-2 font-mono">{fmt(m.store_opening)}</td></tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </details>
              )}
            </div>
          )}

          {last && (
            <div className="rounded border p-3 text-sm space-y-2">
              <div className="flex justify-between">
                <span className="font-medium">Last sync</span>
                <span className="text-muted-foreground text-xs">
                  {last.finished_at ? new Date(last.finished_at).toLocaleString() : "running…"} ({last.triggered_by})
                </span>
              </div>
              <p className="text-muted-foreground text-xs">
                {last.inserted} inserted · {last.updated} updated · {last.skipped} skipped
                {last.status === "failed" && " · failed"}
              </p>

              {Array.isArray((cfg.last_result as any)?.unmapped_headers) && (cfg.last_result as any).unmapped_headers.length > 0 && (
                <details className="text-xs">
                  <summary className="cursor-pointer text-amber-600 dark:text-amber-400">
                    {(cfg.last_result as any).unmapped_headers.length} unmapped column(s) — ignored
                  </summary>
                  <ul className="mt-1 ml-4 list-disc">
                    {(cfg.last_result as any).unmapped_headers.map((h: any, i: number) => (
                      <li key={i}><span className="font-mono">{h.col}</span>: "{h.header}"</li>
                    ))}
                  </ul>
                </details>
              )}

              {Array.isArray(last.errors) && last.errors.length > 0 && (
                <details open className="text-xs">
                  <summary className="cursor-pointer text-destructive font-medium">
                    {last.errors.length} row(s) with errors — click to see details
                  </summary>
                  <div className="mt-2 max-h-72 overflow-auto rounded border">
                    <table className="w-full text-xs">
                      <thead className="bg-muted/50 sticky top-0">
                        <tr className="text-left">
                          <th className="p-2">Row</th>
                          <th className="p-2">Brand / Location</th>
                          <th className="p-2">Column</th>
                          <th className="p-2">Header</th>
                          <th className="p-2">Value</th>
                          <th className="p-2">Problem</th>
                        </tr>
                      </thead>
                      <tbody>
                        {last.errors.flatMap((er: any, i: number) => {
                          const errs = Array.isArray(er.errors) ? er.errors : [{ problem: er.message || "Unknown" }];
                          return errs.map((e: any, j: number) => (
                            <tr key={`${i}-${j}`} className="border-t align-top">
                              <td className="p-2 font-mono">{er.row ?? "?"}</td>
                              <td className="p-2">
                                {er.brand || "—"}
                                {er.location && <div className="text-muted-foreground">{er.location}{er.city ? ` · ${er.city}` : ""}</div>}
                              </td>
                              <td className="p-2 font-mono">{e.column ?? "-"}</td>
                              <td className="p-2">{e.header ?? "-"}</td>
                              <td className="p-2 font-mono break-all max-w-[12rem]">{e.value ?? ""}</td>
                              <td className="p-2 text-destructive">{e.problem ?? ""}</td>
                            </tr>
                          ));
                        })}
                      </tbody>
                    </table>
                  </div>
                </details>
              )}
            </div>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={save} disabled={saving}>
            {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}Save
          </Button>
          <Button onClick={syncNow} disabled={syncing}>
            {syncing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-2" />}
            Sync now
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
