import { useEffect, useState } from "react";
import { MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { waLink } from "@/lib/whatsapp";

type Snippet = { id: string; name: string; body: string };

export default function WhatsAppButton({
  phone,
  contactName,
  size = "sm",
  variant = "ghost",
  label = "WhatsApp",
}: {
  phone: string | null | undefined;
  contactName?: string;
  size?: "sm" | "default" | "lg" | "icon";
  variant?: "default" | "ghost" | "outline" | "secondary";
  label?: string;
}) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [snippets, setSnippets] = useState<Snippet[]>([]);
  const [text, setText] = useState("");

  useEffect(() => {
    if (!open || !user) return;
    supabase
      .from("whatsapp_snippets")
      .select("id,name,body")
      .eq("user_id", user.id)
      .order("name")
      .then(({ data }) => setSnippets((data as any) || []));
  }, [open, user?.id]);

  if (!phone) return null;

  const fill = (s: Snippet) => {
    const body = s.body.replace(/\{\{\s*name\s*\}\}/gi, contactName || "");
    setText(body);
  };

  const send = () => {
    window.open(waLink(phone, text || undefined), "_blank", "noopener,noreferrer");
    setOpen(false);
    setText("");
  };

  return (
    <>
      <Button size={size} variant={variant} onClick={() => setOpen(true)} title="Open WhatsApp">
        <MessageCircle className="w-4 h-4 mr-1.5" />
        {label}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>WhatsApp {contactName || phone}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            {snippets.length > 0 && (
              <div className="space-y-1">
                <div className="text-xs text-muted-foreground">Snippets</div>
                <div className="flex flex-wrap gap-1.5">
                  {snippets.map((s) => (
                    <Button key={s.id} size="sm" variant="outline" onClick={() => fill(s)}>
                      {s.name}
                    </Button>
                  ))}
                </div>
              </div>
            )}
            <Textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Type your message (optional)…"
              rows={5}
            />
            <p className="text-xs text-muted-foreground">
              This opens WhatsApp on your phone or web with the message pre-filled. You tap send.
            </p>
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
              <Button onClick={send}>
                <MessageCircle className="w-4 h-4 mr-1.5" />
                Open WhatsApp
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
