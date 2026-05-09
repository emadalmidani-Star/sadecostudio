import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { ALL_PAGES, ALL_ROLES, AppRole, PageKey } from "@/hooks/useUserRole";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { ShieldCheck } from "lucide-react";

type Row = { role: AppRole; page: PageKey; allowed: boolean };

export default function Permissions() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { (async () => {
    const { data, error } = await supabase.from("role_page_permissions").select("role,page,allowed");
    if (error) toast.error(error.message);
    setRows((data || []) as Row[]);
    setLoading(false);
  })(); }, []);

  function get(role: AppRole, page: PageKey) {
    return rows.find(r => r.role === role && r.page === page)?.allowed ?? false;
  }

  async function toggle(role: AppRole, page: PageKey, value: boolean) {
    setRows(prev => {
      const exists = prev.find(r => r.role === role && r.page === page);
      if (exists) return prev.map(r => r === exists ? { ...r, allowed: value } : r);
      return [...prev, { role, page, allowed: value }];
    });
    const { error } = await supabase.from("role_page_permissions")
      .upsert({ role, page, allowed: value }, { onConflict: "role,page" });
    if (error) {
      toast.error(error.message);
      // revert
      setRows(prev => prev.map(r => r.role === role && r.page === page ? { ...r, allowed: !value } : r));
    }
  }

  if (loading) return <div className="p-10 text-muted-foreground">Loading…</div>;

  return (
    <div className="p-10 max-w-5xl mx-auto">
      <div className="flex items-center gap-3 mb-2">
        <ShieldCheck className="w-5 h-5 text-accent" />
        <p className="text-xs tracking-[0.3em] text-accent">ACCESS CONTROL</p>
      </div>
      <h1 className="font-serif text-5xl mb-2">Permissions</h1>
      <p className="text-muted-foreground mb-8">Toggle which pages each role can access. Changes apply immediately for new sessions.</p>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="text-left p-4 font-medium">Page</th>
                {ALL_ROLES.map(r => (
                  <th key={r} className="p-4 text-center font-medium capitalize">{r}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {ALL_PAGES.map(p => (
                <tr key={p.key} className="border-t border-border">
                  <td className="p-4 font-medium">{p.label}</td>
                  {ALL_ROLES.map(role => (
                    <td key={role} className="p-4 text-center">
                      <Switch
                        checked={get(role, p.key)}
                        disabled={role === "admin"}
                        onCheckedChange={(v) => toggle(role, p.key, v)}
                      />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-muted-foreground p-4 border-t border-border">
          Admin always has full access (locked). Only admins can edit this table.
        </p>
      </Card>
    </div>
  );
}
