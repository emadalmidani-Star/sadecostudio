import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { LayoutDashboard, FolderKanban, Building2, FileText, LogOut, Users, LayoutTemplate, UserCircle2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useUserRole, AppRole } from "@/hooks/useUserRole";
import logoWhite from "@/assets/sadeco-logo-white.png";
import { Button } from "@/components/ui/button";

type Link = { to: string; icon: any; label: string; end?: boolean; allow?: AppRole[] };

const links: Link[] = [
  { to: "/", icon: LayoutDashboard, label: "Dashboard", end: true },
  { to: "/projects", icon: FolderKanban, label: "Projects" },
  { to: "/exports", icon: FileText, label: "Export PDFs" },
  { to: "/me", icon: UserCircle2, label: "My Profile" },
  { to: "/company", icon: Building2, label: "Company Profile", allow: ["admin"] },
  { to: "/template", icon: LayoutTemplate, label: "Template Designer", allow: ["admin"] },
  { to: "/team", icon: Users, label: "Team", allow: ["admin"] },
];

export default function AppLayout() {
  const { signOut, user } = useAuth();
  const { roles } = useUserRole();
  const visible = links.filter(l => !l.allow || l.allow.some(r => roles.includes(r)));
  const nav = useNavigate();

  return (
    <div className="min-h-screen flex bg-background">
      <aside className="w-64 luxury-gradient text-sidebar-foreground flex flex-col shrink-0">
        <div className="p-6 border-b border-sidebar-border">
          <img src={logoWhite} alt="SADECO" className="h-14 mx-auto" />
          <p className="text-center text-xs tracking-[0.3em] text-accent mt-2 font-sans">PROJECT STUDIO</p>
        </div>
        <nav className="flex-1 p-4 space-y-1">
          {visible.map(l => (
            <NavLink key={l.to} to={l.to} end={l.end}
              className={({ isActive }) =>
                `flex items-center gap-3 px-4 py-3 rounded text-sm transition-colors ${
                  isActive ? "bg-sidebar-accent text-accent" : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
                }`}>
              <l.icon className="w-4 h-4" />{l.label}
            </NavLink>
          ))}
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
