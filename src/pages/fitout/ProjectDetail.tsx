import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { ArrowLeft, Pencil } from "lucide-react";
import StatusBadge from "@/components/fitout/StatusBadge";
import ProjectFormDrawer from "@/components/fitout/ProjectFormDrawer";
import { FitoutProject, daysFromToday, fitoutProgress } from "@/lib/fitout";

export default function ProjectDetail() {
  const { id } = useParams();
  const [p, setP] = useState<FitoutProject | null>(null);
  const [edit, setEdit] = useState(false);

  async function load() {
    if (!id) return;
    const { data } = await supabase.from("fitout_projects" as any).select("*").eq("id", id).maybeSingle();
    setP(data as any);
  }
  useEffect(() => { load(); }, [id]);

  if (!p) return <div className="p-10 text-muted-foreground">Loading…</div>;

  const timeline: { label: string; date: string | null }[] = [
    { label: "Date Added", date: p.date_added },
    { label: "Start on Site", date: p.start_on_site },
    { label: "Fitout Completion", date: p.fitout_completion },
    { label: "Store Handover", date: p.store_handover },
    { label: "Snag Prep Date", date: p.snag_prep_date },
    { label: "Snag Completion", date: p.snag_completion_date },
    { label: "Store Opening", date: p.store_opening },
  ];

  const progress = fitoutProgress(p);

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <Button variant="ghost" asChild><Link to="/fitout/projects"><ArrowLeft className="w-4 h-4 mr-2" />Back</Link></Button>
        <Button onClick={() => setEdit(true)}><Pencil className="w-4 h-4 mr-2" />Edit</Button>
      </div>

      <div className="mb-6">
        <p className="text-xs tracking-[0.3em] text-accent mb-1">{p.project_type ?? "PROJECT"}</p>
        <h1 className="font-serif text-4xl mb-2">{p.brand ?? "—"} — {p.location ?? "—"}</h1>
        <div className="flex items-center gap-3 text-muted-foreground">
          <StatusBadge status={p.status} />
          <span>{p.city_province ?? ""}</span>
        </div>
      </div>

      <div className="grid md:grid-cols-3 gap-4 mb-6">
        <InfoCard label="Project Manager" value={p.pm} />
        <InfoCard label="HOD" value={p.hod} />
        <InfoCard label="Supervisor" value={p.supervisor} />
        <InfoCard label="Size" value={p.size_m2 ? `${p.size_m2} m²` : null} />
        <InfoCard label="Fitout Period" value={p.fitout_period_days ? `${p.fitout_period_days} days` : null} />
        <InfoCard label="Contract Period" value={p.contract_period_days ? `${p.contract_period_days} days` : null} />
      </div>

      <Card className="p-6 mb-6">
        <h2 className="font-serif text-2xl mb-4">Fitout Progress</h2>
        {progress != null ? (
          <>
            <Progress value={progress} className="mb-2" />
            <p className="text-sm text-muted-foreground">{progress.toFixed(0)}% elapsed of fitout period</p>
          </>
        ) : <p className="text-muted-foreground text-sm">Add Start on Site and Fitout Period to track progress.</p>}
      </Card>

      <Card className="p-6 mb-6">
        <h2 className="font-serif text-2xl mb-4">Timeline</h2>
        <ol className="relative border-l border-border pl-6 space-y-4">
          {timeline.map((t) => {
            const d = daysFromToday(t.date);
            return (
              <li key={t.label} className="relative">
                <span className="absolute -left-[31px] top-1.5 w-3 h-3 rounded-full bg-accent" />
                <div className="flex items-baseline justify-between">
                  <div>
                    <p className="font-medium">{t.label}</p>
                    <p className="text-sm text-muted-foreground">{t.date ?? "Not set"}</p>
                  </div>
                  {d != null && (
                    <span className="text-xs text-muted-foreground">
                      {d === 0 ? "Today" : d > 0 ? `in ${d} day(s)` : `${-d} day(s) ago`}
                    </span>
                  )}
                </div>
              </li>
            );
          })}
        </ol>
      </Card>

      {p.comments && (
        <Card className="p-6">
          <h2 className="font-serif text-2xl mb-2">Comments</h2>
          <p className="whitespace-pre-wrap text-sm">{p.comments}</p>
        </Card>
      )}

      <ProjectFormDrawer open={edit} onOpenChange={setEdit} project={p} onSaved={load} />
    </div>
  );
}

function InfoCard({ label, value }: { label: string; value: any }) {
  return (
    <Card className="p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="font-medium mt-1">{value ?? "—"}</p>
    </Card>
  );
}
