import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Plus, Trash2 } from "lucide-react";

type Snippet = { id: string; name: string; body: string };

export default function WhatsAppSnippets() {
  const { user } = useAuth();
  const [rows, setRows] = useState<Snippet[]>([]);
  const [open, setOpen] = useState<Snippet | null>(null);

  async function load() {
    if (!user) return;
    const { data } = await supabase
      .from("whatsapp_snippets")
      .select("*")
      .eq("user_id", user.id)
      .order("name");
    setRows((data as any) || []);
  }
  useEffect(() => {
    load();
  }, [user?.id]);

  async function newSnippet() {
    const { data } = await supabase
      .from("whatsapp_snippets")
      .insert({ user_id: user!.id, name: "New snippet", body: "Hi {{name}}, " })
      .select()
      .maybeSingle();
    if (data) setOpen(data as any);
    load();
  }

  async function save() {
    if (!open) return;
    await supabase.from("whatsapp_snippets").update({ name: open.name, body: open.body }).eq("id", open.id);
    setOpen(null);
    load();
  }

  async function del(id: string) {
    await supabase.from("whatsapp_snippets").delete().eq("id", id);
    load();
  }

  return (
    <div className="p-6 space-y-6 max-w-3xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-serif text-3xl">Personal Snippets</h1>
          <p className="text-sm text-muted-foreground">
            Saved messages used when you open WhatsApp on your phone from a lead or contact (click-to-chat). Use{" "}
            <code className="text-xs">{"{{name}}"}</code> to merge the contact's name.
          </p>
        </div>
        <Button onClick={newSnippet}>
          <Plus className="w-4 h-4 mr-1.5" /> New snippet
        </Button>
      </div>

      <Card>
        <CardContent className="pt-6 space-y-2">
          {rows.map((s) => (
            <div key={s.id} className="border rounded-md p-3 flex items-center gap-3">
              <div className="flex-1 min-w-0">
                <div className="font-medium">{s.name}</div>
                <div className="text-xs text-muted-foreground truncate">{s.body}</div>
              </div>
              <Button size="sm" variant="outline" onClick={() => setOpen(s)}>
                Edit
              </Button>
              <Button size="sm" variant="ghost" onClick={() => del(s.id)}>
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          ))}
          {rows.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-8">No snippets yet.</p>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!open} onOpenChange={(v) => !v && setOpen(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit snippet</DialogTitle>
          </DialogHeader>
          {open && (
            <div className="space-y-3">
              <div>
                <Label>Name</Label>
                <Input value={open.name} onChange={(e) => setOpen({ ...open, name: e.target.value })} />
              </div>
              <div>
                <Label>Message</Label>
                <Textarea
                  rows={6}
                  value={open.body}
                  onChange={(e) => setOpen({ ...open, body: e.target.value })}
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="ghost" onClick={() => setOpen(null)}>
                  Cancel
                </Button>
                <Button onClick={save}>Save</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
