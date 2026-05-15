import { useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, AlertTriangle, CheckCircle2, Loader2 } from "lucide-react";
import { FITOUT_STATUSES, type ParsedRow } from "@/lib/fitout";

type Mode = "insert" | "upsert";

type Props = {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  rows: ParsedRow[];
  unknownHeaders: string[];
  busy: boolean;
  onConfirm: (rows: ParsedRow[], mode: Mode) => void;
};

const EDITABLE: { key: keyof ParsedRow["data"]; label: string; type?: "text" | "number" | "date" | "status" }[] = [
  { key: "brand", label: "Brand" },
  { key: "location", label: "Location" },
  { key: "city_province", label: "City" },
  { key: "project_type", label: "Type" },
  { key: "status", label: "Status", type: "status" },
  { key: "pm", label: "PM" },
  { key: "hod", label: "HOD" },
  { key: "size_m2", label: "Size m²", type: "number" },
  { key: "fitout_period_days", label: "Fitout Days", type: "number" },
  { key: "start_on_site", label: "Start", type: "date" },
  { key: "fitout_completion", label: "Fitout Done", type: "date" },
];

export default function ImportPreviewDialog({ open, onOpenChange, rows, unknownHeaders, busy, onConfirm }: Props) {
  const [mode, setMode] = useState<Mode>("insert");
  const [edited, setEdited] = useState<ParsedRow[]>(rows);
  const [filter, setFilter] = useState<"all" | "errors" | "warnings" | "matches">("all");

  // Reset internal state whenever a fresh batch is opened.
  useMemo(() => { setEdited(rows); setFilter("all"); }, [rows]);

  const stats = useMemo(() => ({
    total: edited.length,
    valid: edited.filter((r) => r.errors.length === 0).length,
    errors: edited.filter((r) => r.errors.length > 0).length,
    warnings: edited.filter((r) => r.warnings.length > 0).length,
    matches: edited.filter((r) => r.matchedId).length,
    selected: edited.filter((r) => r.include && r.errors.length === 0).length,
  }), [edited]);

  const visible = useMemo(() => edited.filter((r) => {
    if (filter === "errors") return r.errors.length > 0;
    if (filter === "warnings") return r.warnings.length > 0;
    if (filter === "matches") return !!r.matchedId;
    return true;
  }), [edited, filter]);

  function updateCell(rowIdx: number, key: keyof ParsedRow["data"], value: any) {
    setEdited((prev) => prev.map((r, i) => {
      if (i !== rowIdx) return r;
      const data = { ...r.data, [key]: value === "" ? null : value };
      // Re-validate the row's hard errors locally for that field.
      const errors = r.errors.filter((e) => !e.toLowerCase().startsWith(String(key).toLowerCase()));
      // Recompute "missing both brand & location"
      const reqMsg = "Missing both Brand and Location — at least one is required";
      const without = errors.filter((e) => e !== reqMsg);
      const finalErrors = (!data.brand && !data.location) ? [...without, reqMsg] : without;
      return { ...r, data, errors: finalErrors, include: finalErrors.length === 0 ? r.include : false };
    }));
  }

  function toggleInclude(rowIdx: number, v: boolean) {
    setEdited((prev) => prev.map((r, i) => i === rowIdx ? { ...r, include: v } : r));
  }
  function toggleAll(v: boolean) {
    setEdited((prev) => prev.map((r) => r.errors.length === 0 ? { ...r, include: v } : r));
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[95vw] sm:max-w-[1200px] max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Import preview</DialogTitle>
          <DialogDescription>
            Review parsed rows, fix any issues, choose insert or upsert, then confirm.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-wrap items-center gap-2 text-xs">
          <Badge variant="secondary"><CheckCircle2 className="w-3 h-3 mr-1" />{stats.valid} valid</Badge>
          {stats.errors > 0 && <Badge variant="destructive"><AlertCircle className="w-3 h-3 mr-1" />{stats.errors} errors</Badge>}
          {stats.warnings > 0 && <Badge className="bg-amber-500/15 text-amber-300 border-amber-500/40"><AlertTriangle className="w-3 h-3 mr-1" />{stats.warnings} warnings</Badge>}
          {mode === "upsert" && stats.matches > 0 && <Badge className="bg-sky-500/15 text-sky-300 border-sky-500/40">{stats.matches} will update</Badge>}
          <span className="ml-auto text-muted-foreground">Selected to commit: {stats.selected}</span>
        </div>

        {unknownHeaders.length > 0 && (
          <div className="text-xs p-2 rounded border bg-muted/40">
            <span className="text-muted-foreground">Ignored unknown columns:</span>{" "}
            <span className="font-mono">{unknownHeaders.join(", ")}</span>
          </div>
        )}

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Mode</span>
            <Select value={mode} onValueChange={(v) => setMode(v as Mode)}>
              <SelectTrigger className="w-56"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="insert">Insert as new rows</SelectItem>
                <SelectItem value="upsert">Upsert (update matches by Brand+Location)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Show</span>
            <Select value={filter} onValueChange={(v) => setFilter(v as any)}>
              <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All rows</SelectItem>
                <SelectItem value="errors">Errors only</SelectItem>
                <SelectItem value="warnings">Warnings only</SelectItem>
                <SelectItem value="matches">Matches only</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="ml-auto flex gap-2">
            <Button size="sm" variant="ghost" onClick={() => toggleAll(true)}>Select all valid</Button>
            <Button size="sm" variant="ghost" onClick={() => toggleAll(false)}>Deselect all</Button>
          </div>
        </div>

        <ScrollArea className="flex-1 border rounded">
          <Table>
            <TableHeader className="sticky top-0 bg-card z-10">
              <TableRow>
                <TableHead className="w-10"></TableHead>
                <TableHead className="w-12">Row</TableHead>
                <TableHead className="w-20">Status</TableHead>
                {EDITABLE.map((c) => <TableHead key={String(c.key)}>{c.label}</TableHead>)}
                <TableHead>Issues</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {visible.length === 0 ? (
                <TableRow><TableCell colSpan={EDITABLE.length + 4} className="text-center py-8 text-muted-foreground">No rows to show.</TableCell></TableRow>
              ) : visible.map((r) => {
                const idx = edited.indexOf(r);
                const hasErr = r.errors.length > 0;
                return (
                  <TableRow key={r.rowNumber} className={hasErr ? "bg-destructive/5" : r.warnings.length ? "bg-amber-500/5" : ""}>
                    <TableCell>
                      <Checkbox
                        checked={r.include}
                        disabled={hasErr}
                        onCheckedChange={(v) => toggleInclude(idx, !!v)}
                      />
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">{r.rowNumber}</TableCell>
                    <TableCell>
                      {hasErr ? <AlertCircle className="w-4 h-4 text-destructive" />
                        : r.matchedId && mode === "upsert" ? <Badge className="bg-sky-500/15 text-sky-300 border-sky-500/40 text-[10px]">UPDATE</Badge>
                        : <Badge variant="secondary" className="text-[10px]">NEW</Badge>}
                    </TableCell>
                    {EDITABLE.map((c) => (
                      <TableCell key={String(c.key)} className="min-w-[120px]">
                        {c.type === "status" ? (
                          <Select value={(r.data[c.key] as string) || ""} onValueChange={(v) => updateCell(idx, c.key, v)}>
                            <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              {FITOUT_STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        ) : (
                          <Input
                            className="h-8 text-xs"
                            type={c.type === "number" ? "number" : c.type === "date" ? "date" : "text"}
                            value={(r.data[c.key] as any) ?? ""}
                            onChange={(e) => {
                              const raw = e.target.value;
                              const v = c.type === "number" ? (raw === "" ? null : Number(raw)) : raw;
                              updateCell(idx, c.key, v);
                            }}
                          />
                        )}
                      </TableCell>
                    ))}
                    <TableCell className="max-w-[260px]">
                      {r.errors.map((e, i) => <p key={`e${i}`} className="text-xs text-destructive">• {e}</p>)}
                      {r.warnings.map((w, i) => <p key={`w${i}`} className="text-xs text-amber-400">• {w}</p>)}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </ScrollArea>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={busy}>Cancel</Button>
          <Button onClick={() => onConfirm(edited, mode)} disabled={busy || stats.selected === 0}>
            {busy ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
            Commit {stats.selected} row{stats.selected === 1 ? "" : "s"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
