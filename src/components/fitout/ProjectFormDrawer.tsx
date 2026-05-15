import { useEffect, useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter } from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { FITOUT_STATUSES, FitoutProject, fitoutProgress, daysFromToday, FitoutStatus } from "@/lib/fitout";

type Props = {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  project?: FitoutProject | null;
  onSaved: () => void;
};

const empty: Partial<FitoutProject> = { status: "Planning" };

export default function ProjectFormDrawer({ open, onOpenChange, project, onSaved }: Props) {
  const { user } = useAuth();
  const [form, setForm] = useState<Partial<FitoutProject>>(empty);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setForm(project ? { ...project } : empty);
  }, [project, open]);

  const set = (k: keyof FitoutProject, v: any) => setForm((f) => ({ ...f, [k]: v === "" ? null : v }));

  const progress = fitoutProgress(form as any);
  const daysToOpening = daysFromToday(form.store_opening);

  async function save() {
    if (!form.brand && !form.location) {
      toast.error("Please enter at least Brand or Location.");
      return;
    }
    setSaving(true);
    const payload: any = {
      date_added: form.date_added || null,
      hod: form.hod || null,
      pm: form.pm || null,
      city_province: form.city_province || null,
      brand: form.brand || null,
      location: form.location || null,
      project_type: form.project_type || null,
      size_m2: form.size_m2 ?? null,
      fitout_period_days: form.fitout_period_days ?? null,
      start_on_site: form.start_on_site || null,
      fitout_completion: form.fitout_completion || null,
      store_handover: form.store_handover || null,
      snag_prep_date: form.snag_prep_date || null,
      contract_period_days: form.contract_period_days ?? null,
      store_opening: form.store_opening || null,
      snag_completion_date: form.snag_completion_date || null,
      comments: form.comments || null,
      status: form.status || "Planning",
      supervisor: form.supervisor || null,
    };
    let err;
    if (project?.id) {
      ({ error: err } = await supabase.from("fitout_projects" as any).update(payload).eq("id", project.id));
    } else {
      payload.created_by = user?.id;
      ({ error: err } = await supabase.from("fitout_projects" as any).insert(payload));
    }
    setSaving(false);
    if (err) {
      toast.error(err.message);
      return;
    }
    toast.success(project?.id ? "Project updated" : "Project created");
    onSaved();
    onOpenChange(false);
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-2xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{project?.id ? "Edit Project" : "New Project"}</SheetTitle>
        </SheetHeader>

        <div className="grid grid-cols-2 gap-3 mt-4">
          <Field label="Brand"><Input value={form.brand ?? ""} onChange={(e) => set("brand", e.target.value)} /></Field>
          <Field label="Location"><Input value={form.location ?? ""} onChange={(e) => set("location", e.target.value)} /></Field>
          <Field label="City / Province"><Input value={form.city_province ?? ""} onChange={(e) => set("city_province", e.target.value)} /></Field>
          <Field label="Project Type"><Input value={form.project_type ?? ""} onChange={(e) => set("project_type", e.target.value)} /></Field>
          <Field label="HOD"><Input value={form.hod ?? ""} onChange={(e) => set("hod", e.target.value)} /></Field>
          <Field label="Project Manager"><Input value={form.pm ?? ""} onChange={(e) => set("pm", e.target.value)} /></Field>
          <Field label="Supervisor"><Input value={form.supervisor ?? ""} onChange={(e) => set("supervisor", e.target.value)} /></Field>
          <Field label="Status">
            <Select value={form.status ?? "Planning"} onValueChange={(v) => set("status", v as FitoutStatus)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {FITOUT_STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
          </Field>

          <Field label="Size (m²)"><Input type="number" value={form.size_m2 ?? ""} onChange={(e) => set("size_m2", e.target.value === "" ? null : Number(e.target.value))} /></Field>
          <Field label="Fitout Period (Days)"><Input type="number" value={form.fitout_period_days ?? ""} onChange={(e) => set("fitout_period_days", e.target.value === "" ? null : Number(e.target.value))} /></Field>
          <Field label="Contract Period (Days)"><Input type="number" value={form.contract_period_days ?? ""} onChange={(e) => set("contract_period_days", e.target.value === "" ? null : Number(e.target.value))} /></Field>

          <Field label="Date Added"><Input type="date" value={form.date_added ?? ""} onChange={(e) => set("date_added", e.target.value)} /></Field>
          <Field label="Start on Site"><Input type="date" value={form.start_on_site ?? ""} onChange={(e) => set("start_on_site", e.target.value)} /></Field>
          <Field label="Fitout Completion"><Input type="date" value={form.fitout_completion ?? ""} onChange={(e) => set("fitout_completion", e.target.value)} /></Field>
          <Field label="Store Handover"><Input type="date" value={form.store_handover ?? ""} onChange={(e) => set("store_handover", e.target.value)} /></Field>
          <Field label="Snag Prep Date"><Input type="date" value={form.snag_prep_date ?? ""} onChange={(e) => set("snag_prep_date", e.target.value)} /></Field>
          <Field label="Snag Completion"><Input type="date" value={form.snag_completion_date ?? ""} onChange={(e) => set("snag_completion_date", e.target.value)} /></Field>
          <Field label="Store Opening"><Input type="date" value={form.store_opening ?? ""} onChange={(e) => set("store_opening", e.target.value)} /></Field>

          <div className="col-span-2">
            <Label className="text-xs">Comments</Label>
            <Textarea rows={4} value={form.comments ?? ""} onChange={(e) => set("comments", e.target.value)} />
          </div>

          <div className="col-span-2 grid grid-cols-2 gap-3 p-3 rounded border bg-muted/30">
            <div>
              <p className="text-xs text-muted-foreground">Days to Store Opening</p>
              <p className="text-2xl font-serif">{daysToOpening ?? "—"}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-2">Fitout Progress {progress != null ? `${progress.toFixed(0)}%` : ""}</p>
              <Progress value={progress ?? 0} />
            </div>
          </div>
        </div>

        <SheetFooter className="mt-6">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={save} disabled={saving}>{saving ? "Saving…" : "Save"}</Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <Label className="text-xs">{label}</Label>
      {children}
    </div>
  );
}
