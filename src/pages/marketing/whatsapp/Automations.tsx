import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import { Plus, Trash2, Zap } from "lucide-react";

type Auto = { id: string; name: string; trigger: string; status: string; trigger_config: any };
type Step = {
  id: string;
  automation_id: string;
  step_order: number;
  delay_minutes: number;
  template_name: string | null;
  template_language: string | null;
  variables_map: Record<string, string>;
};
type Tpl = { id: string; name: string; language: string; status: string; body: string; variables: string[] };

const TRIGGERS = [
  { value: "lead_created", label: "New lead created (with phone)" },
  { value: "manual", label: "Manually added contacts" },
];

export default function WhatsAppAutomations() {
  const { user } = useAuth();
  const [rows, setRows] = useState<Auto[]>([]);
  const [templates, setTemplates] = useState<Tpl[]>([]);
  const [open, setOpen] = useState<Auto | null>(null);
  const [steps, setSteps] = useState<Step[]>([]);

  async function load() {
    if (!user) return;
    const [{ data: a }, { data: t }] = await Promise.all([
      supabase
        .from("whatsapp_automations")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false }),
      supabase
        .from("whatsapp_templates")
        .select("id,name,language,status,body,variables")
        .eq("user_id", user.id)
        .eq("status", "APPROVED")
        .order("name"),
    ]);
    setRows((a as any) || []);
    setTemplates((t as any) || []);
  }
  useEffect(() => {
    load();
  }, [user?.id]);

  async function newAuto() {
    const { data } = await supabase
      .from("whatsapp_automations")
      .insert({ user_id: user!.id, name: "New automation", trigger: "lead_created" })
      .select()
      .maybeSingle();
    if (data) openEditor(data as any);
    load();
  }

  async function openEditor(a: Auto) {
    setOpen(a);
    const { data } = await supabase
      .from("whatsapp_automation_steps")
      .select("*")
      .eq("automation_id", a.id)
      .order("step_order");
    setSteps((data as any) || []);
  }

  async function saveAuto() {
    if (!open) return;
    await supabase
      .from("whatsapp_automations")
      .update({ name: open.name, trigger: open.trigger, status: open.status })
      .eq("id", open.id);
    toast({ title: "Saved" });
    load();
  }

  async function addStep() {
    if (!open) return;
    const order = steps.length;
    const { data } = await supabase
      .from("whatsapp_automation_steps")
      .insert({
        user_id: user!.id,
        automation_id: open.id,
        step_order: order,
        delay_minutes: order === 0 ? 0 : 60 * 24,
        variables_map: {},
      })
      .select()
      .maybeSingle();
    if (data) setSteps([...steps, data as any]);
  }

  async function updateStep(s: Step, patch: Partial<Step>) {
    const next = { ...s, ...patch };
    await supabase.from("whatsapp_automation_steps").update(patch).eq("id", s.id);
    setSteps(steps.map((x) => (x.id === s.id ? next : x)));
  }

  async function removeStep(s: Step) {
    await supabase.from("whatsapp_automation_steps").delete().eq("id", s.id);
    setSteps(steps.filter((x) => x.id !== s.id));
  }

  async function toggle(a: Auto) {
    const next = a.status === "active" ? "paused" : "active";
    await supabase.from("whatsapp_automations").update({ status: next }).eq("id", a.id);
    load();
  }

  async function del(id: string) {
    await supabase.from("whatsapp_automations").delete().eq("id", id);
    load();
  }

  return (
    <div className="p-6 space-y-6 max-w-5xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-serif text-3xl">WhatsApp Automations</h1>
          <p className="text-sm text-muted-foreground">
            Trigger-based flows that send approved templates after a delay.
          </p>
        </div>
        <Button onClick={newAuto}>
          <Plus className="w-4 h-4 mr-1.5" /> New automation
        </Button>
      </div>

      <Card>
        <CardContent className="pt-6 space-y-2">
          {rows.map((a) => (
            <div key={a.id} className="border rounded-md p-3 flex items-center gap-3">
              <Zap className="w-4 h-4 text-accent" />
              <div className="flex-1">
                <div className="font-medium">{a.name}</div>
                <div className="text-xs text-muted-foreground">
                  Trigger: {TRIGGERS.find((t) => t.value === a.trigger)?.label || a.trigger}
                </div>
              </div>
              <Badge variant={a.status === "active" ? "default" : "secondary"} className="text-[10px] uppercase">
                {a.status}
              </Badge>
              <Switch checked={a.status === "active"} onCheckedChange={() => toggle(a)} />
              <Button size="sm" variant="outline" onClick={() => openEditor(a)}>
                Edit
              </Button>
              <Button size="sm" variant="ghost" onClick={() => del(a.id)}>
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          ))}
          {rows.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-8">No automations yet.</p>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!open} onOpenChange={(v) => !v && setOpen(null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Edit automation</DialogTitle>
          </DialogHeader>
          {open && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Name</Label>
                  <Input value={open.name} onChange={(e) => setOpen({ ...open, name: e.target.value })} />
                </div>
                <div>
                  <Label>Trigger</Label>
                  <Select value={open.trigger} onValueChange={(v) => setOpen({ ...open, trigger: v })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {TRIGGERS.map((t) => (
                        <SelectItem key={t.value} value={t.value}>
                          {t.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Steps</Label>
                {steps.map((s, i) => {
                  const tpl = templates.find((t) => t.name === s.template_name);
                  return (
                    <div key={s.id} className="border rounded p-3 space-y-2">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold w-12">Step {i + 1}</span>
                        <Input
                          type="number"
                          min={0}
                          className="w-28"
                          value={s.delay_minutes}
                          onChange={(e) => updateStep(s, { delay_minutes: Number(e.target.value) })}
                        />
                        <span className="text-xs text-muted-foreground">minutes after previous</span>
                        <div className="flex-1" />
                        <Button size="sm" variant="ghost" onClick={() => removeStep(s)}>
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                      <Select
                        value={s.template_name || ""}
                        onValueChange={(v) => {
                          const t = templates.find((tt) => tt.name === v);
                          updateStep(s, {
                            template_name: v,
                            template_language: t?.language || "en",
                            variables_map: (t?.variables || []).reduce(
                              (acc, k, idx) => ({ ...acc, [String(idx + 1)]: `{{${k}}}` }),
                              {} as Record<string, string>,
                            ),
                          });
                        }}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Pick template" />
                        </SelectTrigger>
                        <SelectContent>
                          {templates.map((t) => (
                            <SelectItem key={t.id} value={t.name}>
                              {t.name} ({t.language})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {tpl && tpl.variables.length > 0 && (
                        <div className="space-y-1">
                          {tpl.variables.map((v, idx) => {
                            const key = String(idx + 1);
                            return (
                              <div key={key} className="flex items-center gap-2">
                                <span className="text-xs text-muted-foreground w-24 font-mono">{`{{${v}}}`}</span>
                                <Input
                                  value={s.variables_map?.[key] || ""}
                                  onChange={(e) =>
                                    updateStep(s, {
                                      variables_map: { ...(s.variables_map || {}), [key]: e.target.value },
                                    })
                                  }
                                  placeholder="Use {{name}} to merge contact name"
                                />
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
                <Button variant="outline" size="sm" onClick={addStep}>
                  <Plus className="w-4 h-4 mr-1.5" /> Add step
                </Button>
              </div>

              <div className="flex justify-end gap-2">
                <Button variant="ghost" onClick={() => setOpen(null)}>
                  Close
                </Button>
                <Button onClick={saveAuto}>Save</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
