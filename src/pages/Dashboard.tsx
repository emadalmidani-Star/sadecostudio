import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, FolderKanban, CheckCircle2, Clock, Building2 } from "lucide-react";

export default function Dashboard() {
  const [stats, setStats] = useState({ total: 0, completed: 0, ongoing: 0 });
  const [recent, setRecent] = useState<any[]>([]);

  useEffect(() => { (async () => {
    const { data } = await supabase.from("projects").select("*").order("updated_at", { ascending: false });
    const all = data || [];
    setStats({ total: all.length, completed: all.filter(p => p.status === "completed").length, ongoing: all.filter(p => p.status === "ongoing").length });
    setRecent(all.slice(0, 6));
  })(); }, []);

  return (
    <div className="p-10 max-w-7xl mx-auto">
      <div className="flex items-end justify-between mb-10">
        <div>
          <p className="text-xs tracking-[0.3em] text-accent mb-2">DASHBOARD</p>
          <h1 className="font-serif text-5xl">Welcome back</h1>
          <p className="text-muted-foreground mt-2">Manage SADECO projects and generate client-ready documents.</p>
        </div>
        <Button asChild size="lg"><Link to="/projects/new"><Plus className="w-4 h-4 mr-2" />New Project</Link></Button>
      </div>

      <div className="grid md:grid-cols-3 gap-6 mb-10">
        <StatCard icon={FolderKanban} label="Total Projects" value={stats.total} />
        <StatCard icon={CheckCircle2} label="Completed" value={stats.completed} />
        <StatCard icon={Clock} label="Ongoing" value={stats.ongoing} />
      </div>

      <div className="flex items-center justify-between mb-4">
        <h2 className="font-serif text-2xl">Recent Projects</h2>
        <Link to="/projects" className="text-sm text-accent hover:underline">View all →</Link>
      </div>
      {recent.length === 0 ? (
        <Card className="p-12 text-center border-dashed">
          <Building2 className="w-10 h-10 mx-auto text-muted-foreground mb-4" />
          <p className="text-muted-foreground mb-4">No projects yet. Start by creating one.</p>
          <Button asChild><Link to="/projects/new"><Plus className="w-4 h-4 mr-2" />Create Project</Link></Button>
        </Card>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {recent.map(p => (
            <Link key={p.id} to={`/projects/${p.id}`}>
              <Card className="overflow-hidden hover:shadow-elegant transition-all group">
                <div className="aspect-[4/3] bg-muted relative overflow-hidden">
                  {p.cover_image ? (
                    <img src={p.cover_image} alt={p.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                  ) : <div className="w-full h-full luxury-gradient" />}
                  <div className="absolute top-3 right-3 px-2 py-1 text-xs bg-background/90 backdrop-blur rounded">
                    {p.status === "completed" ? "Completed" : "Ongoing"}
                  </div>
                </div>
                <div className="p-5">
                  <p className="text-xs text-accent uppercase tracking-wider mb-1">{p.type}</p>
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

function StatCard({ icon: Icon, label, value }: { icon: any; label: string; value: number }) {
  return (
    <Card className="p-6 shadow-card">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-muted-foreground mb-2">{label}</p>
          <p className="font-serif text-4xl">{value}</p>
        </div>
        <div className="w-10 h-10 rounded brass-gradient flex items-center justify-center">
          <Icon className="w-5 h-5 text-primary" />
        </div>
      </div>
    </Card>
  );
}
