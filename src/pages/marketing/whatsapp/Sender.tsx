import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";
import { Copy, RefreshCw, CheckCircle2, AlertCircle, ExternalLink, BookOpen } from "lucide-react";

type Cfg = {
  user_id: string;
  phone_number_id: string | null;
  waba_id: string | null;
  display_phone: string | null;
  display_name: string | null;
  quality_rating: string | null;
  verify_token: string;
  status: string;
  access_token: string | null;
  last_synced_at: string | null;
};

const PROJECT_REF = (import.meta as any).env.VITE_SUPABASE_PROJECT_ID;
const WEBHOOK_URL = `https://${PROJECT_REF}.supabase.co/functions/v1/whatsapp-webhook`;

export default function WhatsAppSender() {
  const { user } = useAuth();
  const [cfg, setCfg] = useState<Cfg | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [tplCount, setTplCount] = useState(0);

  async function load() {
    if (!user) return;
    setLoading(true);
    const { data } = await supabase
      .from("whatsapp_sender_config")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle();
    let row = data as any as Cfg | null;
    if (!row) {
      const { data: created } = await supabase
        .from("whatsapp_sender_config")
        .insert({ user_id: user.id })
        .select()
        .maybeSingle();
      row = created as any;
    }
    setCfg(row);
    const { count } = await supabase
      .from("whatsapp_templates")
      .select("*", { count: "exact", head: true })
      .eq("user_id", user.id);
    setTplCount(count || 0);
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
        phone_number_id: cfg.phone_number_id,
        waba_id: cfg.waba_id,
        display_phone: cfg.display_phone,
        display_name: cfg.display_name,
        access_token: cfg.access_token,
        status: cfg.phone_number_id && cfg.waba_id && cfg.access_token ? "connected" : "disconnected",
      })
      .eq("user_id", cfg.user_id);
    setSaving(false);
    if (error) return toast({ title: "Save failed", description: error.message, variant: "destructive" });
    toast({ title: "Saved" });
    load();
  }

  async function sync() {
    setSyncing(true);
    const { data, error } = await supabase.functions.invoke("whatsapp-templates-sync", {});
    setSyncing(false);
    if (error || (data as any)?.error) {
      return toast({
        title: "Sync failed",
        description: error?.message || (data as any)?.error,
        variant: "destructive",
      });
    }
    toast({ title: `Synced ${(data as any).synced} templates` });
    load();
  }

  if (loading || !cfg)
    return <div className="p-6 text-sm text-muted-foreground">Loading WhatsApp settings…</div>;

  const isConnected = cfg.status === "connected";

  return (
    <div className="p-6 space-y-6 max-w-4xl">
      <div>
        <h1 className="font-serif text-3xl">WhatsApp Sender</h1>
        <p className="text-sm text-muted-foreground">
          Connect your verified WhatsApp Business number (Meta Cloud API) to send broadcasts and automated messages.
        </p>
      </div>

      <Card className="border-accent/30">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <BookOpen className="w-4 h-4 text-accent" /> Setup guide
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <ol className="list-decimal pl-5 space-y-2">
            <li>
              Go to{" "}
              <a className="text-accent underline" href="https://business.facebook.com" target="_blank" rel="noreferrer">
                Meta Business Suite <ExternalLink className="inline w-3 h-3" />
              </a>
              , create a Business and a Meta App (type: <strong>Business</strong>).
            </li>
            <li>
              Add the <strong>WhatsApp</strong> product, register your business phone number, and verify it.
            </li>
            <li>
              Create a <strong>System User</strong> in Business Settings → System Users → assign it to your app with{" "}
              <code>whatsapp_business_messaging</code> &amp; <code>whatsapp_business_management</code> permissions →
              generate a <strong>permanent access token</strong>.
            </li>
            <li>
              In <strong>App → WhatsApp → Configuration → Webhook</strong>, paste:
              <div className="flex items-center gap-2 mt-1">
                <Input readOnly value={WEBHOOK_URL} className="font-mono text-xs" />
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    navigator.clipboard.writeText(WEBHOOK_URL);
                    toast({ title: "Webhook URL copied" });
                  }}
                >
                  <Copy className="w-3 h-3" />
                </Button>
              </div>
              <div className="flex items-center gap-2 mt-1">
                <Input readOnly value={cfg.verify_token} className="font-mono text-xs" />
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    navigator.clipboard.writeText(cfg.verify_token);
                    toast({ title: "Verify token copied" });
                  }}
                >
                  <Copy className="w-3 h-3" />
                </Button>
              </div>
              Subscribe to <code>messages</code>, <code>message_template_status_update</code>, and{" "}
              <code>messages</code> events.
            </li>
            <li>
              Generate a <strong>permanent access token</strong> for that System User and paste it below — it's stored
              privately on your account and only your sender uses it.
            </li>
            <li>Paste your Phone Number ID and WhatsApp Business Account ID below and save.</li>
            <li>Click "Sync templates" to pull approved templates from Meta.</li>
          </ol>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            Connection
            {isConnected ? (
              <span className="text-xs text-green-600 inline-flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" /> connected
              </span>
            ) : (
              <span className="text-xs text-muted-foreground inline-flex items-center gap-1">
                <AlertCircle className="w-3.5 h-3.5" /> not configured
              </span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>Permanent access token</Label>
            <Input
              type="password"
              value={cfg.access_token || ""}
              onChange={(e) => setCfg({ ...cfg, access_token: e.target.value })}
              placeholder="EAAG... (only you can see this)"
            />
            <p className="text-[11px] text-muted-foreground mt-1">
              Stored privately on your account. Each user connects their own number.
            </p>
          </div>
          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <Label>Phone Number ID</Label>
              <Input
                value={cfg.phone_number_id || ""}
                onChange={(e) => setCfg({ ...cfg, phone_number_id: e.target.value })}
                placeholder="e.g. 1234567890123456"
              />
            </div>
            <div>
              <Label>WhatsApp Business Account ID</Label>
              <Input
                value={cfg.waba_id || ""}
                onChange={(e) => setCfg({ ...cfg, waba_id: e.target.value })}
                placeholder="e.g. 9876543210987654"
              />
            </div>
            <div>
              <Label>Display phone (E.164)</Label>
              <Input
                value={cfg.display_phone || ""}
                onChange={(e) => setCfg({ ...cfg, display_phone: e.target.value })}
                placeholder="+971501234567"
              />
            </div>
            <div>
              <Label>Display name</Label>
              <Input
                value={cfg.display_name || ""}
                onChange={(e) => setCfg({ ...cfg, display_name: e.target.value })}
                placeholder="Sadeco"
              />
            </div>
          </div>
          <div className="flex gap-2">
            <Button onClick={save} disabled={saving}>
              {saving ? "Saving…" : "Save"}
            </Button>
            <Button variant="outline" onClick={sync} disabled={syncing || !cfg.waba_id}>
              <RefreshCw className={`w-4 h-4 mr-1.5 ${syncing ? "animate-spin" : ""}`} />
              Sync templates ({tplCount})
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
