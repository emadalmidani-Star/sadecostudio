import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FileDown, FileText, Files, Loader2, Search } from "lucide-react";
import { exportFullProfilePDF, exportSelectedPDF } from "@/lib/pdf";
import { toast } from "sonner";

export default function Exports() {
  const [projects, setProjects] = useState<any[]>([]);
  const [company, setCompany] = useState<any>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");

  useEffect(() => { (async () => {
    const [{ data: p }, { data: c }] = await Promise.all([
      supabase.from("projects").select("*").order("updated_at", { ascending: false }),
      supabase.from("company_profile").select("*").single(),
    ]);
    setProjects(p || []); setCompany(c);
  })(); }, []);

  function toggle(id: string) {
    const n = new Set(selected); n.has(id) ? n.delete(id) : n.add(id); setSelected(n);
  }

  async function fullProfile() {
    setBusy("full");
    try { await exportFullProfilePDF(company, projects); toast.success("Profile PDF generated"); }
    catch (e: any) { toast.error(e.message); }
    setBusy(null);
  }

  async function selectedExport() {
    if (selected.size === 0) return toast.error("Select at least one project");
    setBusy("selected");
    try {
      const list = projects.filter(p => selected.has(p.id));
      await exportSelectedPDF(company, list);
      toast.success("Portfolio PDF generated");
    } catch (e: any) { toast.error(e.message); }
    setBusy(null);
  }

  return (
    <div className="p-10 max-w-6xl mx-auto">
      <p className="text-xs tracking-[0.3em] text-accent mb-2">EXPORT</p>
      <h1 className="font-serif text-5xl mb-2">Generate PDFs</h1>
      <p className="text-muted-foreground mb-10">Premium client-ready documents in one click.</p>

      <div className="grid md:grid-cols-2 gap-6 mb-10">
        <Card className="p-8 luxury-gradient text-primary-foreground">
          <FileText className="w-8 h-8 text-accent mb-4" />
          <h2 className="font-serif text-2xl mb-2">Full Company Profile</h2>
          <p className="text-primary-foreground/70 text-sm mb-6">Cover, about, services, and every project as a complete brand document.</p>
          <Button variant="secondary" onClick={fullProfile} disabled={busy === "full"}>
            {busy === "full" ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <FileDown className="w-4 h-4 mr-2" />}
            Export Profile PDF
          </Button>
        </Card>

        <Card className="p-8 border-accent/40">
          <Files className="w-8 h-8 text-accent mb-4" />
          <h2 className="font-serif text-2xl mb-2">Selected Projects Portfolio</h2>
          <p className="text-muted-foreground text-sm mb-6">Cherry-pick projects below and merge them into a single portfolio PDF.</p>
          <Button onClick={selectedExport} disabled={busy === "selected" || selected.size === 0}>
            {busy === "selected" ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <FileDown className="w-4 h-4 mr-2" />}
            Export {selected.size > 0 ? `(${selected.size})` : ""}
          </Button>
        </Card>
      </div>

      <h2 className="font-serif text-2xl mb-4">Pick projects for portfolio</h2>
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
        {projects.map(p => (
          <Card key={p.id} className={`p-4 cursor-pointer transition-all ${selected.has(p.id) ? "ring-2 ring-accent" : ""}`} onClick={() => toggle(p.id)}>
            <div className="flex items-start gap-3">
              <Checkbox checked={selected.has(p.id)} className="mt-1" />
              <div className="flex-1 min-w-0">
                <p className="text-xs text-accent uppercase tracking-wider">{p.type}</p>
                <h3 className="font-serif text-lg truncate">{p.name}</h3>
                <p className="text-sm text-muted-foreground truncate">{p.location || "—"}</p>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
