import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle2, XCircle } from "lucide-react";

type Meeting = { id: string; client_name: string; scheduled_at: string; duration_minutes: number; status: string; source: string; note: string | null };

export default function MeetingsUpcoming() {
  const { user } = useAuth();
  const [items, setItems] = useState<Meeting[]>([]);

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

  async function setStatus(id: string, status: "completed" | "cancelled") {
    await supabase.from("meetings").update({ status }).eq("id", id); load();
  }

  // Group into days
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
        <p className="text-sm text-muted-foreground">All meetings for this week and next. Gold = Scheduled, Green = Drop-In.</p>
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

function DayCard({ date, items, setStatus }: { date: Date; items: Meeting[]; setStatus: (id: string, s: "completed" | "cancelled") => void }) {
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
            : m.source === "dropin" ? "border-l-green-500"
            : "border-l-accent";
          return (
            <div key={m.id} className={`text-xs border-l-2 ${color} pl-2 py-1`}>
              <div className="font-medium truncate">{m.client_name}</div>
              <div className="text-[10px] text-muted-foreground">{new Date(m.scheduled_at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}</div>
              {m.status === "upcoming" && (
                <div className="flex gap-1 mt-1">
                  <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => setStatus(m.id, "completed")} title="Complete"><CheckCircle2 className="w-3 h-3" /></Button>
                  <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => setStatus(m.id, "cancelled")} title="Cancel"><XCircle className="w-3 h-3" /></Button>
                </div>
              )}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
