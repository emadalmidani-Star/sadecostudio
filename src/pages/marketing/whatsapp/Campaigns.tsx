import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import { Plus, Send, Mail, Trash2 } from "lucide-react";

type Campaign = {
  id: string;
  name: string;
  status: string;
  template_name: string | null;
  list_id: string | null;
  scheduled_for: string | null;
  sent_at: string | null;
  stats: any;
  variables_map: Record<string, string>;
  template_language: string | null;
};
type List = { id: string; name: string };
type Tpl = { id: string; name: string; language: string; status: string; body: string; variables: string[] };

export default function WhatsAppCampaigns() {
  const { user } = useAuth();
  const [rows, setRows] = useState<Campaign[]>([]);
  const [lists, setLists] = useState<List[]>([]);
  const [templates, setTemplates] = useState<Tpl[]>([]);
  const [open, setOpen] = useState<Campaign | null>(null);
  const [testOpen, setTestOpen] = useState<Campaign | null>(null);
  const [testPhones, setTestPhones] = useState("");
  const [testing, setTesting] = useState(false);

  async function load() {
    if (!user) return;
    const [{ data: c }, { data: l }, { data: t }] = await Promise.all([
      supabase
        .from("whatsapp_campaigns")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false }),
      supabase.from("whatsapp_lists").select("id,name").eq("user_id", user.id).order("name"),
      supabase
        .from("whatsapp_templates")
        .select("id,name,language,status,body,variables")
        .eq("user_id", user.id)
        .eq("status", "APPROVED")
        .order("name"),
    ]);
    setRows((c as any) || []);
    setLists((l as any) || []);
    setTemplates((t as any) || []);
  }
  useEffect(() => {
    load();
  }, [user?.id]);

  async function newCampaign() {
    const { data } = await supabase
      .from("whatsapp_campaigns")
      .insert({ user_id: user!.id, name: "Untitled campaign", variables_map: {} })
      .select()
      .maybeSingle();
    if (data) setOpen(data as any);
    load();
  }

  async function saveCampaign() {
    if (!open) return;
    const { error } = await supabase
      .from("whatsapp_campaigns")
      .update({
        name: open.name,
        list_id: open.list_id,
        template_name: open.template_name,
        template_language: open.template_language || "en",
        variables_map: open.variables_map || {},
        scheduled_for: open.scheduled_for,
      })
      .eq("id", open.id);
    if (error) return toast({ title: "Save failed", description: error.message, variant: "destructive" });
    toast({ title: "Saved" });
    load();
  }

  async function sendNow(c: Campaign) {
    if (!c.list_id || !c.template_name) {
      return toast({ title: "Pick a list and template first", variant: "destructive" });
    }
    await supabase.from("whatsapp_campaigns").update({ status: "sending", scheduled_for: null }).eq("id", c.id);
    const { data, error } = await supabase.functions.invoke("whatsapp-campaign-send", {
      body: { campaign_id: c.id },
    });
    if (error || (data as any)?.error) {
      return toast({
        title: "Send failed",
        description: error?.message || (data as any)?.error,
        variant: "destructive",
      });
    }
    toast({ title: `Batch sent: ${(data as any).sent || 0}` });
    load();
  }

  async function sendTest(c: Campaign) {
    if (!c.template_name) return toast({ title: "Pick a template first", variant: "destructive" });
    const phones = testPhones.split(",").map((s) => s.trim()).filter(Boolean);
    if (!phones.length) return toast({ title: "Add at least one phone", variant: "destructive" });
    setTesting(true);
    const { data, error } = await supabase.functions.invoke("whatsapp-campaign-test", {
      body: { campaign_id: c.id, phones },
    });
    setTesting(false);
    if (error || (data as any)?.error) {
      return toast({
        title: "Test failed",
        description: error?.message || (data as any)?.error,
        variant: "destructive",
      });
    }
    const results = (data as any).results || [];
    const ok = results.filter((r: any) => r.ok).length;
    toast({ title: `Test sent`, description: `${ok}/${results.length} delivered to Meta` });
    setTestOpen(null);
    setTestPhones("");
  }

  async function del(id: string) {
    await supabase.from("whatsapp_campaigns").delete().eq("id", id);
    load();
  }

  const editingTpl = open ? templates.find((t) => t.name === open.template_name) : null;

  return (
    <div className="p-6 space-y-6 max-w-6xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-serif text-3xl">WhatsApp Campaigns</h1>
          <p className="text-sm text-muted-foreground">
            Broadcast an approved template to a list. Only subscribed contacts receive it.
          </p>
        </div>
        <Button onClick={newCampaign}>
          <Plus className="w-4 h-4 mr-1.5" /> New campaign
        </Button>
      </div>

      <Card>
        <CardContent className="pt-6 space-y-2">
          {rows.map((c) => {
            const isDraft = c.status === "draft" || c.status === "failed";
            return (
              <div key={c.id} className="border rounded-md p-3 flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <div className="font-medium truncate">{c.name}</div>
                  <div className="text-xs text-muted-foreground">
                    {c.template_name || "no template"} · {lists.find((l) => l.id === c.list_id)?.name || "no list"}
                  </div>
                </div>
                <Badge
                  variant={c.status === "sent" ? "default" : c.status === "failed" ? "destructive" : "secondary"}
                  className="text-[10px] uppercase"
                >
                  {c.status}
                </Badge>
                {c.status === "sent" && (
                  <span className="text-xs text-muted-foreground">
                    {c.stats?.sent || 0}/{c.stats?.recipients || 0} sent · {c.stats?.delivered || 0} delivered
                  </span>
                )}
                <Button size="sm" variant="outline" onClick={() => setOpen(c)}>
                  Edit
                </Button>
                {isDraft && (
                  <>
                    <Button size="sm" variant="outline" onClick={() => setTestOpen(c)}>
                      <Mail className="w-4 h-4 mr-1.5" /> Test
                    </Button>
                    <Button size="sm" onClick={() => sendNow(c)}>
                      <Send className="w-4 h-4 mr-1.5" /> Send
                    </Button>
                  </>
                )}
                <Button size="sm" variant="ghost" onClick={() => del(c.id)}>
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            );
          })}
          {rows.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-8">No campaigns yet.</p>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!open} onOpenChange={(v) => !v && setOpen(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit campaign</DialogTitle>
          </DialogHeader>
          {open && (
            <div className="space-y-3">
              <div>
                <Label>Name</Label>
                <Input value={open.name} onChange={(e) => setOpen({ ...open, name: e.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>List</Label>
                  <Select value={open.list_id || ""} onValueChange={(v) => setOpen({ ...open, list_id: v })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Pick list" />
                    </SelectTrigger>
                    <SelectContent>
                      {lists.map((l) => (
                        <SelectItem key={l.id} value={l.id}>
                          {l.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Template</Label>
                  <Select
                    value={open.template_name || ""}
                    onValueChange={(v) => {
                      const t = templates.find((tt) => tt.name === v);
                      setOpen({
                        ...open,
                        template_name: v,
                        template_language: t?.language || "en",
                        variables_map: (t?.variables || []).reduce(
                          (acc, k, i) => ({ ...acc, [String(i + 1)]: `{{${k}}}` }),
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
                </div>
              </div>
              {editingTpl && (
                <div className="border rounded-md p-3 bg-muted/30 space-y-2">
                  <pre className="text-xs whitespace-pre-wrap font-sans">{editingTpl.body}</pre>
                  {editingTpl.variables.length > 0 && (
                    <div className="space-y-1">
                      <Label className="text-xs">Variables</Label>
                      {editingTpl.variables.map((v, i) => {
                        const key = String(i + 1);
                        return (
                          <div key={key} className="flex items-center gap-2">
                            <span className="text-xs text-muted-foreground w-24 font-mono">{`{{${v}}}`}</span>
                            <Input
                              value={open.variables_map?.[key] || ""}
                              onChange={(e) =>
                                setOpen({
                                  ...open,
                                  variables_map: { ...(open.variables_map || {}), [key]: e.target.value },
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
              )}
              <div>
                <Label>Schedule for (optional)</Label>
                <Input
                  type="datetime-local"
                  value={open.scheduled_for ? new Date(open.scheduled_for).toISOString().slice(0, 16) : ""}
                  onChange={(e) =>
                    setOpen({
                      ...open,
                      scheduled_for: e.target.value ? new Date(e.target.value).toISOString() : null,
                    })
                  }
                />
              </div>
              <div className="flex justify-between gap-2">
                <Button
                  variant="outline"
                  onClick={async () => {
                    if (!open.scheduled_for) {
                      return toast({ title: "Pick a date first" });
                    }
                    await supabase
                      .from("whatsapp_campaigns")
                      .update({ status: "scheduled" })
                      .eq("id", open.id);
                    toast({ title: "Scheduled" });
                    setOpen(null);
                    load();
                  }}
                >
                  Schedule
                </Button>
                <div className="flex gap-2">
                  <Button variant="ghost" onClick={() => setOpen(null)}>
                    Close
                  </Button>
                  <Button onClick={saveCampaign}>Save</Button>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={!!testOpen} onOpenChange={(v) => !v && setTestOpen(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Send test</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Input
              placeholder="+971501234567, +971507654321"
              value={testPhones}
              onChange={(e) => setTestPhones(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Comma-separated. Max 5. Variables will use "Test" as the placeholder name.
            </p>
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setTestOpen(null)}>
                Cancel
              </Button>
              <Button onClick={() => testOpen && sendTest(testOpen)} disabled={testing}>
                {testing ? "Sending…" : "Send test"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
