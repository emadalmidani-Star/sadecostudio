import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "@/hooks/use-toast";
import { Plus, Share2, Trash2, Copy, X, Pencil } from "lucide-react";
import { randomToken } from "@/lib/meetings";

type ActionItem = { text: string; done: boolean; assignee?: string };
type Note = {
  id: string; title: string; meeting_date: string | null; project_id: string | null;
  attendees: string[]; summary: string | null; action_items: ActionItem[]; share_token: string | null;
};
type Project = { id: string; name: string };

const empty: Note = { id: "", title: "", meeting_date: null, project_id: null, attendees: [], summary: "", action_items: [], share_token: null };

export default function MeetingsNotes() {
  const { user } = useAuth();
  const [notes, setNotes] = useState<Note[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [editing, setEditing] = useState<Note | null>(null);
  const [attendeeInput, setAttendeeInput] = useState("");

  async function load() {
    if (!user) return;
    const [n, p] = await Promise.all([
      supabase.from("meeting_notes").select("*").eq("user_id", user.id).order("meeting_date", { ascending: false, nullsFirst: false }),
      supabase.from("projects").select("id, name").order("name"),
    ]);
    setNotes(((n.data || []) as any).map((x: any) => ({ ...x, attendees: x.attendees || [], action_items: x.action_items || [] })));
    setProjects((p.data || []) as any);
  }
  useEffect(() => { load(); }, [user?.id]);

  function startNew() { setEditing({ ...empty }); setAttendeeInput(""); }
  function startEdit(n: Note) { setEditing({ ...n }); setAttendeeInput(""); }

  async function save() {
    if (!editing || !user) return;
    if (!editing.title.trim()) { toast({ title: "Title required", variant: "destructive" }); return; }
    const payload = {
      user_id: user.id,
      title: editing.title.trim(),
      meeting_date: editing.meeting_date || null,
      project_id: editing.project_id || null,
      attendees: editing.attendees,
      summary: editing.summary,
      action_items: editing.action_items,
    };
    const q = editing.id
      ? supabase.from("meeting_notes").update(payload).eq("id", editing.id)
      : supabase.from("meeting_notes").insert(payload);
    const { error } = await q;
    if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); return; }
    setEditing(null); load();
  }

  async function del(id: string) {
    if (!confirm("Delete this note?")) return;
    await supabase.from("meeting_notes").delete().eq("id", id); load();
  }

  async function toggleShare(n: Note) {
    if (n.share_token) {
      const url = `${window.location.origin}/notes/${n.share_token}`;
      navigator.clipboard.writeText(url);
      toast({ title: "Link copied", description: url });
      return;
    }
    const token = randomToken();
    await supabase.from("meeting_notes").update({ share_token: token }).eq("id", n.id);
    const url = `${window.location.origin}/notes/${token}`;
    navigator.clipboard.writeText(url);
    toast({ title: "Share link created & copied", description: url });
    load();
  }

  function updEdit<K extends keyof Note>(k: K, v: Note[K]) { setEditing((e) => e ? { ...e, [k]: v } : e); }

  return (
    <div className="p-6 space-y-6 max-w-6xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-serif text-3xl">Meeting Notes</h1>
          <p className="text-sm text-muted-foreground">Capture summaries and action items per meeting.</p>
        </div>
        <Button onClick={startNew}><Plus className="w-4 h-4 mr-1" />New note</Button>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        {notes.length === 0 && <p className="text-sm text-muted-foreground">No notes yet.</p>}
        {notes.map((n) => {
          const proj = projects.find((p) => p.id === n.project_id);
          const done = n.action_items.filter((a) => a.done).length;
          return (
            <Card key={n.id}>
              <CardHeader>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <CardTitle className="text-base truncate">{n.title}</CardTitle>
                    <p className="text-xs text-muted-foreground">
                      {n.meeting_date ? new Date(n.meeting_date).toLocaleDateString() : "—"}
                      {proj ? ` · ${proj.name}` : ""}
                    </p>
                  </div>
                  <div className="flex gap-1">
                    <Button size="icon" variant="ghost" onClick={() => startEdit(n)}><Pencil className="w-4 h-4" /></Button>
                    <Button size="icon" variant="ghost" onClick={() => del(n.id)}><Trash2 className="w-4 h-4" /></Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-2">
                {n.attendees.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {n.attendees.map((a, i) => <span key={i} className="text-[10px] px-2 py-0.5 bg-muted rounded">{a}</span>)}
                  </div>
                )}
                {n.summary && <p className="text-sm line-clamp-3">{n.summary}</p>}
                {n.action_items.length > 0 && (
                  <div className="text-xs text-muted-foreground">{done}/{n.action_items.length} action items done</div>
                )}
                <Button size="sm" variant="outline" className="w-full" onClick={() => toggleShare(n)}>
                  <Share2 className="w-4 h-4 mr-1" />{n.share_token ? "Copy share link" : "Create share link"}
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Dialog open={!!editing} onOpenChange={(v) => !v && setEditing(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editing?.id ? "Edit note" : "New note"}</DialogTitle></DialogHeader>
          {editing && (
            <div className="space-y-3">
              <div><Label>Title *</Label><Input value={editing.title} onChange={(e) => updEdit("title", e.target.value)} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Date</Label><Input type="date" value={editing.meeting_date || ""} onChange={(e) => updEdit("meeting_date", e.target.value || null)} /></div>
                <div>
                  <Label>Project</Label>
                  <select value={editing.project_id || ""} onChange={(e) => updEdit("project_id", e.target.value || null)}
                    className="w-full h-10 border rounded px-2 bg-background">
                    <option value="">— None —</option>
                    {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <Label>Attendees</Label>
                <div className="flex gap-2">
                  <Input value={attendeeInput} onChange={(e) => setAttendeeInput(e.target.value)}
                    placeholder="Add attendee and press Enter"
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && attendeeInput.trim()) {
                        e.preventDefault();
                        updEdit("attendees", [...editing.attendees, attendeeInput.trim()]);
                        setAttendeeInput("");
                      }
                    }} />
                </div>
                <div className="flex flex-wrap gap-1 mt-2">
                  {editing.attendees.map((a, i) => (
                    <span key={i} className="text-xs px-2 py-1 bg-muted rounded flex items-center gap-1">
                      {a}
                      <button onClick={() => updEdit("attendees", editing.attendees.filter((_, j) => j !== i))}><X className="w-3 h-3" /></button>
                    </span>
                  ))}
                </div>
              </div>
              <div><Label>Summary</Label><Textarea rows={4} value={editing.summary || ""} onChange={(e) => updEdit("summary", e.target.value)} /></div>
              <div>
                <div className="flex items-center justify-between mb-1">
                  <Label>Action items</Label>
                  <Button size="sm" variant="ghost" onClick={() => updEdit("action_items", [...editing.action_items, { text: "", done: false, assignee: "" }])}>
                    <Plus className="w-3 h-3 mr-1" />Add
                  </Button>
                </div>
                <div className="space-y-2">
                  {editing.action_items.map((ai, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <Checkbox checked={ai.done} onCheckedChange={(v) => {
                        const next = [...editing.action_items]; next[i] = { ...ai, done: !!v }; updEdit("action_items", next);
                      }} />
                      <Input className="flex-1" placeholder="Task" value={ai.text} onChange={(e) => {
                        const next = [...editing.action_items]; next[i] = { ...ai, text: e.target.value }; updEdit("action_items", next);
                      }} />
                      <Input className="w-40" placeholder="Assignee" value={ai.assignee || ""} onChange={(e) => {
                        const next = [...editing.action_items]; next[i] = { ...ai, assignee: e.target.value }; updEdit("action_items", next);
                      }} />
                      <Button size="icon" variant="ghost" onClick={() => updEdit("action_items", editing.action_items.filter((_, j) => j !== i))}><Trash2 className="w-4 h-4" /></Button>
                    </div>
                  ))}
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button variant="ghost" onClick={() => setEditing(null)}>Cancel</Button>
                <Button onClick={save}>Save</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
