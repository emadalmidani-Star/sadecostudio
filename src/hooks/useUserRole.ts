import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export type AppRole = "admin" | "moderator" | "user";

export function useUserRole() {
  const { user } = useAuth();
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    (async () => {
      if (!user) { setRoles([]); setLoading(false); return; }
      const { data } = await supabase.from("user_roles").select("role").eq("user_id", user.id);
      if (!active) return;
      setRoles((data || []).map((r: any) => r.role as AppRole));
      setLoading(false);
    })();
    return () => { active = false; };
  }, [user]);

  const has = (r: AppRole) => roles.includes(r);
  return { roles, loading, isAdmin: has("admin"), isModerator: has("moderator"), has };
}
