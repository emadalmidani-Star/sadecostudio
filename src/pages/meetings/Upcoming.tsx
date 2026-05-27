import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle2, XCircle, RotateCcw, Video } from "lucide-react";
import { toast } from "@/hooks/use-toast";

type Meeting = { id: string; client_name: string; scheduled_at: string; duration_minutes: number; status: string; source: string; note: string | null; meeting_url: string | null };

export default function MeetingsUpcoming() {
  const { user } = useAuth();
  const [items, setItems] = useState<Meeting[]>([]);
  const channelRef = useRef<any>(null);

  async function load() {
    if (!user) return;
    const start = new Date(); start.setHours(0, 0, 0, 0);
    const end = new Date(start); end.setDate(start.getDate() + 14);
    const { data } = await supabase.from("meetings").select("*").eq("user_id", user.id)
      .gte("scheduled_at", start.toISOString()).lt("scheduled_at", end.toISOString())
      .order("scheduled_at");
    setItems((data || []) as any);
  }
  useEffect(() => { load(); }, [user?.id]);

  useEffect(() => {
    if (!user) return;
    const ch = supabase.channel(`upcoming-${user.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "meetings", filter: `user_id=eq.${user.id}` }, (payload) => {
        if (payload.eventType === "INSERT") {
          const row = payload.new as any;
          toast({ title: "New booking", description: `${row.client_name} · ${new Date(row.scheduled_at).toLocaleString()}` });
          setItems((p) => [...p, row].sort((a, b) => +new Date(a.scheduled_at) - +new Date(b.scheduled_at)));
        } else if (payload.eventType === "UPDATE") {
          setItems((p) => p.map((m) => m.id === (payload.new as any).id ? { ...m, ...(payload.new as any) } : m));
        } else if (payload.eventType === "DELETE") {
          setItems((p) => p.filter((m) => m.id !== (payload.old as any).id));
        }
      }).subscribe();
    channelRef.current = ch;
    return () => { supabase.removeChannel(ch); };
  }, [user?.id]);

  async function setStatus(id: string, status: "completed" | "cancelled" | "upcoming") {
    const { error } = await supabase.from("meetings").update({ status }).eq("id", id);
    if (error) toast({ title: "Error", description: error.message, variant: "destructive" });
  }

  const days: { date: Date; items: Meeting[] }[] = [];
  const today = new Date(); today.setHours(0, 0, 0, 0);
  for (let i = 0; i < 14; i++) {
    const d = new Date(today); d.setDate(today.getDate() + i);
    const dayEnd = new Date(d); dayEnd.setDate(d.getDate() + 1);
    days.push({ date: d, items: items.filter((m) => {
      const t = new Date(m.scheduled_at).getTime();
      return t >= d.getTime() && t < dayEnd.getTime();
    }) });
  }

  return (
    <div className="p-6 space-y-6 max-w-6xl">
      <div>
        <h1 className="font-serif text-3xl">Upcoming</h1>
        <p className="text-sm text-muted-foreground">All meetings for this week and next. Gold = Scheduled, Green = Drop-In. Updates live.</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-7 gap-3">
        {days.slice(0, 7).map(({ date, items }) => <DayCard key={date.toISOString()} date={date} items={items} setStatus={setStatus} />)}
      </div>
      <div className="text-xs uppercase tracking-widest text-muted-foreground pt-4">Next week</div>
      <div className="grid grid-cols-2 md:grid-cols-7 gap-3">
        {days.slice(7).map(({ date, items }) => <DayCard key={date.toISOString()} date={date} items={items} setStatus={setStatus} />)}
      </div>
    </div>
  );
}

function DayCard({ date, items, setStatus }: { date: Date; items: Meeting[]; setStatus: (id: string, s: "completed" | "cancelled" | "upcoming") => void }) {
  const isToday = new Date().toDateString() === date.toDateString();
  return (
    <Card className={isToday ? "border-accent" : ""}>
      <CardHeader className="p-3 pb-1">
        <CardTitle className="text-xs uppercase tracking-wide text-muted-foreground">
          {date.toLocaleDateString(undefined, { weekday: "short" })}
        </CardTitle>
        <div className="text-lg font-serif">{date.getDate()}</div>
      </CardHeader>
      <CardContent className="p-3 pt-1 space-y-2">
        {items.length === 0 && <div className="text-[10px] text-muted-foreground">—</div>}
        {items.map((m) => {
          const color = m.status === "cancelled" ? "border-l-muted-foreground/40 opacity-50"
            : m.status === "completed" ? "border-l-green-600/60"
            : m.source === "dropin" ? "border-l-green-500"
            : "border-l-accent";
          return (
            <div key={m.id} className={`text-xs border-l-2 ${color} pl-2 py-1`}>
              <div className="font-medium truncate">{m.client_name}</div>
              <div className="text-[10px] text-muted-foreground">{new Date(m.scheduled_at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}</div>
              {m.meeting_url && m.status === "upcoming" && (
                <a href={m.meeting_url} target="_blank" rel="noreferrer" className="text-[10px] text-accent hover:underline inline-flex items-center gap-0.5">
                  <Video className="w-2.5 h-2.5" /> Join
                </a>
              )}
              <div className="flex gap-1 mt-1">
                {m.status === "upcoming" ? (
                  <>
                    <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => setStatus(m.id, "completed")} title="Complete"><CheckCircle2 className="w-3 h-3" /></Button>
                    <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => setStatus(m.id, "cancelled")} title="Cancel"><XCircle className="w-3 h-3" /></Button>
                  </>
                ) : (
                  <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => setStatus(m.id, "upcoming")} title="Reopen"><RotateCcw className="w-3 h-3" /></Button>
                )}
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
