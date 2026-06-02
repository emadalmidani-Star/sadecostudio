import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";
import { Plus, Trash2, Users } from "lucide-react";

type List = { id: string; name: string; description: string | null; created_at: string };

export default function WhatsAppLists() {
  const { user } = useAuth();
  const [lists, setLists] = useState<List[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");
  const [memberOpen, setMemberOpen] = useState<List | null>(null);
  const [available, setAvailable] = useState<{ id: string; phone: string; name: string | null }[]>([]);
  const [members, setMembers] = useState<string[]>([]);

  async function load() {
    if (!user) return;
    const { data } = await supabase
      .from("whatsapp_lists")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });
    setLists((data as any) || []);
    const { data: m } = await supabase.from("whatsapp_list_members").select("list_id").eq("user_id", user.id);
    const c: Record<string, number> = {};
    (m || []).forEach((row: any) => {
      c[row.list_id] = (c[row.list_id] || 0) + 1;
    });
    setCounts(c);
  }
  useEffect(() => {
    load();
  }, [user?.id]);

  async function create() {
    if (!name) return;
    await supabase.from("whatsapp_lists").insert({ user_id: user!.id, name, description: desc || null });
    setOpen(false);
    setName("");
    setDesc("");
    load();
  }

  async function del(id: string) {
    await supabase.from("whatsapp_lists").delete().eq("id", id);
    load();
  }

  async function openMembers(l: List) {
    const [{ data: cs }, { data: ms }] = await Promise.all([
      supabase
        .from("whatsapp_contacts")
        .select("id, phone, name")
        .eq("user_id", user!.id)
        .eq("status", "subscribed")
        .order("created_at", { ascending: false })
        .limit(1000),
      supabase.from("whatsapp_list_members").select("contact_id").eq("list_id", l.id),
    ]);
    setAvailable((cs as any) || []);
    setMembers((ms || []).map((m: any) => m.contact_id));
    setMemberOpen(l);
  }

  async function toggleMember(cid: string) {
    if (!memberOpen) return;
    if (members.includes(cid)) {
      await supabase.from("whatsapp_list_members").delete().eq("list_id", memberOpen.id).eq("contact_id", cid);
      setMembers(members.filter((m) => m !== cid));
    } else {
      await supabase.from("whatsapp_list_members").insert({
        user_id: user!.id,
        list_id: memberOpen.id,
        contact_id: cid,
      });
      setMembers([...members, cid]);
    }
    load();
  }

  return (
    <div className="p-6 space-y-6 max-w-5xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-serif text-3xl">WhatsApp Lists</h1>
          <p className="text-sm text-muted-foreground">Group contacts for targeted broadcasts.</p>
        </div>
        <Button onClick={() => setOpen(true)}>
          <Plus className="w-4 h-4 mr-1.5" /> New list
        </Button>
      </div>

      <Card>
        <CardContent className="pt-6 space-y-2">
          {lists.map((l) => (
            <div key={l.id} className="flex items-center gap-3 border rounded-md p-3">
              <Users className="w-4 h-4 text-muted-foreground" />
              <div className="flex-1">
                <div className="font-medium">{l.name}</div>
                {l.description && <div className="text-xs text-muted-foreground">{l.description}</div>}
              </div>
              <span className="text-xs text-muted-foreground">{counts[l.id] || 0} members</span>
              <Button size="sm" variant="outline" onClick={() => openMembers(l)}>
                Manage
              </Button>
              <Button size="sm" variant="ghost" onClick={() => del(l.id)}>
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          ))}
          {lists.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-6">No lists yet.</p>
          )}
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New WhatsApp list</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Name</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div>
              <Label>Description (optional)</Label>
              <Input value={desc} onChange={(e) => setDesc(e.target.value)} />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button onClick={create}>Create</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!memberOpen} onOpenChange={(v) => !v && setMemberOpen(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Members — {memberOpen?.name}</DialogTitle>
          </DialogHeader>
          <div className="max-h-96 overflow-y-auto space-y-1">
            {available.map((c) => {
              const active = members.includes(c.id);
              return (
                <button
                  key={c.id}
                  onClick={() => toggleMember(c.id)}
                  className={`w-full flex items-center gap-2 p-2 rounded text-sm text-left ${
                    active ? "bg-accent/15 border border-accent/40" : "hover:bg-muted border border-transparent"
                  }`}
                >
                  <input type="checkbox" checked={active} readOnly className="pointer-events-none" />
                  <div className="flex-1">
                    <div>{c.name || c.phone}</div>
                    <div className="text-xs text-muted-foreground font-mono">{c.phone}</div>
                  </div>
                </button>
              );
            })}
            {available.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-6">No subscribed contacts.</p>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
