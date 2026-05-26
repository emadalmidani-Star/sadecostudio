import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2 } from "lucide-react";
import { fnUrl } from "@/lib/meetings";

type ActionItem = { text: string; done: boolean; assignee?: string };

export default function PublicMeetingNote() {
  const { token } = useParams();
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`${fnUrl("meeting-note-public")}?token=${encodeURIComponent(token || "")}`)
      .then((r) => r.json()).then((d) => { if (d.error) setError(d.error); else setData(d); });
  }, [token]);

  if (error) return <div className="min-h-screen flex items-center justify-center text-muted-foreground">{error}</div>;
  if (!data) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="w-6 h-6 animate-spin" /></div>;

  const n = data.note;
  return (
    <div className="min-h-screen bg-background p-4 py-10">
      <Card className="max-w-3xl mx-auto">
        <CardHeader className="text-center border-b">
          {data.logo_url && <img src={data.logo_url} alt={data.company} className="h-10 mx-auto mb-3" />}
          <CardTitle className="font-serif text-3xl">{n.title}</CardTitle>
          {n.meeting_date && <p className="text-sm text-muted-foreground">{new Date(n.meeting_date).toLocaleDateString()}</p>}
        </CardHeader>
        <CardContent className="space-y-5 pt-6">
          {n.attendees?.length > 0 && (
            <div>
              <div className="text-xs uppercase tracking-wide text-muted-foreground mb-1">Attendees</div>
              <div className="flex flex-wrap gap-1">{n.attendees.map((a: string, i: number) => <span key={i} className="text-xs px-2 py-1 bg-muted rounded">{a}</span>)}</div>
            </div>
          )}
          {n.summary && (
            <div>
              <div className="text-xs uppercase tracking-wide text-muted-foreground mb-1">Summary</div>
              <p className="text-sm whitespace-pre-wrap">{n.summary}</p>
            </div>
          )}
          {n.action_items?.length > 0 && (
            <div>
              <div className="text-xs uppercase tracking-wide text-muted-foreground mb-2">Action items</div>
              <div className="space-y-2">
                {n.action_items.map((ai: ActionItem, i: number) => (
                  <div key={i} className="flex items-center gap-2">
                    <Checkbox checked={ai.done} disabled />
                    <span className={`text-sm flex-1 ${ai.done ? "line-through text-muted-foreground" : ""}`}>{ai.text}</span>
                    {ai.assignee && <span className="text-xs text-muted-foreground">{ai.assignee}</span>}
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
