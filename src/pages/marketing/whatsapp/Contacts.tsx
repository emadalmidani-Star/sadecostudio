import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import { Plus, Trash2, Upload, MessageCircle } from "lucide-react";
import { cleanPhone, waLink } from "@/lib/whatsapp";

type Contact = {
  id: string;
  phone: string;
  name: string | null;
  status: string;
  source: string;
  tags: string[];
  created_at: string;
};

export default function WhatsAppContacts() {
  const { user } = useAuth();
  const [rows, setRows] = useState<Contact[]>([]);
  const [filter, setFilter] = useState("");
  const [open, setOpen] = useState(false);
  const [phone, setPhone] = useState("");
  const [name, setName] = useState("");
  const [importOpen, setImportOpen] = useState(false);
  const [csv, setCsv] = useState("");

  async function load() {
    if (!user) return;
    const { data } = await supabase
      .from("whatsapp_contacts")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(500);
    setRows((data as any) || []);
  }
  useEffect(() => {
    load();
  }, [user?.id]);

  async function add() {
    const p = cleanPhone(phone);
    if (!p) return toast({ title: "Phone required", variant: "destructive" });
    const { error } = await supabase
      .from("whatsapp_contacts")
      .insert({ user_id: user!.id, phone: p, name: name || null, source: "manual" });
    if (error) return toast({ title: "Failed", description: error.message, variant: "destructive" });
    setOpen(false);
    setPhone("");
    setName("");
    load();
  }

  async function importCsv() {
    const lines = csv.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    let ok = 0;
    for (const line of lines) {
      const [rawPhone, rawName] = line.split(",").map((s) => s?.trim());
      const p = cleanPhone(rawPhone);
      if (!p) continue;
      const { error } = await supabase
        .from("whatsapp_contacts")
        .upsert(
          { user_id: user!.id, phone: p, name: rawName || null, source: "import" },
          { onConflict: "user_id,phone" },
        );
      if (!error) ok++;
    }
    toast({ title: `Imported ${ok} contacts` });
    setImportOpen(false);
    setCsv("");
    load();
  }

  async function del(id: string) {
    await supabase.from("whatsapp_contacts").delete().eq("id", id);
    load();
  }

  const filtered = rows.filter((r) => {
    if (!filter) return true;
    const q = filter.toLowerCase();
    return r.phone.includes(q) || (r.name || "").toLowerCase().includes(q);
  });

  return (
    <div className="p-6 space-y-6 max-w-6xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-serif text-3xl">WhatsApp Contacts</h1>
          <p className="text-sm text-muted-foreground">
            Subscribed numbers eligible for broadcasts and automated messages. Leads with phone numbers are added
            automatically.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setImportOpen(true)}>
            <Upload className="w-4 h-4 mr-1.5" /> Import CSV
          </Button>
          <Button onClick={() => setOpen(true)}>
            <Plus className="w-4 h-4 mr-1.5" /> Add contact
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">All contacts ({rows.length})</CardTitle>
          <Input placeholder="Search by phone or name" value={filter} onChange={(e) => setFilter(e.target.value)} />
        </CardHeader>
        <CardContent>
          <div className="space-y-1">
            {filtered.map((r) => (
              <div key={r.id} className="flex items-center gap-3 border rounded-md p-3">
                <div className="flex-1 min-w-0">
                  <div className="font-medium truncate">{r.name || r.phone}</div>
                  <div className="text-xs text-muted-foreground font-mono">{r.phone}</div>
                </div>
                <Badge variant="outline" className="text-[10px] uppercase">
                  {r.source}
                </Badge>
                <Badge
                  variant={r.status === "subscribed" ? "default" : "secondary"}
                  className="text-[10px] uppercase"
                >
                  {r.status}
                </Badge>
                <a href={waLink(r.phone)} target="_blank" rel="noreferrer">
                  <Button size="sm" variant="ghost" title="Open chat on your phone">
                    <MessageCircle className="w-4 h-4" />
                  </Button>
                </a>
                <Button size="sm" variant="ghost" onClick={() => del(r.id)}>
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            ))}
            {filtered.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-8">No contacts yet.</p>
            )}
          </div>
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add WhatsApp contact</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Phone (with country code)</Label>
              <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+971501234567" />
            </div>
            <div>
              <Label>Name (optional)</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button onClick={add}>Add</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={importOpen} onOpenChange={setImportOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Import contacts (CSV)</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground">One per line: <code>phone,name</code></p>
            <textarea
              className="w-full h-40 border rounded p-2 text-sm font-mono"
              value={csv}
              onChange={(e) => setCsv(e.target.value)}
              placeholder="+971501234567,Ahmed&#10;+971507654321,Sara"
            />
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setImportOpen(false)}>
                Cancel
              </Button>
              <Button onClick={importCsv}>Import</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
