import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Download } from "lucide-react";

type Range = "7" | "30" | "90" | "all";

type Send = {
  id: string;
  campaign_id: string | null;
  recipient_email: string;
  status: string;
  sent_at: string | null;
  opened_at: string | null;
  clicked_at: string | null;
  bounced_at: string | null;
  created_at: string;
};

type Campaign = { id: string; name: string | null; subject: string | null };

function toCSV(rows: Record<string, any>[]): string {
  if (!rows.length) return "";
  const headers = Object.keys(rows[0]);
  const esc = (v: any) => {
    const s = v == null ? "" : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [headers.join(","), ...rows.map(r => headers.map(h => esc(r[h])).join(","))].join("\n");
}

function download(filename: string, content: string) {
  const blob = new Blob([content], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

export default function EmailAnalytics() {
  const { user } = useAuth();
  const [range, setRange] = useState<Range>("30");
  const [contacts, setContacts] = useState({ total: 0, subscribed: 0 });
  const [sends, setSends] = useState<Send[]>([]);
  const [campaigns, setCampaigns] = useState<Record<string, Campaign>>({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!user) return;
    (async () => {
      setLoading(true);
      const since = range === "all" ? null : new Date(Date.now() - parseInt(range) * 86400000).toISOString();
      const sendsQ = supabase
        .from("email_sends")
        .select("id,campaign_id,recipient_email,status,sent_at,opened_at,clicked_at,bounced_at,created_at")
        .order("created_at", { ascending: false });
      if (since) sendsQ.gte("created_at", since);

      const [c, s, sendsRes, campRes] = await Promise.all([
        supabase.from("email_contacts").select("id", { count: "exact", head: true }),
        supabase.from("email_contacts").select("id", { count: "exact", head: true }).eq("status", "subscribed"),
        sendsQ,
        supabase.from("email_campaigns").select("id,name,subject"),
      ]);
      setContacts({ total: c.count || 0, subscribed: s.count || 0 });
      setSends((sendsRes.data as Send[]) || []);
      const map: Record<string, Campaign> = {};
      (campRes.data || []).forEach((c: any) => { map[c.id] = c; });
      setCampaigns(map);
      setLoading(false);
    })();
  }, [user?.id, range]);

  const stats = useMemo(() => {
    const sent = sends.filter(x => x.status === "sent" || x.status === "delivered").length;
    const opened = sends.filter(x => x.opened_at).length;
    const clicked = sends.filter(x => x.clicked_at).length;
    const bounced = sends.filter(x => x.bounced_at).length;
    const failed = sends.filter(x => x.status === "failed").length;
    return { sent, opened, clicked, bounced, failed, total: sends.length };
  }, [sends]);

  const byCampaign = useMemo(() => {
    const groups: Record<string, Send[]> = {};
    sends.forEach(s => {
      const k = s.campaign_id || "none";
      (groups[k] ||= []).push(s);
    });
    return Object.entries(groups).map(([cid, list]) => {
      const sent = list.filter(x => x.status === "sent" || x.status === "delivered").length;
      const opened = list.filter(x => x.opened_at).length;
      const clicked = list.filter(x => x.clicked_at).length;
      const bounced = list.filter(x => x.bounced_at).length;
      const c = campaigns[cid];
      return {
        id: cid,
        name: c?.name || c?.subject || (cid === "none" ? "(no campaign)" : cid.slice(0, 8)),
        recipients: list.length, sent, opened, clicked, bounced,
        openRate: sent ? Math.round((opened / sent) * 100) : 0,
        clickRate: sent ? Math.round((clicked / sent) * 100) : 0,
      };
    }).sort((a, b) => b.recipients - a.recipients);
  }, [sends, campaigns]);

  const rate = (n: number) => stats.sent ? `${Math.round((n / stats.sent) * 100)}%` : "—";

  const tiles = [
    { label: "Contacts", value: contacts.total },
    { label: "Subscribed", value: contacts.subscribed },
    { label: "Sent", value: stats.sent },
    { label: "Open rate", value: rate(stats.opened) },
    { label: "Click rate", value: rate(stats.clicked) },
    { label: "Bounce rate", value: rate(stats.bounced) },
  ];

  const exportSummary = () => {
    const rows = [{
      range_days: range,
      generated_at: new Date().toISOString(),
      contacts: contacts.total,
      subscribed: contacts.subscribed,
      sent: stats.sent,
      opened: stats.opened,
      clicked: stats.clicked,
      bounced: stats.bounced,
      failed: stats.failed,
      open_rate_pct: stats.sent ? ((stats.opened / stats.sent) * 100).toFixed(2) : "",
      click_rate_pct: stats.sent ? ((stats.clicked / stats.sent) * 100).toFixed(2) : "",
      bounce_rate_pct: stats.sent ? ((stats.bounced / stats.sent) * 100).toFixed(2) : "",
    }];
    const camp = byCampaign.map(c => ({
      campaign: c.name, recipients: c.recipients, sent: c.sent,
      opened: c.opened, clicked: c.clicked, bounced: c.bounced,
      open_rate_pct: c.openRate, click_rate_pct: c.clickRate,
    }));
    const csv = `SUMMARY\n${toCSV(rows)}\n\nBY CAMPAIGN\n${toCSV(camp)}`;
    download(`email-analytics-summary-${range}d-${new Date().toISOString().slice(0, 10)}.csv`, csv);
  };

  const exportSendsLog = () => {
    const rows = sends.map(s => ({
      campaign: campaigns[s.campaign_id || ""]?.name || campaigns[s.campaign_id || ""]?.subject || "",
      recipient: s.recipient_email,
      status: s.status,
      sent_at: s.sent_at || "",
      opened_at: s.opened_at || "",
      clicked_at: s.clicked_at || "",
      bounced_at: s.bounced_at || "",
      created_at: s.created_at,
    }));
    download(`email-sends-log-${range}d-${new Date().toISOString().slice(0, 10)}.csv`, toCSV(rows));
  };

  return (
    <div className="p-8 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-serif">Email Analytics</h1>
        <div className="flex items-center gap-2">
          <Select value={range} onValueChange={(v) => setRange(v as Range)}>
            <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="7">Last 7 days</SelectItem>
              <SelectItem value="30">Last 30 days</SelectItem>
              <SelectItem value="90">Last 90 days</SelectItem>
              <SelectItem value="all">All time</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={exportSummary} disabled={loading}>
            <Download className="h-4 w-4 mr-2" /> Summary CSV
          </Button>
          <Button variant="outline" size="sm" onClick={exportSendsLog} disabled={loading || !sends.length}>
            <Download className="h-4 w-4 mr-2" /> Sends log CSV
          </Button>
        </div>
      </div>

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

      <Card>
        <CardContent className="p-0">
          <div className="px-4 py-3 border-b flex items-center justify-between">
            <h2 className="font-serif text-lg">By campaign</h2>
            <span className="text-xs text-muted-foreground">{byCampaign.length} campaign(s) · {stats.total} send rows</span>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Campaign</TableHead>
                <TableHead className="text-right">Recipients</TableHead>
                <TableHead className="text-right">Sent</TableHead>
                <TableHead className="text-right">Opened</TableHead>
                <TableHead className="text-right">Clicked</TableHead>
                <TableHead className="text-right">Bounced</TableHead>
                <TableHead className="text-right">Open %</TableHead>
                <TableHead className="text-right">Click %</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {byCampaign.length === 0 ? (
                <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-8">No sends in this range.</TableCell></TableRow>
              ) : byCampaign.map(c => (
                <TableRow key={c.id}>
                  <TableCell className="font-medium">{c.name}</TableCell>
                  <TableCell className="text-right">{c.recipients}</TableCell>
                  <TableCell className="text-right">{c.sent}</TableCell>
                  <TableCell className="text-right">{c.opened}</TableCell>
                  <TableCell className="text-right">{c.clicked}</TableCell>
                  <TableCell className="text-right">{c.bounced}</TableCell>
                  <TableCell className="text-right">{c.openRate}%</TableCell>
                  <TableCell className="text-right">{c.clickRate}%</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground">Open/click tracking requires Resend webhooks pointed at the email-webhook function.</p>
    </div>
  );
}
