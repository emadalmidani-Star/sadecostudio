import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export type AppRole = "admin" | "user" | "marketing";
export type PageKey = "dashboard" | "projects" | "gallery" | "exports" | "company" | "template" | "team" | "me" | "idcards" | "fitout" | "marketing" | "leads" | "meetings" | "email_marketing";

export const ALL_ROLES: AppRole[] = ["admin", "user", "marketing"];
export const ALL_PAGES: { key: PageKey; label: string }[] = [
  { key: "dashboard", label: "Dashboard" },
  { key: "projects", label: "Projects" },
  { key: "gallery", label: "Project Gallery" },
  { key: "exports", label: "Export PDFs" },
  { key: "me", label: "My Profile" },
  { key: "idcards", label: "Team ID Cards" },
  { key: "company", label: "Company Profile" },
  { key: "template", label: "Template Designer" },
  { key: "team", label: "Team" },
  { key: "fitout", label: "Fitout Tracker" },
  { key: "marketing", label: "Marketing" },
  { key: "leads", label: "Marketing Leads" },
  { key: "meetings", label: "Meetings" },
  { key: "email_marketing", label: "Email Marketing" },
  { key: "whatsapp", label: "WhatsApp Messaging" },
];

type PermRow = { role: AppRole; page: PageKey; allowed: boolean };

export function useUserRole() {
  const { user } = useAuth();
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [perms, setPerms] = useState<PermRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    (async () => {
      if (!user) { setRoles([]); setPerms([]); setLoading(false); return; }
      const [{ data: r }, { data: p }] = await Promise.all([
        supabase.from("user_roles").select("role").eq("user_id", user.id),
        supabase.from("role_page_permissions").select("role,page,allowed"),
      ]);
      if (!active) return;
      setRoles((r || []).map((x: any) => x.role as AppRole));
      setPerms((p || []) as PermRow[]);
      setLoading(false);
    })();
    return () => { active = false; };
  }, [user]);

  const canAccess = (page: PageKey) =>
    roles.some((role) => perms.some((p) => p.role === role && p.page === page && p.allowed));

  return {
    roles,
    perms,
    loading,
    isAdmin: roles.includes("admin"),
    canAccess,
  };
}
