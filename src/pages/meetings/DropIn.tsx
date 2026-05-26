import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "@/hooks/use-toast";
import { Copy, PhoneCall, X, MessageCircle } from "lucide-react";
import { randomToken } from "@/lib/meetings";

type Req = { id: string; client_name: string; message: string | null; status: string; created_at: string };

export default function MeetingsDropIn() {
  const { user } = useAuth();
  const [token, setToken] = useState<{ token: string } | null>(null);
  const [reqs, setReqs] = useState<Req[]>([]);
  const [waModal, setWaModal] = useState<Req | null>(null);
  const [whatsapp, setWhatsapp] = useState<string>("");

  async function load() {
    if (!user) return;
    const [t, r, p] = await Promise.all([
      supabase.from("dropin_tokens").select("token").eq("user_id", user.id).eq("active", true).limit(1).maybeSingle(),
      supabase.from("dropin_requests").select("*").eq("user_id", user.id).order("created_at", { ascending: false }).limit(50),
      supabase.from("profiles").select("whatsapp").eq("id", user.id).maybeSingle(),
    ]);
    setToken((t.data as any) || null);
    setReqs((r.data || []) as any);
    setWhatsapp(p.data?.whatsapp || "");
  }
  useEffect(() => { load(); }, [user?.id]);

  useEffect(() => {
    if (!token && user) {
      supabase.from("dropin_tokens").insert({ user_id: user.id, token: randomToken(), label: "Drop-in link", active: true })
        .select().maybeSingle().then(({ data }) => setToken(data as any));
    }
  }, [user?.id, token]);

  useEffect(() => {
    if (!user?.id) return;
    const ch = supabase.channel(`dropin-${user.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "dropin_requests", filter: `user_id=eq.${user.id}` },
        (payload) => {
          if (payload.eventType === "INSERT") {
            const row: any = payload.new;
            setReqs((prev) => [row, ...prev]);
            toast({ title: "New drop-in request", description: `${row.client_name}` });
          } else if (payload.eventType === "UPDATE") {
            setReqs((prev) => prev.map((r) => r.id === (payload.new as any).id ? (payload.new as any) : r));
          }
        })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user?.id]);

  const link = token ? `${window.location.origin}/dropin/${token.token}` : "";

  async function decide(r: Req, decision: "accepted" | "declined") {
    await supabase.from("dropin_requests").update({ status: decision }).eq("id", r.id);
    if (decision === "accepted") setWaModal(r);
  }

  return (
    <div className="p-6 space-y-6 max-w-5xl">
      <div>
        <h1 className="font-serif text-3xl">Drop-In</h1>
        <p className="text-sm text-muted-foreground">Share a link so clients can request a quick call. Requests appear here in real time.</p>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-lg">Your drop-in link</CardTitle></CardHeader>
        <CardContent className="flex gap-2">
          <Input readOnly value={link} className="font-mono text-xs" />
          <Button onClick={() => { navigator.clipboard.writeText(link); toast({ title: "Copied" }); }}>
            <Copy className="w-4 h-4 mr-2" />Copy
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-lg">Requests</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {reqs.length === 0 && <p className="text-sm text-muted-foreground">No drop-in requests yet.</p>}
          {reqs.map((r) => {
            const color = r.status === "pending" ? "bg-accent/15 text-accent border-accent/40"
              : r.status === "accepted" ? "bg-green-500/15 text-green-600 border-green-500/40"
              : "bg-muted text-muted-foreground border-border";
            return (
              <div key={r.id} className="flex items-center gap-3 border rounded-md p-3">
                <div className="flex-1 min-w-0">
                  <div className="font-medium">{r.client_name}</div>
                  <div className="text-xs text-muted-foreground">{new Date(r.created_at).toLocaleString()}</div>
                  {r.message && <div className="text-sm mt-1">{r.message}</div>}
                </div>
                <span className={`text-[10px] uppercase tracking-wide border rounded px-2 py-0.5 ${color}`}>{r.status}</span>
                {r.status === "pending" && (
                  <>
                    <Button size="sm" onClick={() => decide(r, "accepted")}><PhoneCall className="w-4 h-4 mr-1" />Accept</Button>
                    <Button size="sm" variant="ghost" onClick={() => decide(r, "declined")}><X className="w-4 h-4 mr-1" />Decline</Button>
                  </>
                )}
              </div>
            );
          })}
        </CardContent>
      </Card>

      {waModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={() => setWaModal(null)}>
          <Card className="max-w-md w-full" onClick={(e) => e.stopPropagation()}>
            <CardHeader><CardTitle className="text-lg">Connect via WhatsApp</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {whatsapp ? (
                <>
                  <p className="text-sm text-muted-foreground">Your WhatsApp number to share with {waModal.client_name}:</p>
                  <div className="flex items-center gap-2 p-3 bg-muted rounded font-mono">{whatsapp}</div>
                  <a href={`https://wa.me/${whatsapp.replace(/\D/g, "")}`} target="_blank" rel="noreferrer">
                    <Button className="w-full"><MessageCircle className="w-4 h-4 mr-2" />Open WhatsApp</Button>
                  </a>
                </>
              ) : (
                <p className="text-sm">No WhatsApp number set on your profile. Add one in <a href="/me" className="text-accent underline">My Profile</a>.</p>
              )}
              <Button variant="ghost" className="w-full" onClick={() => setWaModal(null)}>Close</Button>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
