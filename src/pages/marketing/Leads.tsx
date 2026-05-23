import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "@/hooks/use-toast";
import { Plus, Settings, MessageCircle, Mail, Globe, PenLine, Copy, Trash2, FolderPlus, Loader2 } from "lucide-react";

type Lead = {
  id: string;
  user_id: string;
  name: string;
  email: string | null;
  phone: string | null;
  company: string | null;
  message: string | null;
  source: "manual" | "web_form" | "email" | "whatsapp" | "other";
  source_meta: any;
  stage: Stage;
  project_id: string | null;
  created_at: string;
};
type Stage = "new" | "contacted" | "qualified" | "proposal" | "won" | "lost";
type IntakeToken = { id: string; kind: "web_form" | "email" | "whatsapp"; token: string; label: string | null; active: boolean };

const STAGES: { key: Stage; label: string }[] = [
  { key: "new", label: "New" },
  { key: "contacted", label: "Contacted" },
  { key: "qualified", label: "Qualified" },
  { key: "proposal", label: "Proposal" },
  { key: "won", label: "Won" },
  { key: "lost", label: "Lost" },
];

const SOURCE_ICON: Record<Lead["source"], any> = {
  manual: PenLine,
  web_form: Globe,
  email: Mail,
  whatsapp: MessageCircle,
  other: PenLine,
};

const SOURCE_LABEL: Record<Lead["source"], string> = {
  manual: "Manual",
  web_form: "Web form",
  email: "Email",
  whatsapp: "WhatsApp",
  other: "Other",
};

function randomToken() {
  const arr = new Uint8Array(18);
  crypto.getRandomValues(arr);
  return Array.from(arr).map((b) => b.toString(36).padStart(2, "0")).join("").slice(0, 28);
}

export default function MarketingLeads() {
  const { user } = useAuth();
  const nav = useNavigate();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [stageFilter, setStageFilter] = useState<Stage | "all">("all");
  const [sourceFilter, setSourceFilter] = useState<Lead["source"] | "all">("all");
  const [openNew, setOpenNew] = useState(false);
  const [openSettings, setOpenSettings] = useState(false);
  const [selected, setSelected] = useState<Lead | null>(null);

  async function load() {
    if (!user) return;
    setLoading(true);
    const { data } = await supabase.from("leads").select("*").order("created_at", { ascending: false });
    setLeads((data || []) as Lead[]);
    setLoading(false);
  }

  useEffect(() => { load(); }, [user?.id]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return leads.filter((l) => {
      if (stageFilter !== "all" && l.stage !== stageFilter) return false;
      if (sourceFilter !== "all" && l.source !== sourceFilter) return false;
      if (q) {
        const hay = [l.name, l.email, l.phone, l.company, l.message].filter(Boolean).join(" ").toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [leads, search, stageFilter, sourceFilter]);

  async function changeStage(lead: Lead, stage: Stage) {
    const prev = lead.stage;
    setLeads((ls) => ls.map((l) => (l.id === lead.id ? { ...l, stage } : l)));
    const { error } = await supabase.from("leads").update({ stage }).eq("id", lead.id);
    if (error) {
      setLeads((ls) => ls.map((l) => (l.id === lead.id ? { ...l, stage: prev } : l)));
      toast({ title: "Failed to update", description: error.message, variant: "destructive" });
    }
  }

  async function deleteLead(id: string) {
    if (!confirm("Delete this lead?")) return;
    await supabase.from("leads").delete().eq("id", id);
    setSelected(null);
    setLeads((ls) => ls.filter((l) => l.id !== id));
  }

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-serif text-4xl">Leads</h1>
          <p className="text-muted-foreground mt-1">Capture leads from WhatsApp, email, web form, or add them manually.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setOpenSettings(true)}><Settings className="w-4 h-4 mr-2" />Intake settings</Button>
          <Button onClick={() => setOpenNew(true)}><Plus className="w-4 h-4 mr-2" />New lead</Button>
        </div>
      </div>

      <div className="flex flex-wrap gap-3">
        <Input placeholder="Search name, email, company…" value={search} onChange={(e) => setSearch(e.target.value)} className="max-w-xs" />
        <Select value={stageFilter} onValueChange={(v) => setStageFilter(v as any)}>
          <SelectTrigger className="w-40"><SelectValue placeholder="Stage" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All stages</SelectItem>
            {STAGES.map((s) => <SelectItem key={s.key} value={s.key}>{s.label}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={sourceFilter} onValueChange={(v) => setSourceFilter(v as any)}>
          <SelectTrigger className="w-40"><SelectValue placeholder="Source" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All sources</SelectItem>
            {(Object.keys(SOURCE_LABEL) as Lead["source"][]).map((s) => (
              <SelectItem key={s} value={s}>{SOURCE_LABEL[s]}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Tabs defaultValue="kanban">
        <TabsList>
          <TabsTrigger value="kanban">Kanban</TabsTrigger>
          <TabsTrigger value="table">Table</TabsTrigger>
        </TabsList>

        <TabsContent value="kanban" className="mt-4">
          {loading ? (
            <div className="text-sm text-muted-foreground flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" />Loading…</div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
              {STAGES.map((s) => {
                const items = filtered.filter((l) => l.stage === s.key);
                return (
                  <div key={s.key} className="bg-muted/40 rounded-lg p-3 min-h-[200px]">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="text-xs uppercase tracking-wider font-semibold text-muted-foreground">{s.label}</h3>
                      <span className="text-xs text-muted-foreground">{items.length}</span>
                    </div>
                    <div className="space-y-2">
                      {items.map((l) => {
                        const Icon = SOURCE_ICON[l.source];
                        return (
                          <button key={l.id} onClick={() => setSelected(l)}
                            className="w-full text-left bg-card border rounded-md p-3 hover:border-accent transition-colors">
                            <div className="font-medium text-sm truncate">{l.name}</div>
                            {l.company && <div className="text-xs text-muted-foreground truncate">{l.company}</div>}
                            <div className="flex items-center gap-2 mt-2">
                              <Badge variant="secondary" className="text-[10px] gap-1"><Icon className="w-3 h-3" />{SOURCE_LABEL[l.source]}</Badge>
                              <span className="text-[10px] text-muted-foreground ml-auto">{new Date(l.created_at).toLocaleDateString()}</span>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </TabsContent>

        <TabsContent value="table" className="mt-4">
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Company</TableHead>
                    <TableHead>Contact</TableHead>
                    <TableHead>Source</TableHead>
                    <TableHead>Stage</TableHead>
                    <TableHead>Created</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((l) => {
                    const Icon = SOURCE_ICON[l.source];
                    return (
                      <TableRow key={l.id} className="cursor-pointer" onClick={() => setSelected(l)}>
                        <TableCell className="font-medium">{l.name}</TableCell>
                        <TableCell>{l.company || "—"}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{l.email || l.phone || "—"}</TableCell>
                        <TableCell><Badge variant="secondary" className="gap-1"><Icon className="w-3 h-3" />{SOURCE_LABEL[l.source]}</Badge></TableCell>
                        <TableCell><Badge>{STAGES.find((s) => s.key === l.stage)?.label}</Badge></TableCell>
                        <TableCell className="text-sm text-muted-foreground">{new Date(l.created_at).toLocaleDateString()}</TableCell>
                      </TableRow>
                    );
                  })}
                  {filtered.length === 0 && (
                    <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">No leads yet.</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <NewLeadDialog open={openNew} onOpenChange={setOpenNew} onCreated={load} userId={user?.id} />
      <IntakeSettingsDialog open={openSettings} onOpenChange={setOpenSettings} userId={user?.id} />
      <LeadDetail lead={selected} onClose={() => setSelected(null)} onChangeStage={changeStage} onDelete={deleteLead} onConvert={async (lead) => {
        const { data, error } = await supabase.from("projects").insert({
          name: lead.company || lead.name,
          client_name: lead.company || lead.name,
          status: "ongoing",
          type: "fit-out",
          created_by: user?.id,
        }).select("id").single();
        if (error || !data) { toast({ title: "Failed", description: error?.message, variant: "destructive" }); return; }
        await supabase.from("leads").update({ stage: "won", project_id: data.id }).eq("id", lead.id);
        toast({ title: "Lead converted to project" });
        nav(`/projects/${data.id}`);
      }} />
    </div>
  );
}

function NewLeadDialog({ open, onOpenChange, onCreated, userId }: { open: boolean; onOpenChange: (v: boolean) => void; onCreated: () => void; userId?: string }) {
  const [form, setForm] = useState({ name: "", email: "", phone: "", company: "", message: "" });
  const [saving, setSaving] = useState(false);
  async function save() {
    if (!form.name.trim() || !userId) { toast({ title: "Name required", variant: "destructive" }); return; }
    setSaving(true);
    const { error } = await supabase.from("leads").insert({
      user_id: userId, name: form.name.trim(),
      email: form.email.trim() || null, phone: form.phone.trim() || null,
      company: form.company.trim() || null, message: form.message.trim() || null,
      source: "manual",
    });
    setSaving(false);
    if (error) { toast({ title: "Failed", description: error.message, variant: "destructive" }); return; }
    onOpenChange(false);
    setForm({ name: "", email: "", phone: "", company: "", message: "" });
    onCreated();
  }
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>New lead</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div><Label>Name *</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} maxLength={200} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Email</Label><Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} maxLength={255} /></div>
            <div><Label>Phone</Label><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} maxLength={50} /></div>
          </div>
          <div><Label>Company</Label><Input value={form.company} onChange={(e) => setForm({ ...form, company: e.target.value })} maxLength={200} /></div>
          <div><Label>Message</Label><Textarea value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} maxLength={2000} rows={4} /></div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={save} disabled={saving}>{saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function LeadDetail({ lead, onClose, onChangeStage, onDelete, onConvert }: {
  lead: Lead | null; onClose: () => void; onChangeStage: (l: Lead, s: Stage) => void; onDelete: (id: string) => void; onConvert: (l: Lead) => void;
}) {
  if (!lead) return null;
  const Icon = SOURCE_ICON[lead.source];
  return (
    <Sheet open={!!lead} onOpenChange={(v) => { if (!v) onClose(); }}>
      <SheetContent className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader><SheetTitle>{lead.name}</SheetTitle></SheetHeader>
        <div className="space-y-4 mt-4">
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="gap-1"><Icon className="w-3 h-3" />{SOURCE_LABEL[lead.source]}</Badge>
            <span className="text-xs text-muted-foreground">{new Date(lead.created_at).toLocaleString()}</span>
          </div>
          {lead.company && <div><Label className="text-xs">Company</Label><div className="text-sm">{lead.company}</div></div>}
          {lead.email && <div><Label className="text-xs">Email</Label><div className="text-sm"><a className="text-accent underline" href={`mailto:${lead.email}`}>{lead.email}</a></div></div>}
          {lead.phone && <div><Label className="text-xs">Phone</Label><div className="text-sm">{lead.phone}</div></div>}
          {lead.message && <div><Label className="text-xs">Message</Label><div className="text-sm whitespace-pre-wrap bg-muted/40 p-3 rounded">{lead.message}</div></div>}
          <div>
            <Label className="text-xs">Stage</Label>
            <Select value={lead.stage} onValueChange={(v) => onChangeStage(lead, v as Stage)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{STAGES.map((s) => <SelectItem key={s.key} value={s.key}>{s.label}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          {lead.source_meta && Object.keys(lead.source_meta).length > 0 && (
            <details className="text-xs text-muted-foreground">
              <summary className="cursor-pointer">Raw source data</summary>
              <pre className="mt-2 p-2 bg-muted/40 rounded overflow-x-auto">{JSON.stringify(lead.source_meta, null, 2)}</pre>
            </details>
          )}
          <div className="flex flex-wrap gap-2 pt-4 border-t">
            {!lead.project_id && <Button onClick={() => onConvert(lead)}><FolderPlus className="w-4 h-4 mr-2" />Convert to project</Button>}
            <Button variant="outline" className="text-destructive" onClick={() => onDelete(lead.id)}><Trash2 className="w-4 h-4 mr-2" />Delete</Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function IntakeSettingsDialog({ open, onOpenChange, userId }: { open: boolean; onOpenChange: (v: boolean) => void; userId?: string }) {
  const [tokens, setTokens] = useState<IntakeToken[]>([]);
  const [loading, setLoading] = useState(false);
  const projectRef = import.meta.env.VITE_SUPABASE_PROJECT_ID;
  const fnBase = `https://${projectRef}.supabase.co/functions/v1`;
  const origin = typeof window !== "undefined" ? window.location.origin : "";

  async function load() {
    if (!userId) return;
    setLoading(true);
    const { data } = await supabase.from("lead_intake_tokens").select("*").order("created_at");
    setTokens((data || []) as IntakeToken[]);
    setLoading(false);
  }
  useEffect(() => { if (open) load(); }, [open, userId]);

  async function create(kind: IntakeToken["kind"]) {
    if (!userId) return;
    const { error } = await supabase.from("lead_intake_tokens").insert({
      user_id: userId, kind, token: randomToken(),
      label: kind === "web_form" ? "Website form" : kind === "email" ? "Email inbox" : "WhatsApp",
    });
    if (error) { toast({ title: "Failed", description: error.message, variant: "destructive" }); return; }
    load();
  }
  async function toggle(t: IntakeToken) {
    await supabase.from("lead_intake_tokens").update({ active: !t.active }).eq("id", t.id);
    load();
  }
  async function remove(id: string) {
    if (!confirm("Revoke this token?")) return;
    await supabase.from("lead_intake_tokens").delete().eq("id", id);
    load();
  }
  function copy(text: string) {
    navigator.clipboard.writeText(text);
    toast({ title: "Copied" });
  }

  function urlFor(t: IntakeToken) {
    if (t.kind === "web_form") return `${origin}/leads/new/${t.token}`;
    if (t.kind === "email") return `${fnBase}/lead-intake-email  (token: ${t.token})`;
    return `${fnBase}/lead-intake-whatsapp  (verify token: ${t.token})`;
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader><DialogTitle>Intake settings</DialogTitle></DialogHeader>
        <div className="space-y-6">
          {(["web_form", "email", "whatsapp"] as const).map((kind) => {
            const items = tokens.filter((t) => t.kind === kind);
            const label = kind === "web_form" ? "Public web form" : kind === "email" ? "Email forwarding" : "WhatsApp Business";
            const help = kind === "web_form"
              ? "Share this URL anywhere — submissions create leads instantly."
              : kind === "email"
                ? "Use the webhook URL in your email provider's inbound route (Resend/Mailgun). Token authenticates the request."
                : "Paste the callback URL and verify token into your Meta WhatsApp Business app webhook config.";
            return (
              <div key={kind} className="border rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-medium">{label}</h3>
                  <Button size="sm" variant="outline" onClick={() => create(kind)}><Plus className="w-3 h-3 mr-1" />Generate token</Button>
                </div>
                <p className="text-xs text-muted-foreground mb-3">{help}</p>
                {items.length === 0 ? (
                  <div className="text-xs text-muted-foreground">No tokens yet.</div>
                ) : (
                  <div className="space-y-2">
                    {items.map((t) => (
                      <div key={t.id} className="flex items-center gap-2 text-xs bg-muted/40 rounded p-2">
                        <code className="flex-1 truncate">{urlFor(t)}</code>
                        <Badge variant={t.active ? "default" : "secondary"}>{t.active ? "Active" : "Off"}</Badge>
                        <Button size="sm" variant="ghost" onClick={() => copy(kind === "web_form" ? `${origin}/leads/new/${t.token}` : t.token)}><Copy className="w-3 h-3" /></Button>
                        <Button size="sm" variant="ghost" onClick={() => toggle(t)}>{t.active ? "Disable" : "Enable"}</Button>
                        <Button size="sm" variant="ghost" className="text-destructive" onClick={() => remove(t.id)}><Trash2 className="w-3 h-3" /></Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
          {loading && <div className="text-sm text-muted-foreground flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" />Loading…</div>}
        </div>
      </DialogContent>
    </Dialog>
  );
}
