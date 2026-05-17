import { useEffect, useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { LayoutDashboard, FolderKanban, Building2, FileText, LogOut, Users, LayoutTemplate, UserCircle2, ShieldCheck, QrCode, Hammer, BarChart3, HardHat, PanelLeftClose, PanelLeftOpen, Search, UserCog, ChevronDown } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useUserRole, PageKey } from "@/hooks/useUserRole";
import logoWhite from "@/assets/sadeco-logo-white.png";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import CommandPalette from "@/components/CommandPalette";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

type Link = { to: string; icon: any; label: string; end?: boolean; page?: PageKey; adminOnly?: boolean; group?: string };

const links: Link[] = [
  { to: "/", icon: LayoutDashboard, label: "Overview", end: true },
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
  { to: "/fitout/managers", icon: UserCog, label: "Project Managers", page: "fitout", group: "Fitout Operations" },
  { to: "/permissions", icon: ShieldCheck, label: "Permissions", adminOnly: true },
];

const LS_KEY = "sadeco.sidebar.collapsed.v2";
const LS_GROUPS_KEY = "sadeco.sidebar.groups";

export default function AppLayout() {
  const { signOut, user } = useAuth();
  const { canAccess, isAdmin, loading } = useUserRole();
  const nav = useNavigate();
  const loc = useLocation();

  const [collapsed, setCollapsed] = useState<boolean>(() => {
    const stored = typeof window !== "undefined" ? localStorage.getItem(LS_KEY) : null;
    if (stored !== null) return stored === "1";
    return false;
  });
  useEffect(() => { localStorage.setItem(LS_KEY, collapsed ? "1" : "0"); }, [collapsed]);

  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(() => {
    try {
      const stored = typeof window !== "undefined" ? localStorage.getItem(LS_GROUPS_KEY) : null;
      return stored ? JSON.parse(stored) : {};
    } catch { return {}; }
  });
  useEffect(() => { localStorage.setItem(LS_GROUPS_KEY, JSON.stringify(openGroups)); }, [openGroups]);

  const visible = links.filter(l => {
    if (l.adminOnly) return isAdmin;
    if (!l.page) return true;
    return canAccess(l.page);
  });

  const renderLink = (l: Link) => {
    const node = (
      <NavLink key={l.to} to={l.to} end={l.end}
        className={({ isActive }) =>
          cn(
            "group flex items-center gap-3 px-4 py-2.5 rounded text-sm transition-colors border-l-2",
            isActive
              ? "bg-sidebar-accent text-accent border-accent"
              : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground border-transparent",
            collapsed && "justify-center px-2",
          )
        }>
        <l.icon className="w-4 h-4 shrink-0" />
        {!collapsed && <span className="truncate">{l.label}</span>}
      </NavLink>
    );
    return (
      <Tooltip key={l.to} delayDuration={200}>
        <TooltipTrigger asChild>{node}</TooltipTrigger>
        <TooltipContent side="right">{l.label}</TooltipContent>
      </Tooltip>
    );
  };

  const ungrouped = visible.filter(l => !l.group);
  const groups = visible.reduce<Record<string, Link[]>>((acc, l) => {
    if (l.group) (acc[l.group] = acc[l.group] || []).push(l);
    return acc;
  }, {});

  return (
    <div className="min-h-screen flex bg-background">
      <CommandPalette />
      <aside className={cn(
        "luxury-gradient text-sidebar-foreground flex flex-col shrink-0 transition-[width] duration-200",
        collapsed ? "w-16" : "w-64",
      )}>
        <div className="p-4 border-b border-sidebar-border flex items-center justify-between gap-2">
          {!collapsed ? (
            <div className="flex-1 min-w-0">
              <img src={logoWhite} alt="SADECO" className="h-12 mx-auto" />
              <p className="text-center text-[10px] tracking-[0.3em] text-accent mt-1 font-sans">PROJECT STUDIO</p>
            </div>
          ) : (
            <img src={logoWhite} alt="SADECO" className="h-7 mx-auto" />
          )}
          <button
            onClick={() => setCollapsed(v => !v)}
            className="p-1.5 rounded text-sidebar-foreground/60 hover:text-accent hover:bg-sidebar-accent/40"
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {collapsed ? <PanelLeftOpen className="w-4 h-4" /> : <PanelLeftClose className="w-4 h-4" />}
          </button>
        </div>

        <nav className="flex-1 p-2 space-y-0.5 overflow-y-auto">
          {!loading && (
            <>
              {!collapsed && (
                <p className="px-4 pt-3 pb-2 text-[10px] tracking-[0.25em] text-sidebar-foreground/40 uppercase">Project Studio</p>
              )}
              {ungrouped.map(renderLink)}

              {Object.entries(groups).map(([name, items]) => {
                const hasActive = items.some(i => i.end ? loc.pathname === i.to : loc.pathname.startsWith(i.to));
                const isOpen = collapsed ? true : (openGroups[name] ?? hasActive ?? true);
                if (collapsed) {
                  return (
                    <div key={name} className="pt-3 mt-3 border-t border-sidebar-border/60">
                      {items.map(renderLink)}
                    </div>
                  );
                }
                return (
                  <Collapsible key={name} open={isOpen} onOpenChange={(v) => setOpenGroups(g => ({ ...g, [name]: v }))}>
                    <div className="pt-3 mt-3 border-t border-sidebar-border/60">
                      <CollapsibleTrigger className="w-full flex items-center justify-between px-4 pb-2 text-[10px] tracking-[0.25em] text-sidebar-foreground/40 uppercase hover:text-sidebar-foreground/70">
                        <span>{name}</span>
                        <ChevronDown className={cn("w-3.5 h-3.5 transition-transform", isOpen ? "" : "-rotate-90")} />
                      </CollapsibleTrigger>
                      <CollapsibleContent className="space-y-0.5">
                        {items.map(renderLink)}
                      </CollapsibleContent>
                    </div>
                  </Collapsible>
                );
              })}
            </>
          )}
        </nav>

        <div className="p-2 border-t border-sidebar-border space-y-1">
          {!collapsed && (
            <button
              onClick={() => {
                const ev = new KeyboardEvent("keydown", { key: "k", metaKey: true });
                window.dispatchEvent(ev);
              }}
              className="w-full flex items-center gap-2 px-3 py-1.5 text-xs rounded text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent/40"
            >
              <Search className="w-3.5 h-3.5" />
              Quick search
              <span className="ml-auto text-[10px] border border-sidebar-border rounded px-1.5 py-0.5">⌘K</span>
            </button>
          )}
          {!collapsed && (
            <div className="text-[11px] text-sidebar-foreground/50 px-3 truncate">{user?.email}</div>
          )}
          <Tooltip delayDuration={200}>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="sm" onClick={async () => { await signOut(); nav("/auth"); }}
                className={cn(
                  "w-full text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent",
                  collapsed ? "justify-center" : "justify-start",
                )}>
                <LogOut className="w-4 h-4" />{!collapsed && <span className="ml-2">Sign out</span>}
              </Button>
            </TooltipTrigger>
            <TooltipContent side="right">Sign out</TooltipContent>
          </Tooltip>
        </div>
      </aside>

      <main className="flex-1 overflow-auto">
        <div key={loc.pathname} className="animate-fade-in">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
