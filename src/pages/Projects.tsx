import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Search } from "lucide-react";

export default function Projects() {
  const [projects, setProjects] = useState<any[]>([]);
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<"all" | "ongoing" | "completed">("all");

  useEffect(() => { load(); }, []);
  async function load() {
    const { data } = await supabase.from("projects").select("*").order("updated_at", { ascending: false });
    setProjects(data || []);
  }

  const filtered = projects.filter(p =>
    (filter === "all" || p.status === filter) &&
    (q === "" || p.name.toLowerCase().includes(q.toLowerCase()) || (p.location || "").toLowerCase().includes(q.toLowerCase()))
  );

  return (
    <div className="p-10 max-w-7xl mx-auto">
      <div className="flex items-end justify-between mb-8">
        <div>
          <p className="text-xs tracking-[0.3em] text-accent mb-2">PORTFOLIO</p>
          <h1 className="font-serif text-5xl">Projects</h1>
        </div>
        <Button asChild size="lg"><Link to="/projects/new"><Plus className="w-4 h-4 mr-2" />New Project</Link></Button>
      </div>

      <div className="flex gap-3 mb-8">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input value={q} onChange={e => setQ(e.target.value)} placeholder="Search projects…" className="pl-9" />
        </div>
        <div className="flex gap-1 bg-muted p-1 rounded">
          {(["all", "ongoing", "completed"] as const).map(f => (
            <button key={f} onClick={() => setFilter(f)}
              className={`px-4 py-1.5 text-sm rounded capitalize transition-colors ${filter === f ? "bg-background shadow-sm" : "text-muted-foreground"}`}>
              {f}
            </button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <Card className="p-16 text-center border-dashed">
          <p className="text-muted-foreground mb-4">No projects match your filters.</p>
          <Button asChild><Link to="/projects/new"><Plus className="w-4 h-4 mr-2" />Create Project</Link></Button>
        </Card>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filtered.map(p => (
            <Link key={p.id} to={`/projects/${p.id}`}>
              <Card className="overflow-hidden hover:shadow-elegant transition-all group h-full">
                <div className="aspect-[4/3] bg-muted relative overflow-hidden">
                  {p.cover_image ? (
                    <img src={p.cover_image} alt={p.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                  ) : <div className="w-full h-full luxury-gradient" />}
                  <div className="absolute top-3 right-3 px-2 py-1 text-xs bg-background/90 backdrop-blur rounded">
                    {p.status === "completed" ? "Completed" : "Ongoing"}
                  </div>
                </div>
                <div className="p-5">
                  <p className="text-xs text-accent uppercase tracking-wider mb-1">{p.type} {p.area_sqm && `· ${p.area_sqm} sqm`}</p>
                  <h3 className="font-serif text-xl mb-1">{p.name}</h3>
                  <p className="text-sm text-muted-foreground">{p.location || "—"}</p>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
