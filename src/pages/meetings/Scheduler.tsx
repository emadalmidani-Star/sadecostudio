import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";
import { Copy, Plus, Trash2, CheckCircle2, XCircle, RotateCcw, Video, Info, ExternalLink } from "lucide-react";
import { WEEKDAYS, randomToken } from "@/lib/meetings";

type Avail = { id: string; weekday: number; start_time: string; end_time: string; slot_minutes: number };
type Booking = { id: string; client_name: string; client_email: string | null; note: string | null; scheduled_at: string; duration_minutes: number; status: string; source: string; meeting_url: string | null };
type Token = { id: string; token: string; label: string | null; active: boolean };
type Settings = { video_provider: string; custom_link_template: string | null };

const PROVIDERS: { id: string; label: string; hint: string }[] = [
  { id: "jitsi", label: "Jitsi Meet (instant, no setup)", hint: "Free, opens in browser. Best default." },
  { id: "google_meet", label: "Google Meet (new room link)", hint: "Opens a fresh Meet room when joined." },
  { id: "custom", label: "Custom link (Zoom, Teams, Whereby...)", hint: "Paste your personal room URL. Use {{id}} for a unique room id." },
  { id: "none", label: "No video link (in-person / phone)", hint: "Don't attach a call link." },
];

export default function MeetingsScheduler() {
  const { user } = useAuth();
  const [avail, setAvail] = useState<Avail[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [token, setToken] = useState<Token | null>(null);
  const [username, setUsername] = useState<string>("");
  const [savedUsername, setSavedUsername] = useState<string>("");
  const [settings, setSettings] = useState<Settings>({ video_provider: "jitsi", custom_link_template: null });
  const channelRef = useRef<any>(null);

  async function load() {
    if (!user) return;
    const [a, b, t, p, s] = await Promise.all([
      supabase.from("meeting_availability").select("*").eq("user_id", user.id).order("weekday"),
      supabase.from("meetings").select("*").eq("user_id", user.id).eq("source", "scheduled").order("scheduled_at", { ascending: false }),
      supabase.from("meeting_booking_tokens").select("*").eq("user_id", user.id).eq("active", true).limit(1).maybeSingle(),
      supabase.from("profiles").select("username").eq("id", user.id).maybeSingle(),
      supabase.from("meeting_settings").select("*").eq("user_id", user.id).maybeSingle(),
    ]);
    setAvail((a.data || []) as any);
    setBookings((b.data || []) as any);
    setToken((t.data || null) as any);
    setUsername(p.data?.username || ""); setSavedUsername(p.data?.username || "");
    if (s.data) setSettings({ video_provider: (s.data as any).video_provider, custom_link_template: (s.data as any).custom_link_template });
  }
  useEffect(() => { load(); }, [user?.id]);

  // Realtime subscription
  useEffect(() => {
    if (!user) return;
    const ch = supabase
      .channel(`meetings-${user.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "meetings", filter: `user_id=eq.${user.id}` }, (payload) => {
        setBookings((prev) => {
          if (payload.eventType === "INSERT") {
            const row = payload.new as any;
            if (row.source !== "scheduled") return prev;
            if (prev.find((p) => p.id === row.id)) return prev;
            toast({ title: "New booking", description: `${row.client_name} · ${new Date(row.scheduled_at).toLocaleString()}` });
            return [row, ...prev].sort((a, b) => +new Date(b.scheduled_at) - +new Date(a.scheduled_at));
          }
          if (payload.eventType === "UPDATE") {
            return prev.map((p) => (p.id === (payload.new as any).id ? { ...p, ...(payload.new as any) } : p));
          }
          if (payload.eventType === "DELETE") {
            return prev.filter((p) => p.id !== (payload.old as any).id);
          }
          return prev;
        });
      })
      .subscribe();
    channelRef.current = ch;
    return () => { supabase.removeChannel(ch); };
  }, [user?.id]);

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
    if (!user || token) return;
    const { data, error } = await supabase.from("meeting_booking_tokens").insert({
      user_id: user.id, token: randomToken(), label: "Booking link", active: true,
    }).select().maybeSingle();
    if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); return; }
    setToken(data as any);
  }
  useEffect(() => { if (user && !token) ensureToken(); }, [user?.id]);

  const usernameSlug = (savedUsername || "").trim().toLowerCase();
  const friendlyLink = usernameSlug ? `${window.location.origin}/u/${usernameSlug}` : "";
  const tokenLink = token ? `${window.location.origin}/book/${token.token}` : "";
  const primaryLink = friendlyLink || tokenLink;

  async function saveUsername() {
    if (!user) return;
    const v = username.trim().toLowerCase();
    if (v && !/^[a-z0-9][a-z0-9-]{1,30}$/.test(v)) {
      toast({ title: "Invalid", description: "Use 2–31 chars: lowercase letters, numbers, hyphens.", variant: "destructive" }); return;
    }
    const { error } = await supabase.from("profiles").update({ username: v || null }).eq("id", user.id);
    if (error) { toast({ title: "Could not save", description: error.message, variant: "destructive" }); return; }
    setSavedUsername(v); toast({ title: "Username saved" });
  }

  async function saveSettings(next: Settings) {
    if (!user) return;
    setSettings(next);
    const { error } = await supabase.from("meeting_settings").upsert({ user_id: user.id, ...next }, { onConflict: "user_id" });
    if (error) toast({ title: "Error", description: error.message, variant: "destructive" });
  }

  async function setStatus(id: string, status: "completed" | "cancelled" | "upcoming") {
    const { error } = await supabase.from("meetings").update({ status }).eq("id", id);
    if (error) toast({ title: "Error", description: error.message, variant: "destructive" });
  }

  return (
    <div className="p-6 space-y-6 max-w-6xl">
      <div>
        <h1 className="font-serif text-3xl">Scheduler</h1>
        <p className="text-sm text-muted-foreground">Set your availability, share your link, and manage bookings — updates live.</p>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-lg">Your booking link</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid md:grid-cols-[1fr_auto] gap-2 items-end">
            <div>
              <Label className="text-xs">Username (used in your shareable link)</Label>
              <div className="flex gap-2">
                <div className="flex items-center gap-1 border rounded-md pl-3 pr-1 w-full bg-background">
                  <span className="text-xs text-muted-foreground whitespace-nowrap">{window.location.origin}/u/</span>
                  <Input value={username} onChange={(e) => setUsername(e.target.value)} placeholder="your-name" className="border-0 px-1 focus-visible:ring-0" />
                </div>
                <Button onClick={saveUsername} disabled={username === savedUsername}>Save</Button>
              </div>
            </div>
          </div>

          <div>
            <Label className="text-xs">Share this link with clients</Label>
            <div className="flex gap-2">
              <Input readOnly value={primaryLink} className="font-mono text-xs" />
              <Button onClick={() => { navigator.clipboard.writeText(primaryLink); toast({ title: "Copied" }); }}>
                <Copy className="w-4 h-4 mr-2" />Copy
              </Button>
            </div>
            {friendlyLink && tokenLink && (
              <p className="text-[11px] text-muted-foreground mt-1">Fallback token link: <span className="font-mono">{tokenLink}</span></p>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-lg flex items-center gap-2"><Video className="w-4 h-4" /> Video call provider</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="grid sm:grid-cols-2 gap-2">
            {PROVIDERS.map((p) => (
              <button key={p.id} type="button" onClick={() => saveSettings({ ...settings, video_provider: p.id })}
                className={`text-left border rounded-md p-3 transition-colors ${settings.video_provider === p.id ? "border-accent bg-accent/10" : "hover:bg-muted/40"}`}>
                <div className="font-medium text-sm">{p.label}</div>
                <div className="text-xs text-muted-foreground mt-0.5">{p.hint}</div>
              </button>
            ))}
          </div>

          {settings.video_provider === "custom" && (
            <div>
              <Label className="text-xs">Custom link template</Label>
              <Input value={settings.custom_link_template || ""} onChange={(e) => setSettings({ ...settings, custom_link_template: e.target.value })}
                onBlur={() => saveSettings(settings)}
                placeholder="https://your-team.zoom.us/j/123456789  or  https://teams.microsoft.com/l/meetup-join/..." />
              <p className="text-[11px] text-muted-foreground mt-1">
                Tip: use <span className="font-mono">{`{{id}}`}</span> as a placeholder for a unique room id (e.g. <span className="font-mono">https://whereby.com/{`{{id}}`}</span>).
              </p>
            </div>
          )}

          <div className="text-xs text-muted-foreground flex gap-2 items-start bg-muted/40 rounded-md p-3">
            <Info className="w-3.5 h-3.5 mt-0.5 shrink-0" />
            <span>
              True API integration with Microsoft Teams or Zoom (auto-creating per-meeting calendar invites under your account) needs per-user OAuth setup.
              For now, the Custom option lets you reuse your personal Teams / Zoom / Whereby room link — every client gets it after booking, plus an iCal / Google Calendar add-to-calendar option.
            </span>
          </div>
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
              <div key={b.id} className="flex flex-wrap items-center gap-3 border rounded-md p-3">
                <div className="flex-1 min-w-[200px]">
                  <div className="font-medium">{b.client_name} <span className="text-xs text-muted-foreground">· {b.client_email || "—"}</span></div>
                  <div className="text-xs text-muted-foreground">{new Date(b.scheduled_at).toLocaleString()} · {b.duration_minutes} min</div>
                  {b.note && <div className="text-sm mt-1">{b.note}</div>}
                  {b.meeting_url && (
                    <a href={b.meeting_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs text-accent hover:underline mt-1">
                      <Video className="w-3 h-3" /> Join call <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                </div>
                <span className={`text-[10px] uppercase tracking-wide border rounded px-2 py-0.5 ${color}`}>{b.status}</span>
                {b.status === "upcoming" && (
                  <>
                    <Button size="sm" variant="outline" onClick={() => setStatus(b.id, "completed")}><CheckCircle2 className="w-4 h-4 mr-1" />Complete</Button>
                    <Button size="sm" variant="ghost" onClick={() => setStatus(b.id, "cancelled")}><XCircle className="w-4 h-4 mr-1" />Cancel</Button>
                  </>
                )}
                {b.status !== "upcoming" && (
                  <Button size="sm" variant="ghost" onClick={() => setStatus(b.id, "upcoming")}><RotateCcw className="w-4 h-4 mr-1" />Reopen</Button>
                )}
              </div>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
}
