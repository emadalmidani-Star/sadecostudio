import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Target } from "lucide-react";

export default function MarketingCompetitors() {
  return (
    <div className="p-8 max-w-6xl mx-auto space-y-6">
      <div>
        <h1 className="font-serif text-4xl">Competitors</h1>
        <p className="text-muted-foreground mt-1">SEO + social benchmarking against your market.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Target className="w-5 h-5 text-accent" /> What we'll track
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p><strong>SEO:</strong> top keywords, traffic estimates, backlinks, content gaps (Semrush — curated report at first, live sync if you add a Semrush API key).</p>
          <p><strong>Social:</strong> followers, posting cadence, average engagement per competitor — manual weekly entry, optional paid API (Socialinsider / Phyllo) later.</p>
        </CardContent>
      </Card>
    </div>
  );
}
