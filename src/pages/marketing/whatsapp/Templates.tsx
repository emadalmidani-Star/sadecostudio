import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RefreshCw } from "lucide-react";
import { toast } from "@/hooks/use-toast";

type Tpl = {
  id: string;
  name: string;
  language: string;
  status: string;
  category: string | null;
  body: string;
  variables: string[];
};

export default function WhatsAppTemplates() {
  const { user } = useAuth();
  const [rows, setRows] = useState<Tpl[]>([]);
  const [syncing, setSyncing] = useState(false);

  async function load() {
    if (!user) return;
    const { data } = await supabase
      .from("whatsapp_templates")
      .select("*")
      .eq("user_id", user.id)
      .order("name");
    setRows((data as any) || []);
  }
  useEffect(() => {
    load();
  }, [user?.id]);

  async function sync() {
    setSyncing(true);
    const { data, error } = await supabase.functions.invoke("whatsapp-templates-sync", {});
    setSyncing(false);
    if (error || (data as any)?.error) {
      return toast({
        title: "Sync failed",
        description: error?.message || (data as any)?.error,
        variant: "destructive",
      });
    }
    toast({ title: `Synced ${(data as any).synced} templates` });
    load();
  }

  return (
    <div className="p-6 space-y-6 max-w-5xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-serif text-3xl">WhatsApp Templates</h1>
          <p className="text-sm text-muted-foreground">
            Approved templates from Meta. Templates must be created and approved in your Meta Business account, then
            synced here. Only APPROVED templates can be sent in campaigns.
          </p>
        </div>
        <Button variant="outline" onClick={sync} disabled={syncing}>
          <RefreshCw className={`w-4 h-4 mr-1.5 ${syncing ? "animate-spin" : ""}`} /> Sync from Meta
        </Button>
      </div>

      <Card>
        <CardContent className="pt-6 space-y-3">
          {rows.map((t) => (
            <div key={t.id} className="border rounded-md p-3 space-y-2">
              <div className="flex items-center gap-2">
                <div className="font-medium">{t.name}</div>
                <Badge variant="outline" className="text-[10px] uppercase">
                  {t.language}
                </Badge>
                {t.category && (
                  <Badge variant="outline" className="text-[10px] uppercase">
                    {t.category}
                  </Badge>
                )}
                <Badge
                  className="text-[10px] uppercase"
                  variant={t.status === "APPROVED" ? "default" : "secondary"}
                >
                  {t.status}
                </Badge>
              </div>
              <pre className="text-xs bg-muted/40 p-2 rounded whitespace-pre-wrap font-sans">{t.body}</pre>
              {t.variables?.length > 0 && (
                <div className="text-xs text-muted-foreground">
                  Variables: {t.variables.map((v) => `{{${v}}}`).join(", ")}
                </div>
              )}
            </div>
          ))}
          {rows.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-8">
              No templates yet. Create them in Meta Business Manager → WhatsApp → Message Templates, then click
              "Sync from Meta".
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
