import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";
import { Copy, Plus, Trash2, CheckCircle2, XCircle } from "lucide-react";
import { WEEKDAYS, randomToken } from "@/lib/meetings";

type Avail = { id: string; weekday: number; start_time: string; end_time: string; slot_minutes: number };
type Booking = { id: string; client_name: string; client_email: string | null; note: string | null; scheduled_at: string; duration_minutes: number; status: string; source: string };
type Token = { id: string; token: string; label: string | null; active: boolean };

export default function MeetingsScheduler() {
  const { user } = useAuth();
  const [avail, setAvail] = useState<Avail[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [token, setToken] = useState<Token | null>(null);

  async function load() {
    if (!user) return;
    const [a, b, t] = await Promise.all([
      supabase.from("meeting_availability").select("*").eq("user_id", user.id).order("weekday"),
      supabase.from("meetings").select("*").eq("user_id", user.id).eq("source", "scheduled").order("scheduled_at", { ascending: false }),
      supabase.from("meeting_booking_tokens").select("*").eq("user_id", user.id).eq("active", true).limit(1).maybeSingle(),
    ]);
    setAvail((a.data || []) as any);
    setBookings((b.data || []) as any);
    setToken((t.data || null) as any);
  }
  useEffect(() => { load(); }, [user?.id]);

  async function addRow() {
    if (!user) return;
    const { error } = await supabase.from("meeting_availability").insert({
      user_id: user.id, weekday: 1, start_time: "09:00", end_time: "17:00", slot_minutes: 30,
    });
    if (error) toast({ title: "Error", description: error.message, variant: "destructive" }); else load();
  }
  async function updateRow(id: string, patch: Partial<Avail>) {
    const { error } = await supabase.from("meeting_availability").update(patch).eq("id", id);
    if (error) toast({ title: "Error", description: error.message, variant: "destructive" }); else load();
  }
  async function delRow(id: string) {
    await supabase.from("meeting_availability").delete().eq("id", id); load();
  }

  async function ensureToken() {
    if (!user) return;
    if (token) return;
    const { data, error } = await supabase.from("meeting_booking_tokens").insert({
      user_id: user.id, token: randomToken(), label: "Booking link", active: true,
    }).select().maybeSingle();
    if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); return; }
    setToken(data as any);
  }
  useEffect(() => { if (user && !token) ensureToken(); }, [user?.id]);

  const link = token ? `${window.location.origin}/book/${token.token}` : "";

  async function setStatus(id: string, status: "completed" | "cancelled" | "upcoming") {
    await supabase.from("meetings").update({ status }).eq("id", id); load();
  }

  return (
    <div className="p-6 space-y-6 max-w-6xl">
      <div>
        <h1 className="font-serif text-3xl">Scheduler</h1>
        <p className="text-sm text-muted-foreground">Set your weekly availability and share your booking link.</p>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-lg">Your booking link</CardTitle></CardHeader>
        <CardContent className="flex gap-2">
          <Input readOnly value={link} className="font-mono text-xs" />
          <Button onClick={() => { navigator.clipboard.writeText(link); toast({ title: "Copied" }); }}>
            <Copy className="w-4 h-4 mr-2" />Copy
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-lg">Weekly availability</CardTitle>
          <Button size="sm" onClick={addRow}><Plus className="w-4 h-4 mr-1" />Add slot</Button>
        </CardHeader>
        <CardContent className="space-y-2">
          {avail.length === 0 && <p className="text-sm text-muted-foreground">No availability set. Add at least one slot to receive bookings.</p>}
          {avail.map((r) => (
            <div key={r.id} className="grid grid-cols-12 gap-2 items-end">
              <div className="col-span-3">
                <Label className="text-xs">Day</Label>
                <select value={r.weekday} onChange={(e) => updateRow(r.id, { weekday: +e.target.value })}
                  className="w-full h-10 border rounded px-2 bg-background">
                  {WEEKDAYS.map((d, i) => <option key={i} value={i}>{d}</option>)}
                </select>
              </div>
              <div className="col-span-3"><Label className="text-xs">Start</Label><Input type="time" value={r.start_time?.slice(0,5)} onChange={(e) => updateRow(r.id, { start_time: e.target.value })} /></div>
              <div className="col-span-3"><Label className="text-xs">End</Label><Input type="time" value={r.end_time?.slice(0,5)} onChange={(e) => updateRow(r.id, { end_time: e.target.value })} /></div>
              <div className="col-span-2"><Label className="text-xs">Slot (min)</Label><Input type="number" min={5} max={240} value={r.slot_minutes} onChange={(e) => updateRow(r.id, { slot_minutes: +e.target.value })} /></div>
              <div className="col-span-1"><Button variant="ghost" size="icon" onClick={() => delRow(r.id)}><Trash2 className="w-4 h-4" /></Button></div>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-lg">Bookings</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {bookings.length === 0 && <p className="text-sm text-muted-foreground">No bookings yet.</p>}
          {bookings.map((b) => {
            const color = b.status === "upcoming" ? "bg-accent/15 text-accent border-accent/40"
              : b.status === "completed" ? "bg-green-500/15 text-green-600 border-green-500/40"
              : "bg-muted text-muted-foreground border-border";
            return (
              <div key={b.id} className="flex items-center gap-3 border rounded-md p-3">
                <div className="flex-1 min-w-0">
                  <div className="font-medium">{b.client_name} <span className="text-xs text-muted-foreground">· {b.client_email || "—"}</span></div>
                  <div className="text-xs text-muted-foreground">{new Date(b.scheduled_at).toLocaleString()} · {b.duration_minutes} min</div>
                  {b.note && <div className="text-sm mt-1">{b.note}</div>}
                </div>
                <span className={`text-[10px] uppercase tracking-wide border rounded px-2 py-0.5 ${color}`}>{b.status}</span>
                {b.status === "upcoming" && (
                  <>
                    <Button size="sm" variant="outline" onClick={() => setStatus(b.id, "completed")}><CheckCircle2 className="w-4 h-4 mr-1" />Complete</Button>
                    <Button size="sm" variant="ghost" onClick={() => setStatus(b.id, "cancelled")}><XCircle className="w-4 h-4 mr-1" />Cancel</Button>
                  </>
                )}
              </div>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
}
