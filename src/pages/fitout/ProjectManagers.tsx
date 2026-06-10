import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { UserCog, Star, Search, FolderPlus, X } from "lucide-react";
import PMAvatar from "@/components/PMAvatar";
import StatusBadge from "@/components/fitout/StatusBadge";
import EmptyState from "@/components/EmptyState";
import { useAuth } from "@/contexts/AuthContext";
import { fitoutProgress, splitPeople, daysFromToday, type FitoutProject } from "@/lib/fitout";

const PORTFOLIO_KEY = "pm-portfolio-selection";

export default function FitoutProjectManagers() {
  const [fitout, setFitout] = useState<FitoutProject[]>([]);
  const [meName, setMeName] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Set<string>>(() => {
    try {
      const raw = localStorage.getItem(PORTFOLIO_KEY);
      return new Set(raw ? JSON.parse(raw) : []);
    } catch { return new Set(); }
  });
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

  useEffect(() => {
    try { localStorage.setItem(PORTFOLIO_KEY, JSON.stringify(Array.from(selected))); } catch {}
  }, [selected]);

  const toggleOne = (id: string) =>
    setSelected(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  const toggleMany = (ids: string[], on: boolean) =>
    setSelected(prev => {
      const next = new Set(prev);
      ids.forEach(id => on ? next.add(id) : next.delete(id));
      return next;
    });

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

  const filteredGroups = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return pmGroups;
    return pmGroups.filter(g => g.name.toLowerCase().includes(q));
  }, [pmGroups, query]);

  const myPmName = useMemo(() => {
    if (!meName) return null;
    const first = meName.trim().split(/\s+/)[0]?.toLowerCase();
    return pmGroups.find(g => g.name.toLowerCase().includes(first))?.name || null;
  }, [meName, pmGroups]);

  const allVisibleIds = useMemo(
    () => filteredGroups.flatMap(g => g.items.map(i => i.id)),
    [filteredGroups]
  );
  const allVisibleSelected = allVisibleIds.length > 0 && allVisibleIds.every(id => selected.has(id));

  return (
    <div className="p-6 md:p-10 max-w-6xl mx-auto">
      <div className="flex items-end justify-between mb-6 gap-4 flex-wrap">
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
            {filteredGroups.length} of {pmGroups.length} managers · {fitout.length} projects
          </p>
        )}
      </div>

      {/* Search + portfolio toolbar */}
      <div className="flex flex-wrap items-center gap-3 mb-5">
        <div className="relative flex-1 min-w-[220px] max-w-md">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search project managers by name…"
            className="pl-9"
          />
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => toggleMany(allVisibleIds, !allVisibleSelected)}
          disabled={allVisibleIds.length === 0}
        >
          <FolderPlus className="w-4 h-4" />
          {allVisibleSelected ? "Unselect all" : "Select all for portfolio"}
        </Button>
        {selected.size > 0 && (
          <div className="flex items-center gap-2 text-sm">
            <span className="px-2 py-1 rounded-full bg-accent/10 text-accent border border-accent/30 text-xs">
              {selected.size} in portfolio
            </span>
            <Button variant="ghost" size="sm" onClick={() => setSelected(new Set())}>
              <X className="w-4 h-4" /> Clear
            </Button>
          </div>
        )}
      </div>

      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-14 w-full" />)}
        </div>
      ) : filteredGroups.length === 0 ? (
        <EmptyState title="No project managers found" description={query ? `No managers match “${query}”.` : "Sync the fitout sheet to populate PM workload."} />
      ) : (
        <Card className="p-5 md:p-6 shadow-card">
          <Accordion type="single" collapsible defaultValue={myPmName ? `pm-${myPmName}` : undefined} className="w-full">
            {filteredGroups.map(g => {
              const isMe = myPmName === g.name;
              const groupIds = g.items.map(i => i.id);
              const groupAllSelected = groupIds.length > 0 && groupIds.every(id => selected.has(id));
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
                    <div className="flex justify-end mb-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => { e.stopPropagation(); toggleMany(groupIds, !groupAllSelected); }}
                      >
                        {groupAllSelected ? "Unselect all" : "Select all"}
                      </Button>
                    </div>
                    <div className="space-y-2 pl-1">
                      {g.items.map(p => {
                        const pct = fitoutProgress(p);
                        const days = daysFromToday(p.store_opening);
                        const checked = selected.has(p.id);
                        return (
                          <div key={p.id} className="flex items-start gap-3 p-3 rounded border hover:bg-muted/30 transition-colors">
                            <Checkbox
                              checked={checked}
                              onCheckedChange={() => toggleOne(p.id)}
                              className="mt-1"
                              aria-label="Add to portfolio"
                            />
                            <Link to={`/fitout/projects/${p.id}`} className="block flex-1 min-w-0">
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
                          </div>
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
