import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Linkedin, Loader2, CheckCircle2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";

type LinkedInConn = {
  name: string | null;
  email: string | null;
  picture: string | null;
  expires_at: string | null;
  scope: string | null;
  updated_at: string;
};

export default function MarketingConnections() {
  const { user } = useAuth();
  const [conn, setConn] = useState<LinkedInConn | null>(null);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);

  async function load() {
    if (!user) return;
    setLoading(true);
    const { data } = await supabase
      .from("linkedin_connections")
      .select("name,email,picture,expires_at,scope,updated_at")
      .eq("user_id", user.id)
      .maybeSingle();
    setConn((data as LinkedInConn) ?? null);
    setLoading(false);
  }

  useEffect(() => { load(); }, [user?.id]);

  useEffect(() => {
    function onMsg(e: MessageEvent) {
      if (e.data?.type === "linkedin-oauth") {
        setConnecting(false);
        if (e.data.ok) {
          toast({ title: "LinkedIn connected" });
          load();
        } else {
          toast({ title: "LinkedIn connection failed", variant: "destructive" });
        }
      }
    }
    window.addEventListener("message", onMsg);
    return () => window.removeEventListener("message", onMsg);
  }, []);

  async function connect() {
    setConnecting(true);
    const { data, error } = await supabase.functions.invoke("linkedin-oauth-start");
    if (error || !data?.url) {
      setConnecting(false);
      toast({ title: "Could not start OAuth", description: error?.message, variant: "destructive" });
      return;
    }
    window.open(data.url, "linkedin-oauth", "width=600,height=720");
  }

  async function disconnect() {
    if (!user) return;
    await supabase.from("linkedin_connections").delete().eq("user_id", user.id);
    setConn(null);
    toast({ title: "LinkedIn disconnected" });
  }

  return (
    <div className="p-8 max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="font-serif text-4xl">Connections</h1>
        <p className="text-muted-foreground mt-1">Connect your LinkedIn, Facebook & Instagram accounts.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Linkedin className="w-5 h-5 text-accent" /> LinkedIn
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {loading ? (
            <div className="text-sm text-muted-foreground flex items-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin" /> Loading…
            </div>
          ) : conn ? (
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                {conn.picture ? (
                  <img src={conn.picture} alt="" className="w-10 h-10 rounded-full object-cover" />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-muted" />
                )}
                <div>
                  <div className="font-medium flex items-center gap-2">
                    {conn.name || conn.email || "LinkedIn member"}
                    <CheckCircle2 className="w-4 h-4 text-green-600" />
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {conn.email}
                    {conn.expires_at && (
                      <> · expires {new Date(conn.expires_at).toLocaleDateString()}</>
                    )}
                  </div>
                </div>
              </div>
              <Button variant="outline" onClick={disconnect}>Disconnect</Button>
            </div>
          ) : (
            <div className="flex items-center justify-between gap-4">
              <p className="text-sm text-muted-foreground">
                Connect your LinkedIn account to publish posts from the Scheduler.
              </p>
              <Button onClick={connect} disabled={connecting}>
                {connecting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Linkedin className="w-4 h-4 mr-2" />}
                Connect LinkedIn
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Meta (Facebook & Instagram)</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Coming next — provide Meta app credentials to enable.
        </CardContent>
      </Card>
    </div>
  );
}
