import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/hooks/use-toast";
import { CheckCircle2, AlertCircle, MessageCircle } from "lucide-react";
import { waLink, cleanPhone } from "@/lib/whatsapp";

type Cfg = {
  user_id: string;
  display_phone: string | null;
  display_name: string | null;
  status: string;
};

export default function WhatsAppSender() {
  const { user } = useAuth();
  const [cfg, setCfg] = useState<Cfg | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testMsg, setTestMsg] = useState("Hi! Just testing my WhatsApp link.");

  async function load() {
    if (!user) return;
    setLoading(true);
    const { data } = await supabase
      .from("whatsapp_sender_config")
      .select("user_id, display_phone, display_name, status")
      .eq("user_id", user.id)
      .maybeSingle();
    let row = data as any as Cfg | null;
    if (!row) {
      const { data: created } = await supabase
        .from("whatsapp_sender_config")
        .insert({ user_id: user.id })
        .select("user_id, display_phone, display_name, status")
        .maybeSingle();
      row = created as any;
    }
    setCfg(row);
    setLoading(false);
  }
  useEffect(() => {
    load();
  }, [user?.id]);

  async function save() {
    if (!cfg) return;
    setSaving(true);
    const { error } = await supabase
      .from("whatsapp_sender_config")
      .update({
        display_phone: cfg.display_phone,
        display_name: cfg.display_name,
        status: cfg.display_phone ? "connected" : "disconnected",
      })
      .eq("user_id", cfg.user_id);
    setSaving(false);
    if (error) return toast({ title: "Save failed", description: error.message, variant: "destructive" });
    toast({ title: "Saved" });
    load();
  }

  if (loading || !cfg)
    return <div className="p-6 text-sm text-muted-foreground">Loading WhatsApp settings…</div>;

  const isConnected = cfg.status === "connected" && !!cfg.display_phone;
  const preview = cfg.display_phone ? waLink(cleanPhone(cfg.display_phone), testMsg) : "";

  return (
    <div className="p-6 space-y-6 max-w-3xl">
      <div>
        <h1 className="font-serif text-3xl">WhatsApp Sender</h1>
        <p className="text-sm text-muted-foreground">
          Set your WhatsApp number. Click-to-chat links open WhatsApp on your phone or desktop so you message
          clients from your own number — no API token, no business verification required.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            Your number
            {isConnected ? (
              <span className="text-xs text-green-600 inline-flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" /> ready
              </span>
            ) : (
              <span className="text-xs text-muted-foreground inline-flex items-center gap-1">
                <AlertCircle className="w-3.5 h-3.5" /> not set
              </span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <Label>WhatsApp number (E.164)</Label>
              <Input
                value={cfg.display_phone || ""}
                onChange={(e) => setCfg({ ...cfg, display_phone: e.target.value })}
                placeholder="+971501234567"
              />
              <p className="text-[11px] text-muted-foreground mt-1">
                Include country code. Only you use this number — each team member sets their own.
              </p>
            </div>
            <div>
              <Label>Display name (optional)</Label>
              <Input
                value={cfg.display_name || ""}
                onChange={(e) => setCfg({ ...cfg, display_name: e.target.value })}
                placeholder="Your name or business"
              />
            </div>
          </div>
          <Button onClick={save} disabled={saving}>
            {saving ? "Saving…" : "Save"}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Test your link</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <Label>Test message</Label>
            <Textarea rows={2} value={testMsg} onChange={(e) => setTestMsg(e.target.value)} />
          </div>
          <Button asChild disabled={!preview}>
            <a href={preview || "#"} target="_blank" rel="noreferrer">
              <MessageCircle className="w-4 h-4 mr-1.5" /> Open WhatsApp
            </a>
          </Button>
          {preview && (
            <p className="text-[11px] text-muted-foreground break-all">{preview}</p>
          )}
        </CardContent>
      </Card>

      <Card className="border-dashed">
        <CardHeader>
          <CardTitle className="text-base">How sending works</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground space-y-2">
          <p>
            Lovable generates <code>wa.me</code> links pre-filled with the recipient and message. Clicking the
            button opens WhatsApp on your device, where you tap <strong>Send</strong> to deliver from your own
            number.
          </p>
          <p>
            This avoids Meta Cloud API setup, business verification, and per-message costs. Automated broadcasts
            and inbox sync require the official Business API and are disabled in this mode.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
