import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import { Plus, Send, Calendar, Trash2, Mail } from "lucide-react";

export default function EmailCampaigns() {
  const { user } = useAuth();
  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [lists, setLists] = useState<any[]>([]);
  const [templates, setTemplates] = useState<any[]>([]);
  const [testOpen, setTestOpen] = useState<string | null>(null);
  const [testEmail, setTestEmail] = useState("");
  const [testing, setTesting] = useState(false);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<any>({ name: "", list_id: "", template_id: "", subject: "" });

  async function load() {
    const [{ data: c }, { data: l }, { data: t }] = await Promise.all([
      supabase.from("email_campaigns").select("*").order("created_at", { ascending: false }),
      supabase.from("email_lists").select("id,name"),
      supabase.from("email_templates").select("id,name,subject"),
    ]);
    setCampaigns(c || []); setLists(l || []); setTemplates(t || []);
  }
  useEffect(() => { load(); }, [user?.id]);

  async function create() {
    if (!user) return;
    const tpl = templates.find(t => t.id === form.template_id);
    const { error } = await supabase.from("email_campaigns").insert({
      user_id: user.id, ...form, subject: form.subject || tpl?.subject || "",
    });
    if (error) toast({ title: "Failed", description: error.message, variant: "destructive" });
    else { setOpen(false); setForm({ name: "", list_id: "", template_id: "", subject: "" }); load(); }
  }

  async function sendNow(id: string) {
    if (!confirm("Send this campaign now?")) return;
    const { data, error } = await supabase.functions.invoke("email-campaign-send", { body: { campaignId: id } });
    if (error) toast({ title: "Send failed", description: error.message, variant: "destructive" });
    else toast({ title: `Sent: ${data?.sent || 0} / ${data?.total || 0}` });
    load();
  }

  async function schedule(id: string) {
    const when = prompt("Schedule date+time (YYYY-MM-DD HH:MM, local):");
    if (!when) return;
    const iso = new Date(when).toISOString();
    await supabase.from("email_campaigns").update({ status: "scheduled", scheduled_for: iso }).eq("id", id);
    load();
  }

  async function del(id: string) {
    await supabase.from("email_campaigns").delete().eq("id", id);
    load();
  }

  async function sendTest(campaignId: string) {
    if (!testEmail.trim()) { toast({ title: "Enter at least one email", variant: "destructive" }); return; }
    setTesting(true);
    const { data, error } = await supabase.functions.invoke("email-campaign-test", {
      body: { campaignId, recipients: testEmail.split(/[,\s;]+/).map(s => s.trim()).filter(Boolean) },
    });
    setTesting(false);
    if (error || data?.error) {
      toast({ title: "Test failed", description: data?.error || error?.message, variant: "destructive" });
    } else {
      toast({ title: `Test sent: ${data?.sent || 0} / ${data?.total || 0}`, description: data?.errors?.length ? data.errors.join("\n") : undefined });
      setTestOpen(null); setTestEmail("");
    }
  }

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-serif">Campaigns</h1>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button size="sm"><Plus className="w-4 h-4 mr-2" />New campaign</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>New campaign</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div><Label>Name (internal)</Label><Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></div>
              <div><Label>List</Label>
                <Select value={form.list_id} onValueChange={v => setForm({ ...form, list_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Pick a list" /></SelectTrigger>
                  <SelectContent>{lists.map(l => <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label>Template</Label>
                <Select value={form.template_id} onValueChange={v => setForm({ ...form, template_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Pick a template" /></SelectTrigger>
                  <SelectContent>{templates.map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label>Subject (overrides template)</Label><Input value={form.subject} onChange={e => setForm({ ...form, subject: e.target.value })} placeholder="Leave blank to use template subject" /></div>
            </div>
            <DialogFooter><Button onClick={create} disabled={!form.name || !form.list_id || !form.template_id}>Create</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="space-y-3">
        {campaigns.map(c => (
          <Card key={c.id}>
            <CardContent className="p-4 flex items-center justify-between">
              <div>
                <div className="flex items-center gap-3">
                  <h3 className="font-medium">{c.name}</h3>
                  <Badge variant={c.status === "sent" ? "default" : c.status === "failed" ? "destructive" : "secondary"} className="text-xs">{c.status}</Badge>
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  Subject: {c.subject || "—"} · Sent: {c.stats?.sent || 0} / {c.stats?.recipients || 0}
                  {c.scheduled_for && ` · ${new Date(c.scheduled_for).toLocaleString()}`}
                </div>
              </div>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => { setTestOpen(c.id); setTestEmail(user?.email || ""); }}><Mail className="w-3.5 h-3.5 mr-1" />Test</Button>
                {["draft", "failed"].includes(c.status) && <Button size="sm" onClick={() => sendNow(c.id)}><Send className="w-3.5 h-3.5 mr-1" />Send</Button>}
                {c.status === "draft" && <Button size="sm" variant="outline" onClick={() => schedule(c.id)}><Calendar className="w-3.5 h-3.5 mr-1" />Schedule</Button>}
                <Button size="sm" variant="ghost" onClick={() => del(c.id)}><Trash2 className="w-3.5 h-3.5" /></Button>
              </div>
            </CardContent>
          </Card>
        ))}
        {!campaigns.length && <p className="text-sm text-muted-foreground">No campaigns yet.</p>}
      </div>
    </div>
  );
}
