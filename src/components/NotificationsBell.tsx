import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Bell, Inbox, Trophy, XCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Notif = {
  id: string;
  kind: "new_lead" | "lead_won" | "lead_lost";
  title: string;
  body: string;
  lead_id: string;
  at: string;
  read: boolean;
};

const LS_KEY = "sadeco.notifications.v1";
const MAX = 30;

function load(): Notif[] {
  try { return JSON.parse(localStorage.getItem(LS_KEY) || "[]"); } catch { return []; }
}
function save(items: Notif[]) {
  localStorage.setItem(LS_KEY, JSON.stringify(items.slice(0, MAX)));
}

export default function NotificationsBell({ collapsed }: { collapsed?: boolean }) {
  const { user } = useAuth();
  const [items, setItems] = useState<Notif[]>(() => load());
  const [open, setOpen] = useState(false);

  const unread = items.filter((n) => !n.read).length;

  useEffect(() => {
    if (!user?.id) return;
    const ch = supabase
      .channel(`leads-notify-${user.id}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "leads", filter: `user_id=eq.${user.id}` }, (payload) => {
        const row: any = payload.new;
        const n: Notif = {
          id: `${row.id}-new`,
          kind: "new_lead",
          title: "New lead",
          body: `${row.name}${row.company ? " — " + row.company : ""} (${row.source})`,
          lead_id: row.id,
          at: new Date().toISOString(),
          read: false,
        };
        setItems((prev) => { const next = [n, ...prev.filter((p) => p.id !== n.id)]; save(next); return next; });
        toast({ title: n.title, description: n.body });
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "leads", filter: `user_id=eq.${user.id}` }, (payload) => {
        const row: any = payload.new;
        const old: any = payload.old;
        if (old?.stage === row.stage) return;
        if (row.stage !== "won" && row.stage !== "lost") return;
        const won = row.stage === "won";
        const n: Notif = {
          id: `${row.id}-${row.stage}-${Date.now()}`,
          kind: won ? "lead_won" : "lead_lost",
          title: won ? "Lead won 🎉" : "Lead lost",
          body: `${row.name}${row.company ? " — " + row.company : ""}`,
          lead_id: row.id,
          at: new Date().toISOString(),
          read: false,
        };
        setItems((prev) => { const next = [n, ...prev]; save(next); return next; });
        toast({ title: n.title, description: n.body });
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user?.id]);

  function markAllRead() {
    setItems((prev) => { const next = prev.map((n) => ({ ...n, read: true })); save(next); return next; });
  }
  function clearAll() {
    setItems([]); save([]);
  }

  const Icon = (k: Notif["kind"]) => k === "new_lead" ? Inbox : k === "lead_won" ? Trophy : XCircle;

  return (
    <Popover open={open} onOpenChange={(v) => { setOpen(v); if (v) markAllRead(); }}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="sm"
          className={cn(
            "relative w-full text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent",
            collapsed ? "justify-center" : "justify-start",
          )}
          aria-label="Notifications"
        >
          <Bell className="w-4 h-4" />
          {!collapsed && <span className="ml-2">Notifications</span>}
          {unread > 0 && (
            <span className="absolute top-1 right-2 min-w-[16px] h-4 px-1 rounded-full bg-accent text-[10px] font-semibold text-accent-foreground flex items-center justify-center">
              {unread > 9 ? "9+" : unread}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent side="right" align="end" className="w-80 p-0">
        <div className="flex items-center justify-between p-3 border-b">
          <div className="font-medium text-sm">Notifications</div>
          {items.length > 0 && (
            <button onClick={clearAll} className="text-xs text-muted-foreground hover:text-foreground">Clear</button>
          )}
        </div>
        <div className="max-h-96 overflow-y-auto">
          {items.length === 0 ? (
            <div className="p-6 text-center text-sm text-muted-foreground">You're all caught up.</div>
          ) : items.map((n) => {
            const I = Icon(n.kind);
            return (
              <Link key={n.id} to="/marketing/leads" onClick={() => setOpen(false)}
                className="flex gap-3 p-3 hover:bg-muted/50 border-b last:border-0">
                <I className={cn("w-4 h-4 mt-0.5 shrink-0",
                  n.kind === "new_lead" ? "text-accent" : n.kind === "lead_won" ? "text-green-600" : "text-destructive")} />
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium">{n.title}</div>
                  <div className="text-xs text-muted-foreground truncate">{n.body}</div>
                  <div className="text-[10px] text-muted-foreground mt-0.5">{new Date(n.at).toLocaleString()}</div>
                </div>
              </Link>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}
