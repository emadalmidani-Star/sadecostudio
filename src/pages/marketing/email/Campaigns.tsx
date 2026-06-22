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
import { Plus, Send, Calendar, Trash2, Mail, Pencil } from "lucide-react";

export default function EmailCampaigns() {
  const { user } = useAuth();
  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [lists, setLists] = useState<any[]>([]);
  const [templates, setTemplates] = useState<any[]>([]);
  const [testOpen, setTestOpen] = useState<string | null>(null);
  const [testEmail, setTestEmail] = useState("");
  const [testing, setTesting] = useState(false);
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<any>({ name: "", list_id: "", template_id: "", subject: "" });

  function resetForm() {
    setForm({ name: "", list_id: "", template_id: "", subject: "" });
    setEditingId(null);
  }

  async function load() {
    const [{ data: c }, { data: l }, { data: t }] = await Promise.all([
      supabase.from("email_campaigns").select("*").order("created_at", { ascending: false }),
      supabase.from("email_lists").select("id,name"),
      supabase.from("email_templates").select("id,name,subject"),
    ]);
    setCampaigns(c || []); setLists(l || []); setTemplates(t || []);
  }
  useEffect(() => { load(); }, [user?.id]);

  function openEdit(c: any) {
    setEditingId(c.id);
    setForm({ name: c.name || "", list_id: c.list_id || "", template_id: c.template_id || "", subject: c.subject || "" });
    setOpen(true);
  }

  async function save() {
    if (!user) return;
    const tpl = templates.find(t => t.id === form.template_id);
    const payload = { ...form, subject: form.subject || tpl?.subject || "" };
    const { error } = editingId
      ? await supabase.from("email_campaigns").update(payload).eq("id", editingId)
      : await supabase.from("email_campaigns").insert({ user_id: user.id, ...payload });
    if (error) toast({ title: "Failed", description: error.message, variant: "destructive" });
    else { setOpen(false); resetForm(); load(); }
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
        <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) resetForm(); }}>
          <DialogTrigger asChild><Button size="sm" onClick={() => resetForm()}><Plus className="w-4 h-4 mr-2" />New campaign</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>{editingId ? "Edit campaign" : "New campaign"}</DialogTitle></DialogHeader>
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
            <DialogFooter><Button onClick={save} disabled={!form.name || !form.list_id || !form.template_id}>{editingId ? "Save changes" : "Create"}</Button></DialogFooter>
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

      <Dialog open={!!testOpen} onOpenChange={(o) => { if (!o) { setTestOpen(null); setTestEmail(""); } }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Send test email</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">Sends the campaign template to test recipients only — no contacts on your list are affected. Max 5 addresses, comma-separated.</p>
            <div>
              <Label>Recipients</Label>
              <Input value={testEmail} onChange={e => setTestEmail(e.target.value)} placeholder="you@example.com, teammate@example.com" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setTestOpen(null); setTestEmail(""); }}>Cancel</Button>
            <Button onClick={() => testOpen && sendTest(testOpen)} disabled={testing || !testEmail.trim()}>{testing ? "Sending…" : "Send test"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
