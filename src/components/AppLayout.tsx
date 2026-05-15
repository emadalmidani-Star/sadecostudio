import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { LayoutDashboard, FolderKanban, Building2, FileText, LogOut, Users, LayoutTemplate, UserCircle2, ShieldCheck, QrCode, Hammer, BarChart3, HardHat } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useUserRole, PageKey } from "@/hooks/useUserRole";
import logoWhite from "@/assets/sadeco-logo-white.png";
import { Button } from "@/components/ui/button";

type Link = { to: string; icon: any; label: string; end?: boolean; page?: PageKey; adminOnly?: boolean; group?: string };

const links: Link[] = [
  { to: "/", icon: LayoutDashboard, label: "Dashboard", end: true },
  { to: "/projects", icon: FolderKanban, label: "Projects", page: "projects" },
  { to: "/exports", icon: FileText, label: "Export PDFs", page: "exports" },
  { to: "/me", icon: UserCircle2, label: "My Profile", page: "me" },
  { to: "/id-cards", icon: QrCode, label: "ID Cards", page: "idcards" },
  { to: "/company", icon: Building2, label: "Company Profile", page: "company" },
  { to: "/template", icon: LayoutTemplate, label: "Template Designer", page: "template" },
  { to: "/team", icon: Users, label: "Team", page: "team" },
  { to: "/fitout", icon: BarChart3, label: "Dashboard", end: true, page: "fitout", group: "Fitout Operations" },
  { to: "/fitout/projects", icon: Hammer, label: "Tracker", page: "fitout", group: "Fitout Operations" },
  { to: "/fitout/team", icon: HardHat, label: "Team", page: "fitout", group: "Fitout Operations" },
  { to: "/permissions", icon: ShieldCheck, label: "Permissions", adminOnly: true },
];

export default function AppLayout() {
  const { signOut, user } = useAuth();
  const { canAccess, isAdmin, loading } = useUserRole();
  const visible = links.filter(l => {
    if (l.adminOnly) return isAdmin;
    if (!l.page) return true;
    return canAccess(l.page);
  });
  const nav = useNavigate();

  return (
    <div className="min-h-screen flex bg-background">
      <aside className="w-64 luxury-gradient text-sidebar-foreground flex flex-col shrink-0">
        <div className="p-6 border-b border-sidebar-border">
          <img src={logoWhite} alt="SADECO" className="h-14 mx-auto" />
          <p className="text-center text-xs tracking-[0.3em] text-accent mt-2 font-sans">PROJECT STUDIO</p>
        </div>
        <nav className="flex-1 p-4 space-y-1">
          {!loading && (() => {
            const renderLink = (l: Link) => (
              <NavLink key={l.to} to={l.to} end={l.end}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-4 py-3 rounded text-sm transition-colors ${
                    isActive ? "bg-sidebar-accent text-accent" : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
                  }`}>
                <l.icon className="w-4 h-4" />{l.label}
              </NavLink>
            );
            const ungrouped = visible.filter(l => !l.group);
            const groups = visible.reduce<Record<string, Link[]>>((acc, l) => {
              if (l.group) (acc[l.group] = acc[l.group] || []).push(l);
              return acc;
            }, {});
            return (
              <>
                {ungrouped.map(renderLink)}
                {Object.entries(groups).map(([name, items]) => (
                  <div key={name} className="pt-4">
                    <p className="px-4 pb-2 text-[10px] tracking-[0.2em] text-sidebar-foreground/40 uppercase">{name}</p>
                    {items.map(renderLink)}
                  </div>
                ))}
              </>
            );
          })()}
        </nav>
        <div className="p-4 border-t border-sidebar-border">
          <div className="text-xs text-sidebar-foreground/50 mb-2 truncate">{user?.email}</div>
          <Button variant="ghost" size="sm" onClick={async () => { await signOut(); nav("/auth"); }}
            className="w-full justify-start text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent">
            <LogOut className="w-4 h-4 mr-2" />Sign out
          </Button>
        </div>
      </aside>
      <main className="flex-1 overflow-auto"><Outlet /></main>
    </div>
  );
}
