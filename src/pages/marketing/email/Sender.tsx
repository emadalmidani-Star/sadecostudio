import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/hooks/use-toast";

export default function EmailSender() {
  const { user } = useAuth();
  const [s, setS] = useState<any>({ from_name: "", from_email: "", reply_to: "", physical_address: "" });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    supabase.from("email_marketing_settings").select("*").eq("user_id", user.id).maybeSingle()
      .then(({ data }) => { if (data) setS(data); setLoading(false); });
  }, [user?.id]);

  async function save() {
    if (!user) return;
    const { error } = await supabase.from("email_marketing_settings").upsert({ ...s, user_id: user.id });
    if (error) toast({ title: "Save failed", description: error.message, variant: "destructive" });
    else toast({ title: "Saved" });
  }

  if (loading) return <div className="p-8 text-muted-foreground">Loading…</div>;
  return (
    <div className="p-8 max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-serif">Email Sender</h1>
        <p className="text-sm text-muted-foreground mt-1">Configure who marketing emails come from. The from-domain must be verified in Resend.</p>
      </div>
      <Card>
        <CardHeader><CardTitle className="text-base">Sender identity</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div><Label>From name</Label><Input value={s.from_name || ""} onChange={e => setS({ ...s, from_name: e.target.value })} placeholder="Sadeco Studio" /></div>
          <div><Label>From email</Label><Input value={s.from_email || ""} onChange={e => setS({ ...s, from_email: e.target.value })} placeholder="hello@mail.yourdomain.com" /></div>
          <div><Label>Reply-to</Label><Input value={s.reply_to || ""} onChange={e => setS({ ...s, reply_to: e.target.value })} placeholder="optional" /></div>
          <div><Label>Physical address (CAN-SPAM footer)</Label><Textarea value={s.physical_address || ""} onChange={e => setS({ ...s, physical_address: e.target.value })} rows={2} /></div>
          <Button onClick={save}>Save</Button>
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle className="text-base">Resend connection</CardTitle></CardHeader>
        <CardContent className="text-sm text-muted-foreground space-y-2">
          <p>Connected via Lovable. To send from your own domain, add it in your Resend dashboard and set the From email above to an address on that verified domain.</p>
          <p>Use a marketing-only subdomain (e.g. <code>mail.yourdomain.com</code>) to keep marketing and transactional reputation separate.</p>
        </CardContent>
      </Card>
    </div>
  );
}
