import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { CheckCircle2, Loader2 } from "lucide-react";
import { fnUrl } from "@/lib/meetings";

type Slot = { iso: string; label: string };

export default function PublicBookMeeting() {
  const { token } = useParams();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<{ designer: string; company: string; logo_url: string | null; slots: Slot[] }>({ designer: "", company: "", logo_url: null, slots: [] });
  const [selected, setSelected] = useState<string>("");
  const [form, setForm] = useState({ name: "", email: "", note: "" });
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`${fnUrl("booking-availability")}?token=${encodeURIComponent(token || "")}`);
        const data = await res.json();
        if (!res.ok || data?.error) throw new Error(data?.error || "Failed");
        setInfo(data);
      } catch (e: any) { setError(e.message); }
      finally { setLoading(false); }
    })();
  }, [token]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!selected || !form.name.trim()) { setError("Pick a slot and enter your name."); return; }
    setSubmitting(true); setError(null);
    try {
      const res = await fetch(fnUrl("booking-create"), {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, slot_iso: selected, client_name: form.name.trim(), client_email: form.email.trim() || undefined, note: form.note.trim() || undefined }),
      });
      const data = await res.json();
      if (!res.ok || data?.error) throw new Error(data?.error || "Failed");
      setDone(true);
    } catch (e: any) { setError(e.message); }
    finally { setSubmitting(false); }
  }

  // Group slots by date
  const byDay: Record<string, Slot[]> = {};
  for (const s of info.slots) {
    const d = new Date(s.iso).toDateString();
    (byDay[d] = byDay[d] || []).push(s);
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
            <div className="text-center py-8 space-y-3">
              <CheckCircle2 className="w-12 h-12 text-green-600 mx-auto" />
              <p className="font-medium">Your meeting is booked.</p>
              <p className="text-sm text-muted-foreground">{new Date(selected).toLocaleString()}</p>
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
