import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { FitoutProject } from "@/lib/fitout";
import { UserCircle2 } from "lucide-react";

type Role = "PM" | "HOD" | "Supervisor";
type Member = { name: string; role: Role; projects: FitoutProject[]; active: FitoutProject[] };

const FILTER_KEY: Record<Role, string> = { PM: "pm", HOD: "hod", Supervisor: "supervisor" };

export default function FitoutTeam() {
  const [rows, setRows] = useState<FitoutProject[]>([]);
  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("fitout_projects" as any).select("*");
      setRows((data || []) as any);
    })();
  }, []);

  const members = useMemo<Member[]>(() => {
    const map = new Map<string, Member>();
    const add = (name: string | null, role: Role, p: FitoutProject) => {
      if (!name) return;
      const key = `${role}::${name}`;
      const m = map.get(key) || { name, role, projects: [], active: [] };
      m.projects.push(p);
      if (p.status !== "Completed" && p.status !== "Cancelled") m.active.push(p);
      map.set(key, m);
    };
    rows.forEach((r) => {
      add(r.pm, "PM", r);
      add(r.hod, "HOD", r);
      add(r.supervisor, "Supervisor", r);
    });
    return Array.from(map.values()).sort((a, b) => b.projects.length - a.projects.length);
  }, [rows]);

  return (
    <div className="p-8 max-w-[1600px] mx-auto">
      <div className="mb-6">
        <p className="text-xs tracking-[0.3em] text-accent mb-1">FITOUT TRACKER</p>
        <h1 className="font-serif text-4xl">Team</h1>
      </div>

      {members.length === 0 ? (
        <p className="text-muted-foreground">No team members yet — add projects with PM/HOD/Supervisor.</p>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {members.map((m) => (
            <Link key={`${m.role}-${m.name}`} to={`/fitout/projects?${FILTER_KEY[m.role]}=${encodeURIComponent(m.name)}`}>
              <Card className="p-5 hover:shadow-elegant transition">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-full bg-accent/15 flex items-center justify-center">
                    <UserCircle2 className="w-5 h-5 text-accent" />
                  </div>
                  <div>
                    <p className="font-medium">{m.name}</p>
                    <p className="text-xs text-muted-foreground">{m.role} · {m.projects.length} project(s)</p>
                  </div>
                </div>
                {m.active.length > 0 && (
                  <ul className="text-xs text-muted-foreground space-y-1">
                    {m.active.slice(0, 4).map((p) => (
                      <li key={p.id}>• {p.brand ?? "—"} — {p.location ?? "—"}</li>
                    ))}
                    {m.active.length > 4 && <li>+{m.active.length - 4} more</li>}
                  </ul>
                )}
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
