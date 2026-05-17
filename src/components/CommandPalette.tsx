import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { supabase } from "@/integrations/supabase/client";
import { LayoutDashboard, FolderKanban, FileText, Building2, Users, BarChart3, Hammer, HardHat, UserCircle2, QrCode, LayoutTemplate, ShieldCheck } from "lucide-react";

const ROUTES = [
  { to: "/", label: "Overview", icon: LayoutDashboard },
  { to: "/projects", label: "Projects", icon: FolderKanban },
  { to: "/exports", label: "Export PDFs", icon: FileText },
  { to: "/company", label: "Company Profile", icon: Building2 },
  { to: "/team", label: "Team", icon: Users },
  { to: "/me", label: "My Profile", icon: UserCircle2 },
  { to: "/id-cards", label: "ID Cards", icon: QrCode },
  { to: "/template", label: "Template Designer", icon: LayoutTemplate },
  { to: "/permissions", label: "Permissions", icon: ShieldCheck },
  { to: "/fitout", label: "Fitout Dashboard", icon: BarChart3 },
  { to: "/fitout/projects", label: "Fitout Tracker", icon: Hammer },
  { to: "/fitout/team", label: "Fitout Team", icon: HardHat },
];

export default function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [projects, setProjects] = useState<{ id: string; name: string; location: string | null }[]>([]);
  const nav = useNavigate();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.key === "k" || e.key === "K") && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((v) => !v);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (!open || projects.length) return;
    supabase.from("projects").select("id,name,location").order("updated_at", { ascending: false })
      .then(({ data }) => setProjects(data || []));
  }, [open, projects.length]);

  const go = (to: string) => { setOpen(false); nav(to); };

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput placeholder="Jump to a page or project…" />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>
        <CommandGroup heading="Pages">
          {ROUTES.map((r) => (
            <CommandItem key={r.to} value={r.label} onSelect={() => go(r.to)}>
              <r.icon className="w-4 h-4 mr-2" />{r.label}
            </CommandItem>
          ))}
        </CommandGroup>
        {projects.length > 0 && (
          <CommandGroup heading="Projects">
            {projects.map((p) => (
              <CommandItem key={p.id} value={`${p.name} ${p.location ?? ""}`} onSelect={() => go(`/projects/${p.id}`)}>
                <FolderKanban className="w-4 h-4 mr-2" />
                <span>{p.name}</span>
                {p.location && <span className="ml-2 text-xs text-muted-foreground">{p.location}</span>}
              </CommandItem>
            ))}
          </CommandGroup>
        )}
      </CommandList>
    </CommandDialog>
  );
}
