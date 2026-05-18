import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart3, Linkedin, Facebook, Instagram, Search } from "lucide-react";

const sources = [
  { icon: Linkedin, label: "LinkedIn Page", note: "Followers, impressions, engagement (live via OAuth)" },
  { icon: Facebook, label: "Facebook Page", note: "Reach, impressions, post performance (Graph API)" },
  { icon: Instagram, label: "Instagram Business", note: "Reach, follower growth, post insights" },
  { icon: Search, label: "Google Search Console", note: "Clicks, impressions, CTR, average position" },
];

export default function MarketingAnalytics() {
  return (
    <div className="p-8 max-w-6xl mx-auto space-y-6">
      <div>
        <h1 className="font-serif text-4xl">Marketing Analytics</h1>
        <p className="text-muted-foreground mt-1">Track website + social progress in one place.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <BarChart3 className="w-5 h-5 text-accent" /> Data sources
          </CardTitle>
        </CardHeader>
        <CardContent className="grid sm:grid-cols-2 gap-4">
          {sources.map(s => (
            <div key={s.label} className="flex gap-3 p-3 rounded border border-border bg-card/40">
              <s.icon className="w-5 h-5 text-accent shrink-0 mt-0.5" />
              <div>
                <div className="text-sm font-medium">{s.label}</div>
                <div className="text-xs text-muted-foreground">{s.note}</div>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground">
        Manual weekly entry will also be supported as a fallback while API approvals are pending.
      </p>
    </div>
  );
}
