import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";

export default function EmailAnalytics() {
  const { user } = useAuth();
  const [stats, setStats] = useState({ contacts: 0, subscribed: 0, sent: 0, opened: 0, clicked: 0, bounced: 0 });

  useEffect(() => {
    if (!user) return;
    (async () => {
      const [c, s, sends] = await Promise.all([
        supabase.from("email_contacts").select("id", { count: "exact", head: true }),
        supabase.from("email_contacts").select("id", { count: "exact", head: true }).eq("status", "subscribed"),
        supabase.from("email_sends").select("status,opened_at,clicked_at,bounced_at"),
      ]);
      const arr = sends.data || [];
      setStats({
        contacts: c.count || 0,
        subscribed: s.count || 0,
        sent: arr.filter((x: any) => x.status === "sent" || x.status === "delivered").length,
        opened: arr.filter((x: any) => x.opened_at).length,
        clicked: arr.filter((x: any) => x.clicked_at).length,
        bounced: arr.filter((x: any) => x.bounced_at).length,
      });
    })();
  }, [user?.id]);

  const rate = (n: number) => stats.sent ? `${Math.round((n / stats.sent) * 100)}%` : "—";

  const tiles = [
    { label: "Contacts", value: stats.contacts },
    { label: "Subscribed", value: stats.subscribed },
    { label: "Sent", value: stats.sent },
    { label: "Open rate", value: rate(stats.opened) },
    { label: "Click rate", value: rate(stats.clicked) },
    { label: "Bounce rate", value: rate(stats.bounced) },
  ];

  return (
    <div className="p-8 space-y-6">
      <h1 className="text-2xl font-serif">Email Analytics</h1>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {tiles.map(t => (
          <Card key={t.label}>
            <CardContent className="p-4">
              <div className="text-xs uppercase tracking-wider text-muted-foreground">{t.label}</div>
              <div className="text-2xl font-serif mt-2">{t.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>
      <p className="text-xs text-muted-foreground">Open/click tracking requires Resend webhooks pointed at the email-webhook function.</p>
    </div>
  );
}
