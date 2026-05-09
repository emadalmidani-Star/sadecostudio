import { Navigate } from "react-router-dom";
import { useUserRole, AppRole } from "@/hooks/useUserRole";

export default function RoleRoute({ allow, children }: { allow: AppRole[]; children: React.ReactNode }) {
  const { roles, loading } = useUserRole();
  if (loading) return <div className="min-h-screen flex items-center justify-center text-muted-foreground">Checking access…</div>;
  const ok = roles.some((r) => allow.includes(r));
  if (!ok) return <Navigate to="/" replace />;
  return <>{children}</>;
}
