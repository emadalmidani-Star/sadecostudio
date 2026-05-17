import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { UserCog, Star } from "lucide-react";
import PMAvatar from "@/components/PMAvatar";
import StatusBadge from "@/components/fitout/StatusBadge";
import EmptyState from "@/components/EmptyState";
import { useAuth } from "@/contexts/AuthContext";
import { fitoutProgress, splitPeople, daysFromToday, type FitoutProject } from "@/lib/fitout";

export default function FitoutProjectManagers() {
  const [fitout, setFitout] = useState<FitoutProject[]>([]);
  const [meName, setMeName] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();

  useEffect(() => {
    (async () => {
      const { data: f } = await supabase.from("fitout_projects" as any).select("*");
      setFitout((f || []) as any);
      if (user) {
        const { data: me } = await supabase.from("profiles").select("full_name").eq("id", user.id).maybeSingle();
        setMeName(me?.full_name || "");
      }
      setLoading(false);
    })();
  }, [user]);

  const pmGroups = useMemo(() => {
    const map = new Map<string, FitoutProject[]>();
    for (const r of fitout) {
      const names = splitPeople(r.pm);
      if (names.length === 0) continue;
      for (const n of names) {
        if (!map.has(n)) map.set(n, []);
        map.get(n)!.push(r);
      }
    }
    return Array.from(map, ([name, items]) => ({
      name,
      items: items.sort((a, b) => (a.store_opening || "").localeCompare(b.store_opening || "")),
      active: items.filter(i => i.status === "In Progress" || i.status === "Planning").length,
      completed: items.filter(i => i.status === "Completed").length,
    })).sort((a, b) => b.items.length - a.items.length);
  }, [fitout]);

  const myPmName = useMemo(() => {
    if (!meName) return null;
    const first = meName.trim().split(/\s+/)[0]?.toLowerCase();
    return pmGroups.find(g => g.name.toLowerCase().includes(first))?.name || null;
  }, [meName, pmGroups]);

  return (
    <div className="p-6 md:p-10 max-w-6xl mx-auto">
      <div className="flex items-end justify-between mb-8 gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded brass-gradient flex items-center justify-center">
            <UserCog className="w-5 h-5 text-primary" />
          </div>
          <div>
            <p className="eyebrow mb-1">FITOUT OPERATIONS</p>
            <h1 className="page-title">Project Managers</h1>
          </div>
        </div>
        {!loading && (
          <p className="text-xs text-muted-foreground">
            Live from the fitout sheet · {pmGroups.length} managers · {fitout.length} projects
          </p>
        )}
      </div>

      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-14 w-full" />)}
        </div>
      ) : pmGroups.length === 0 ? (
        <EmptyState title="No project managers found" description="Sync the fitout sheet to populate PM workload." />
      ) : (
        <Card className="p-5 md:p-6 shadow-card">
          <Accordion type="single" collapsible defaultValue={myPmName ? `pm-${myPmName}` : undefined} className="w-full">
            {pmGroups.map(g => {
              const isMe = myPmName === g.name;
              return (
                <AccordionItem key={g.name} value={`pm-${g.name}`} className="border-border">
                  <AccordionTrigger className="hover:no-underline py-3">
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <PMAvatar name={g.name} />
                      <div className="text-left min-w-0">
                        <div className="font-medium flex items-center gap-2">
                          {g.name}
                          {isMe && (
                            <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full border border-accent text-accent bg-accent/10">
                              <Star className="w-3 h-3" /> You
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {g.items.length} project{g.items.length === 1 ? "" : "s"} · {g.active} active · {g.completed} completed
                        </div>
                      </div>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent>
                    <div className="space-y-2 pl-1">
                      {g.items.map(p => {
                        const pct = fitoutProgress(p);
                        const days = daysFromToday(p.store_opening);
                        return (
                          <Link key={p.id} to={`/fitout/projects/${p.id}`}
                            className="block p-3 rounded border hover:bg-muted/30 transition-colors">
                            <div className="flex items-center justify-between gap-3 flex-wrap mb-2">
                              <div className="min-w-0">
                                <div className="font-medium truncate">{p.brand ?? "—"} — {p.location ?? "—"}</div>
                                <div className="text-xs text-muted-foreground">
                                  {p.city_province ?? "—"}{p.project_type ? ` · ${p.project_type}` : ""}
                                  {p.store_opening ? ` · Opens ${p.store_opening}` : ""}
                                  {days != null && days >= 0 ? ` (${days}d)` : ""}
                                </div>
                              </div>
                              <StatusBadge status={p.status} />
                            </div>
                            {pct != null && (
                              <div className="flex items-center gap-3">
                                <Progress value={pct} className="h-1.5 flex-1" />
                                <span className="text-[11px] tabular-nums text-muted-foreground w-10 text-right">{Math.round(pct)}%</span>
                              </div>
                            )}
                          </Link>
                        );
                      })}
                    </div>
                  </AccordionContent>
                </AccordionItem>
              );
            })}
          </Accordion>
        </Card>
      )}
    </div>
  );
}
