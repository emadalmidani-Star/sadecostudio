import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/hooks/use-toast";
import { Send } from "lucide-react";

type Conv = {
  id: string;
  phone: string;
  display_name: string | null;
  last_message_at: string;
  last_message_preview: string | null;
  last_inbound_at: string | null;
  unread_count: number;
};
type Msg = {
  id: string;
  conversation_id: string;
  direction: "in" | "out";
  body: string | null;
  status: string | null;
  created_at: string;
  template_name: string | null;
};

export default function WhatsAppInbox() {
  const { user } = useAuth();
  const [conversations, setConversations] = useState<Conv[]>([]);
  const [active, setActive] = useState<Conv | null>(null);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  async function load() {
    if (!user) return;
    const { data } = await supabase
      .from("whatsapp_conversations")
      .select("*")
      .eq("user_id", user.id)
      .order("last_message_at", { ascending: false });
    setConversations((data as any) || []);
  }
  useEffect(() => {
    load();
  }, [user?.id]);

  useEffect(() => {
    if (!user?.id) return;
    const ch = supabase
      .channel(`wa-inbox-${user.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "whatsapp_messages", filter: `user_id=eq.${user.id}` },
        (payload) => {
          if (active && (payload.new as any)?.conversation_id === active.id) {
            setMessages((prev) => {
              const ex = prev.find((m) => m.id === (payload.new as any).id);
              if (ex) return prev.map((m) => (m.id === ex.id ? (payload.new as any) : m));
              return [...prev, payload.new as any];
            });
          }
          load();
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [user?.id, active?.id]);

  async function openConv(c: Conv) {
    setActive(c);
    const { data } = await supabase
      .from("whatsapp_messages")
      .select("*")
      .eq("conversation_id", c.id)
      .order("created_at");
    setMessages((data as any) || []);
    if (c.unread_count > 0) {
      await supabase.from("whatsapp_conversations").update({ unread_count: 0 }).eq("id", c.id);
      load();
    }
    setTimeout(() => endRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
  }

  async function send() {
    if (!active || !body.trim()) return;
    setSending(true);
    const { data, error } = await supabase.functions.invoke("whatsapp-send", {
      body: { to: active.phone, text: body },
    });
    if (error || (data as any)?.error) {
      setSending(false);
      return toast({
        title: "Send failed",
        description: error?.message || (data as any)?.error,
        variant: "destructive",
      });
    }
    await supabase.from("whatsapp_messages").insert({
      user_id: user!.id,
      conversation_id: active.id,
      direction: "out",
      body,
      status: "sent",
      wa_message_id: (data as any).message_id,
    });
    await supabase
      .from("whatsapp_conversations")
      .update({
        last_message_at: new Date().toISOString(),
        last_message_preview: body.slice(0, 200),
      })
      .eq("id", active.id);
    setBody("");
    setSending(false);
    openConv(active);
  }

  const within24h = active?.last_inbound_at
    ? Date.now() - new Date(active.last_inbound_at).getTime() < 24 * 60 * 60 * 1000
    : false;

  return (
    <div className="p-6 max-w-6xl">
      <div className="mb-4">
        <h1 className="font-serif text-3xl">WhatsApp Inbox</h1>
        <p className="text-sm text-muted-foreground">
          Reply to clients in real-time. Free-form replies allowed within 24h of last incoming message; outside the
          window you must send an approved template.
        </p>
      </div>
      <div className="grid grid-cols-[280px_1fr] border rounded-lg overflow-hidden h-[70vh]">
        <div className="border-r overflow-y-auto bg-muted/20">
          {conversations.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-8">No conversations yet.</p>
          )}
          {conversations.map((c) => (
            <button
              key={c.id}
              onClick={() => openConv(c)}
              className={`w-full text-left p-3 border-b hover:bg-muted ${
                active?.id === c.id ? "bg-accent/15" : ""
              }`}
            >
              <div className="flex items-center gap-2">
                <div className="font-medium truncate flex-1">{c.display_name || c.phone}</div>
                {c.unread_count > 0 && (
                  <span className="text-[10px] bg-accent text-accent-foreground px-1.5 py-0.5 rounded-full">
                    {c.unread_count}
                  </span>
                )}
              </div>
              <div className="text-xs text-muted-foreground truncate">{c.last_message_preview}</div>
            </button>
          ))}
        </div>
        <div className="flex flex-col">
          {active ? (
            <>
              <div className="p-3 border-b">
                <div className="font-medium">{active.display_name || active.phone}</div>
                <div className="text-xs text-muted-foreground font-mono">{active.phone}</div>
              </div>
              <div className="flex-1 overflow-y-auto p-4 space-y-2 bg-muted/10">
                {messages.map((m) => (
                  <div
                    key={m.id}
                    className={`max-w-[70%] rounded-lg p-2.5 text-sm ${
                      m.direction === "out"
                        ? "ml-auto bg-accent/20 border border-accent/30"
                        : "bg-card border"
                    }`}
                  >
                    <div>{m.body}</div>
                    <div className="text-[10px] text-muted-foreground mt-1">
                      {new Date(m.created_at).toLocaleString()}
                      {m.status && ` · ${m.status}`}
                      {m.template_name && ` · template:${m.template_name}`}
                    </div>
                  </div>
                ))}
                <div ref={endRef} />
              </div>
              <div className="p-3 border-t space-y-2">
                {!within24h && (
                  <p className="text-[11px] text-amber-600">
                    Outside 24h window — free-text replies may be blocked by Meta. Use a template via Campaigns
                    instead.
                  </p>
                )}
                <div className="flex gap-2">
                  <Textarea
                    rows={2}
                    value={body}
                    onChange={(e) => setBody(e.target.value)}
                    placeholder="Type a message…"
                  />
                  <Button onClick={send} disabled={sending || !body.trim()}>
                    <Send className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground">
              Select a conversation
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
