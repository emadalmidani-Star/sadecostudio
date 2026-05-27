import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { CheckCircle2, Loader2, Calendar, Download, Video } from "lucide-react";
import { fnUrl, buildICS, downloadICS, googleCalendarUrl, outlookCalendarUrl } from "@/lib/meetings";

type Slot = { iso: string; label: string };

export default function PublicBookMeeting() {
  const { token, username } = useParams();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<{ designer: string; company: string; logo_url: string | null; slots: Slot[] }>({ designer: "", company: "", logo_url: null, slots: [] });
  const [selected, setSelected] = useState<string>("");
  const [form, setForm] = useState({ name: "", email: "", note: "" });
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState<null | { scheduled_at: string; duration_minutes: number; meeting_url: string | null }>(null);

  useEffect(() => {
    (async () => {
      try {
        const qs = token ? `token=${encodeURIComponent(token)}` : `username=${encodeURIComponent(username || "")}`;
        const res = await fetch(`${fnUrl("booking-availability")}?${qs}`);
        const data = await res.json();
        if (!res.ok || data?.error) throw new Error(data?.error || "Failed");
        setInfo(data);
      } catch (e: any) { setError(e.message); }
      finally { setLoading(false); }
    })();
  }, [token, username]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!selected || !form.name.trim()) { setError("Pick a slot and enter your name."); return; }
    setSubmitting(true); setError(null);
    try {
      const res = await fetch(fnUrl("booking-create"), {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token: token || undefined,
          username: username || undefined,
          slot_iso: selected,
          client_name: form.name.trim(),
          client_email: form.email.trim() || undefined,
          note: form.note.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok || data?.error) throw new Error(data?.error || "Failed");
      setDone(data.meeting);
    } catch (e: any) { setError(e.message); }
    finally { setSubmitting(false); }
  }

  const byDay: Record<string, Slot[]> = {};
  for (const s of info.slots) {
    const d = new Date(s.iso).toDateString();
    (byDay[d] = byDay[d] || []).push(s);
  }

  function calendarEvent() {
    if (!done) return null;
    const start = new Date(done.scheduled_at);
    const end = new Date(start.getTime() + done.duration_minutes * 60000);
    const title = `Meeting with ${info.designer || info.company || "Designer"}`;
    const description = [
      done.meeting_url ? `Join: ${done.meeting_url}` : "",
      form.note ? `Note: ${form.note}` : "",
    ].filter(Boolean).join("\n");
    return { title, description, location: done.meeting_url || undefined, start, end };
  }

  return (
    <div className="min-h-screen bg-background flex items-start justify-center p-4 py-10">
      <Card className="w-full max-w-2xl">
        <CardHeader className="text-center">
          {info.logo_url && <img src={info.logo_url} alt={info.company} className="h-12 mx-auto mb-3" />}
          <CardTitle className="font-serif text-3xl">Book a meeting</CardTitle>
          {info.designer && <p className="text-sm text-muted-foreground">with {info.designer}</p>}
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="py-12 text-center"><Loader2 className="w-6 h-6 animate-spin mx-auto" /></div>
          ) : done ? (
            <div className="text-center py-6 space-y-4">
              <CheckCircle2 className="w-12 h-12 text-green-600 mx-auto" />
              <div>
                <p className="font-medium text-lg">Your meeting is booked.</p>
                <p className="text-sm text-muted-foreground">{new Date(done.scheduled_at).toLocaleString()} · {done.duration_minutes} min</p>
              </div>

              {done.meeting_url && (
                <a href={done.meeting_url} target="_blank" rel="noreferrer"
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-accent text-accent-foreground hover:opacity-90 text-sm">
                  <Video className="w-4 h-4" /> Join video call
                </a>
              )}

              <div className="border-t pt-4 space-y-2">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Add to your calendar</p>
                <div className="flex flex-wrap gap-2 justify-center">
                  <Button variant="outline" size="sm" onClick={() => {
                    const e = calendarEvent(); if (!e) return;
                    downloadICS(`meeting-${new Date(e.start).toISOString().slice(0,10)}.ics`, buildICS(e));
                  }}>
                    <Download className="w-4 h-4 mr-1" /> Apple / iCal (.ics)
                  </Button>
                  <a href={(() => { const e = calendarEvent(); return e ? googleCalendarUrl(e) : "#"; })()} target="_blank" rel="noreferrer">
                    <Button variant="outline" size="sm" type="button"><Calendar className="w-4 h-4 mr-1" /> Google</Button>
                  </a>
                  <a href={(() => { const e = calendarEvent(); return e ? outlookCalendarUrl(e) : "#"; })()} target="_blank" rel="noreferrer">
                    <Button variant="outline" size="sm" type="button"><Calendar className="w-4 h-4 mr-1" /> Outlook</Button>
                  </a>
                </div>
              </div>
            </div>
          ) : (
            <form onSubmit={submit} className="space-y-4">
              <div>
                <Label>Pick a time</Label>
                <div className="space-y-3 max-h-72 overflow-y-auto border rounded p-3 mt-1">
                  {Object.keys(byDay).length === 0 && <p className="text-sm text-muted-foreground">No times available right now.</p>}
                  {Object.entries(byDay).map(([day, slots]) => (
                    <div key={day}>
                      <div className="text-xs uppercase tracking-wide text-muted-foreground mb-1">{day}</div>
                      <div className="flex flex-wrap gap-1">
                        {slots.map((s) => (
                          <button key={s.iso} type="button" onClick={() => setSelected(s.iso)}
                            className={`text-xs px-3 py-1.5 rounded border transition-colors ${selected === s.iso ? "bg-accent text-accent-foreground border-accent" : "hover:bg-muted"}`}>
                            {new Date(s.iso).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <div><Label>Your name *</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required maxLength={200} /></div>
              <div><Label>Email</Label><Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} maxLength={255} /></div>
              <div><Label>Note</Label><Textarea rows={3} value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} maxLength={2000} /></div>
              {error && <p className="text-sm text-destructive">{error}</p>}
              <Button type="submit" className="w-full" disabled={submitting || !selected}>{submitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}Confirm booking</Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
