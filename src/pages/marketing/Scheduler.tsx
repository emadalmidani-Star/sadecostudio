import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CalendarClock } from "lucide-react";

export default function MarketingScheduler() {
  return (
    <div className="p-8 max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="font-serif text-4xl">Post Scheduler</h1>
        <p className="text-muted-foreground mt-1">Compose and schedule posts to LinkedIn, Facebook & Instagram.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <CalendarClock className="w-5 h-5 text-accent" /> Coming next
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <p>
            To enable posting we need your <strong>LinkedIn</strong> and <strong>Meta</strong> developer apps:
          </p>
          <ul className="list-disc pl-5 space-y-1">
            <li>LinkedIn Developer app with <code>w_organization_social</code> approved.</li>
            <li>Meta Developer app with <code>pages_manage_posts</code> + <code>instagram_content_publish</code> (Meta App Review required).</li>
          </ul>
          <p>
            Once you have those Client IDs / secrets ready, I'll wire up OAuth, the composer, the queue and the publishing cron.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
