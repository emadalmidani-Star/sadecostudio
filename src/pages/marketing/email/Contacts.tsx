import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import { Plus, Upload, Trash2 } from "lucide-react";

export default function EmailContacts() {
  const { user } = useAuth();
  const [rows, setRows] = useState<any[]>([]);
  const [q, setQ] = useState("");
  const [openAdd, setOpenAdd] = useState(false);
  const [openCsv, setOpenCsv] = useState(false);
  const [form, setForm] = useState({ email: "", name: "" });
  const [csv, setCsv] = useState("");

  async function load() {
    if (!user) return;
    const { data } = await supabase.from("email_contacts").select("*").order("created_at", { ascending: false }).limit(500);
    setRows(data || []);
  }
  useEffect(() => { load(); }, [user?.id]);

  async function add() {
    if (!user || !form.email) return;
    const { error } = await supabase.from("email_contacts").insert({
      user_id: user.id, email: form.email.toLowerCase(), name: form.name || null, source: "manual",
    });
    if (error) toast({ title: "Add failed", description: error.message, variant: "destructive" });
    else { setOpenAdd(false); setForm({ email: "", name: "" }); load(); }
  }

  async function importCsv() {
    if (!user || !csv.trim()) return;
    const lines = csv.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    const rows = lines.map(l => {
      const [email, name] = l.split(",").map(s => (s || "").trim());
      return email ? { user_id: user.id, email: email.toLowerCase(), name: name || null, source: "csv" } : null;
    }).filter(Boolean) as any[];
    if (!rows.length) return;
    const { error } = await supabase.from("email_contacts").upsert(rows, { onConflict: "user_id,email" });
    if (error) toast({ title: "Import failed", description: error.message, variant: "destructive" });
    else { setOpenCsv(false); setCsv(""); load(); toast({ title: `Imported ${rows.length} contacts` }); }
  }

  async function del(id: string) {
    await supabase.from("email_contacts").delete().eq("id", id);
    load();
  }

  const filtered = rows.filter(r => !q || (r.email + " " + (r.name || "")).toLowerCase().includes(q.toLowerCase()));

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-serif">Contacts</h1>
          <p className="text-sm text-muted-foreground">{rows.length} total · leads auto-sync</p>
        </div>
        <div className="flex gap-2">
          <Dialog open={openCsv} onOpenChange={setOpenCsv}>
            <DialogTrigger asChild><Button variant="outline" size="sm"><Upload className="w-4 h-4 mr-2" />Import CSV</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Paste CSV (email, name)</DialogTitle></DialogHeader>
              <Textarea rows={10} value={csv} onChange={e => setCsv(e.target.value)} placeholder="john@example.com, John Doe" />
              <DialogFooter><Button onClick={importCsv}>Import</Button></DialogFooter>
            </DialogContent>
          </Dialog>
          <Dialog open={openAdd} onOpenChange={setOpenAdd}>
            <DialogTrigger asChild><Button size="sm"><Plus className="w-4 h-4 mr-2" />Add</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Add contact</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div><Label>Email</Label><Input value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} /></div>
                <div><Label>Name</Label><Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></div>
              </div>
              <DialogFooter><Button onClick={add}>Add</Button></DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>
      <Input placeholder="Search email or name…" value={q} onChange={e => setQ(e.target.value)} className="max-w-sm" />
      <div className="border rounded-md">
        <Table>
          <TableHeader><TableRow><TableHead>Email</TableHead><TableHead>Name</TableHead><TableHead>Source</TableHead><TableHead>Status</TableHead><TableHead /></TableRow></TableHeader>
          <TableBody>
            {filtered.map(r => (
              <TableRow key={r.id}>
                <TableCell className="font-mono text-xs">{r.email}</TableCell>
                <TableCell>{r.name || "—"}</TableCell>
                <TableCell><Badge variant="outline" className="text-xs">{r.source}</Badge></TableCell>
                <TableCell><Badge variant={r.status === "subscribed" ? "default" : "secondary"} className="text-xs">{r.status}</Badge></TableCell>
                <TableCell><Button size="sm" variant="ghost" onClick={() => del(r.id)}><Trash2 className="w-3.5 h-3.5" /></Button></TableCell>
              </TableRow>
            ))}
            {!filtered.length && <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">No contacts</TableCell></TableRow>}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
