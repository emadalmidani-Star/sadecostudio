import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useUserRole, PageKey } from "@/hooks/useUserRole";
import { ShieldAlert } from "lucide-react";

export default function RoleRoute({ page, children }: { page: PageKey; children: React.ReactNode }) {
  const { canAccess, loading } = useUserRole();
  const nav = useNavigate();
  const [count, setCount] = useState(4);

  const allowed = !loading && canAccess(page);
  const denied = !loading && !allowed;

  useEffect(() => {
    if (!denied) return;
    const id = setInterval(() => setCount((c) => c - 1), 1000);
    const t = setTimeout(() => nav("/", { replace: true }), 4000);
    return () => { clearInterval(id); clearTimeout(t); };
  }, [denied, nav]);

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center text-muted-foreground">Checking access…</div>;
  }
  if (denied) {
    return (
      <div className="min-h-screen flex items-center justify-center p-10">
        <div className="max-w-md text-center space-y-4">
          <div className="mx-auto w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center">
            <ShieldAlert className="w-8 h-8 text-destructive" />
          </div>
          <h1 className="font-serif text-3xl">Access denied</h1>
          <p className="text-muted-foreground">
            You don't have permission to view this page. Ask an admin to grant your role access from the Permissions page.
          </p>
          <p className="text-xs text-muted-foreground">
            Redirecting to Dashboard in {Math.max(count, 0)}s…
          </p>
          <button onClick={() => nav("/", { replace: true })} className="text-sm underline text-primary">
            Go to Dashboard now
          </button>
        </div>
      </div>
    );
  }
  return <>{children}</>;
}
