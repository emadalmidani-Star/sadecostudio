import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import { Plus, Play, Pause, Trash2 } from "lucide-react";

const TRIGGERS = [
  { value: "lead_created", label: "New lead created" },
  { value: "contact_added", label: "New contact added" },
  { value: "list_added", label: "Added to a specific list" },
];

export default function EmailAutomations() {
  const { user } = useAuth();
  const [auts, setAuts] = useState<any[]>([]);
  const [tpls, setTpls] = useState<any[]>([]);
  const [cur, setCur] = useState<any | null>(null);
  const [steps, setSteps] = useState<any[]>([]);

  async function load() {
    const [{ data: a }, { data: t }] = await Promise.all([
      supabase.from("email_automations").select("*").order("created_at", { ascending: false }),
      supabase.from("email_templates").select("id,name"),
    ]);
    setAuts(a || []); setTpls(t || []);
  }
  useEffect(() => { load(); }, [user?.id]);

  async function loadSteps(id: string) {
    const { data } = await supabase.from("email_automation_steps").select("*").eq("automation_id", id).order("step_order");
    setSteps(data || []);
  }

  async function create() {
    if (!user) return;
    const name = prompt("Automation name?"); if (!name) return;
    const { data, error } = await supabase.from("email_automations").insert({
      user_id: user.id, name, trigger: "lead_created", status: "paused",
    }).select().single();
    if (error) toast({ title: "Failed", description: error.message, variant: "destructive" });
    else { setCur(data); loadSteps(data.id); load(); }
  }

  async function update(patch: any) {
    if (!cur) return;
    await supabase.from("email_automations").update(patch).eq("id", cur.id);
    setCur({ ...cur, ...patch }); load();
  }

  async function addStep() {
    if (!cur || !user) return;
    await supabase.from("email_automation_steps").insert({
      user_id: user.id, automation_id: cur.id, step_order: steps.length, delay_minutes: steps.length === 0 ? 0 : 1440,
    });
    loadSteps(cur.id);
  }
  async function updateStep(id: string, patch: any) {
    await supabase.from("email_automation_steps").update(patch).eq("id", id);
    loadSteps(cur.id);
  }
  async function delStep(id: string) {
    await supabase.from("email_automation_steps").delete().eq("id", id);
    loadSteps(cur.id);
  }
  async function delAut(id: string) {
    await supabase.from("email_automations").delete().eq("id", id);
    setCur(null); load();
  }

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-serif">Automations</h1>
        <Button size="sm" onClick={create}><Plus className="w-4 h-4 mr-2" />New automation</Button>
      </div>
      <p className="text-xs text-muted-foreground">Automations check for new triggers and advance steps every minute via cron. Status must be Active.</p>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="space-y-2">
          {auts.map(a => (
            <Card key={a.id} className={`cursor-pointer ${cur?.id === a.id ? "border-accent" : ""}`} onClick={() => { setCur(a); loadSteps(a.id); }}>
              <CardContent className="p-3 flex items-center justify-between">
                <div>
                  <div className="text-sm font-medium">{a.name}</div>
                  <div className="text-xs text-muted-foreground">{a.trigger}</div>
                </div>
                <Badge variant={a.status === "active" ? "default" : "secondary"} className="text-xs">{a.status}</Badge>
              </CardContent>
            </Card>
          ))}
        </div>

        {cur && (
          <div className="md:col-span-2 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-serif text-lg">{cur.name}</h2>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => update({ status: cur.status === "active" ? "paused" : "active" })}>
                  {cur.status === "active" ? <><Pause className="w-3.5 h-3.5 mr-1" />Pause</> : <><Play className="w-3.5 h-3.5 mr-1" />Activate</>}
                </Button>
                <Button size="sm" variant="ghost" onClick={() => delAut(cur.id)}><Trash2 className="w-3.5 h-3.5" /></Button>
              </div>
            </div>
            <div>
              <Label>Trigger</Label>
              <Select value={cur.trigger} onValueChange={v => update({ trigger: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{TRIGGERS.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="border rounded-md p-4 space-y-3">
              <div className="flex items-center justify-between">
                <Label>Steps</Label>
                <Button size="sm" variant="outline" onClick={addStep}><Plus className="w-3.5 h-3.5 mr-1" />Step</Button>
              </div>
              {steps.map((s, i) => (
                <div key={s.id} className="border rounded p-3 space-y-2 bg-muted/30">
                  <div className="flex items-center justify-between">
                    <span className="text-xs uppercase tracking-wide">Step {i + 1}</span>
                    <Button size="sm" variant="ghost" onClick={() => delStep(s.id)}><Trash2 className="w-3 h-3" /></Button>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div><Label className="text-xs">Delay (minutes)</Label><Input type="number" value={s.delay_minutes} onChange={e => updateStep(s.id, { delay_minutes: Number(e.target.value) })} /></div>
                    <div><Label className="text-xs">Template</Label>
                      <Select value={s.template_id || ""} onValueChange={v => updateStep(s.id, { template_id: v })}>
                        <SelectTrigger><SelectValue placeholder="Pick template" /></SelectTrigger>
                        <SelectContent>{tpls.map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div><Label className="text-xs">Subject (override)</Label><Input value={s.subject || ""} onChange={e => updateStep(s.id, { subject: e.target.value })} /></div>
                </div>
              ))}
              {!steps.length && <p className="text-sm text-muted-foreground">No steps yet.</p>}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
