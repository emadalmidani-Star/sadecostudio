import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Loader2, RefreshCw } from "lucide-react";
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

  async function syncNow() {
    if (!cfg?.sheet_url) { toast.error("Set the Google Sheet URL first"); return; }
    setSyncing(true);
    try {
      // Save first to ensure latest values are used.
      await supabase.from("fitout_sheet_config" as any).update({
        sheet_url: cfg.sheet_url, worksheet_name: cfg.worksheet_name,
        header_row: cfg.header_row || 1, enabled: cfg.enabled, sheet_id: null,
      }).eq("id", cfg.id);
      const { data, error } = await supabase.functions.invoke("sync-fitout-sheet", {
        body: { triggered_by: "manual" },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast.success(`Synced — ${data.inserted} new, ${data.updated} updated, ${data.skipped} skipped`);
      await load();
      onSynced?.();
    } catch (e: any) {
      toast.error(e.message || "Sync failed");
    } finally {
      setSyncing(false);
    }
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

          {last && (
            <div className="rounded border p-3 text-sm">
              <div className="flex justify-between">
                <span className="font-medium">Last sync</span>
                <span className="text-muted-foreground text-xs">
                  {last.finished_at ? new Date(last.finished_at).toLocaleString() : "running…"} ({last.triggered_by})
                </span>
              </div>
              <p className="text-muted-foreground text-xs mt-1">
                {last.inserted} inserted · {last.updated} updated · {last.skipped} skipped
                {last.status === "failed" && " · failed"}
              </p>
              {Array.isArray(last.errors) && last.errors.length > 0 && (
                <details className="mt-2">
                  <summary className="text-xs cursor-pointer text-destructive">{last.errors.length} error(s)</summary>
                  <ul className="text-xs mt-1 space-y-1 max-h-40 overflow-auto">
                    {last.errors.map((er: any, i: number) => (
                      <li key={i}>Row {er.row ?? "?"}: {(er.errors || [er.message]).join("; ")}</li>
                    ))}
                  </ul>
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
