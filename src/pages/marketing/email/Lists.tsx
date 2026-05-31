import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";
import { Plus, Users2, Trash2 } from "lucide-react";

export default function EmailLists() {
  const { user } = useAuth();
  const [lists, setLists] = useState<any[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", description: "" });
  const [selected, setSelected] = useState<any | null>(null);
  const [members, setMembers] = useState<any[]>([]);
  const [allContacts, setAllContacts] = useState<any[]>([]);

  async function load() {
    if (!user) return;
    const { data } = await supabase.from("email_lists").select("*").order("created_at", { ascending: false });
    setLists(data || []);
    const { data: m } = await supabase.from("email_list_members").select("list_id");
    const c: Record<string, number> = {};
    (m || []).forEach((x: any) => { c[x.list_id] = (c[x.list_id] || 0) + 1; });
    setCounts(c);
  }
  useEffect(() => { load(); }, [user?.id]);

  async function loadMembers(listId: string) {
    const { data } = await supabase.from("email_list_members").select("contact_id, email_contacts(id,email,name,status)").eq("list_id", listId);
    setMembers((data || []).map((x: any) => x.email_contacts).filter(Boolean));
    const { data: all } = await supabase.from("email_contacts").select("id,email,name").eq("status", "subscribed").limit(500);
    setAllContacts(all || []);
  }

  async function create() {
    if (!user || !form.name) return;
    const { error } = await supabase.from("email_lists").insert({ user_id: user.id, ...form });
    if (error) toast({ title: "Failed", description: error.message, variant: "destructive" });
    else { setOpen(false); setForm({ name: "", description: "" }); load(); }
  }

  async function addMember(contactId: string) {
    if (!user || !selected) return;
    await supabase.from("email_list_members").upsert({ user_id: user.id, list_id: selected.id, contact_id: contactId });
    loadMembers(selected.id); load();
  }
  async function removeMember(contactId: string) {
    if (!selected) return;
    await supabase.from("email_list_members").delete().eq("list_id", selected.id).eq("contact_id", contactId);
    loadMembers(selected.id); load();
  }
  async function delList(id: string) {
    await supabase.from("email_lists").delete().eq("id", id);
    setSelected(null); load();
  }

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-serif">Lists</h1>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button size="sm"><Plus className="w-4 h-4 mr-2" />New list</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Create list</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div><Label>Name</Label><Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></div>
              <div><Label>Description</Label><Input value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} /></div>
            </div>
            <DialogFooter><Button onClick={create}>Create</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="space-y-2 md:col-span-1">
          {lists.map(l => (
            <Card key={l.id} className={`cursor-pointer ${selected?.id === l.id ? "border-accent" : ""}`} onClick={() => { setSelected(l); loadMembers(l.id); }}>
              <CardContent className="p-4 flex items-center justify-between">
                <div>
                  <div className="font-medium text-sm">{l.name}</div>
                  <div className="text-xs text-muted-foreground flex items-center gap-1 mt-1"><Users2 className="w-3 h-3" />{counts[l.id] || 0} members</div>
                </div>
                <Button size="sm" variant="ghost" onClick={(e) => { e.stopPropagation(); delList(l.id); }}><Trash2 className="w-3.5 h-3.5" /></Button>
              </CardContent>
            </Card>
          ))}
          {!lists.length && <p className="text-sm text-muted-foreground">No lists yet.</p>}
        </div>

        <div className="md:col-span-2 space-y-4">
          {selected ? (
            <>
              <h2 className="font-serif text-lg">{selected.name}</h2>
              <div>
                <Label className="text-xs">Add contact</Label>
                <select className="w-full mt-1 border rounded-md px-2 py-2 text-sm bg-background"
                  onChange={(e) => { if (e.target.value) { addMember(e.target.value); e.target.value = ""; } }}>
                  <option value="">— select contact —</option>
                  {allContacts.filter(c => !members.find(m => m.id === c.id)).map(c => (
                    <option key={c.id} value={c.id}>{c.email}</option>
                  ))}
                </select>
              </div>
              <div className="border rounded-md divide-y">
                {members.map(m => (
                  <div key={m.id} className="p-3 flex items-center justify-between text-sm">
                    <div><span className="font-mono text-xs">{m.email}</span> {m.name && <span className="text-muted-foreground ml-2">{m.name}</span>}</div>
                    <Button size="sm" variant="ghost" onClick={() => removeMember(m.id)}><Trash2 className="w-3.5 h-3.5" /></Button>
                  </div>
                ))}
                {!members.length && <div className="p-4 text-sm text-muted-foreground text-center">No members yet</div>}
              </div>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">Select a list to manage members.</p>
          )}
        </div>
      </div>
    </div>
  );
}
