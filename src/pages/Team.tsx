import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Mail, Trash2, UserPlus, ShieldCheck, Copy, Link2, AlertCircle, Clock, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

type Role = "admin" | "user";

export default function Team() {
  const { user } = useAuth();
  const [isAdmin, setIsAdmin] = useState(false);
  const [members, setMembers] = useState<any[]>([]);
  const [invites, setInvites] = useState<any[]>([]);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<Role>("user");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [lastInvite, setLastInvite] = useState<{ email: string; link: string; emailSent: boolean } | null>(null);
  const [lastError, setLastError] = useState<string | null>(null);

  // Email sending is disabled until an email domain is configured.
  // When you set one up + add a 'send-invite-email' edge function, flip this to true.
  const EMAIL_SENDING_ENABLED = false;

  useEffect(() => { if (user) load(); }, [user]);

  async function load() {
    setLoading(true);
    const { data: roles } = await supabase.from("user_roles").select("*");
    const { data: profiles } = await supabase.from("profiles").select("*");
    const { data: inv } = await supabase.from("invitations").select("*").order("created_at", { ascending: false });
    const merged = (profiles || []).map(p => ({
      ...p,
      role: (roles || []).find(r => r.user_id === p.id)?.role || "user",
      role_id: (roles || []).find(r => r.user_id === p.id)?.id,
    }));
    setMembers(merged);
    setInvites(inv || []);
    setIsAdmin(!!(roles || []).find(r => r.user_id === user?.id && r.role === "admin"));
    setLoading(false);
  }

  function buildInviteLink(forEmail: string) {
    return `${window.location.origin}/auth?invite=${encodeURIComponent(forEmail)}`;
  }

  async function sendInvite(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setLastError(null);
    const cleanEmail = email.toLowerCase().trim();

    const { error } = await supabase.from("invitations").upsert(
      { email: cleanEmail, role, invited_by: user?.id, accepted: false },
      { onConflict: "email" }
    );

    if (error) {
      console.error("[invite] insert failed", error);
      setLastError(`${error.code || "error"}: ${error.message}${error.details ? ` — ${error.details}` : ""}${error.hint ? ` (${error.hint})` : ""}`);
      toast.error(error.message);
      setBusy(false);
      return;
    }

    const link = buildInviteLink(cleanEmail);
    let emailSent = false;

    if (EMAIL_SENDING_ENABLED) {
      try {
        const { error: fnErr } = await supabase.functions.invoke("send-invite-email", {
          body: { email: cleanEmail, role, inviteLink: link },
        });
        if (fnErr) throw fnErr;
        emailSent = true;
      } catch (err: any) {
        console.error("[invite] email send failed", err);
        toast.warning("Invite saved, but email failed to send. Share the link manually.");
      }
    }

    setLastInvite({ email: cleanEmail, link, emailSent });
    toast.success(
      emailSent
        ? `Invite emailed to ${cleanEmail}`
        : `Invite created for ${cleanEmail}. Copy and share the link below.`
    );
    setEmail("");
    setRole("user");
    setBusy(false);
    load();
  }

  async function copyLink(link: string) {
    await navigator.clipboard.writeText(link);
    toast.success("Link copied");
  }

  async function changeRole(roleId: string, newRole: Role) {
    const { error } = await supabase.from("user_roles").update({ role: newRole }).eq("id", roleId);
    if (error) return toast.error(error.message);
    toast.success("Role updated"); load();
  }

  async function removeMember(roleId: string) {
    if (!confirm("Revoke this member's access?")) return;
    const { error } = await supabase.from("user_roles").delete().eq("id", roleId);
    if (error) return toast.error(error.message);
    toast.success("Access revoked"); load();
  }

  async function cancelInvite(id: string) {
    await supabase.from("invitations").delete().eq("id", id);
    toast.success("Invitation cancelled"); load();
  }

  if (loading) return <div className="p-10 text-muted-foreground">Loading…</div>;

  if (!isAdmin) {
    return (
      <div className="p-10 max-w-3xl mx-auto">
        <h1 className="font-serif text-4xl mb-2">Team</h1>
        <Card className="p-8 mt-6 text-center border-dashed">
          <ShieldCheck className="w-10 h-10 mx-auto text-muted-foreground mb-3" />
          <p className="text-muted-foreground">Only administrators can manage the team. Ask an admin to grant you access.</p>
        </Card>
        <h2 className="font-serif text-xl mt-10 mb-3">Current members</h2>
        <Card className="divide-y">
          {members.map(m => (
            <div key={m.id} className="p-4 flex justify-between items-center">
              <div>
                <p className="font-medium">{m.full_name || m.email}</p>
                <p className="text-xs text-muted-foreground">{m.email}</p>
              </div>
              <Badge variant={m.role === "admin" ? "default" : "secondary"} className="capitalize">{m.role}</Badge>
            </div>
          ))}
        </Card>
      </div>
    );
  }

  const pending = invites.filter(i => !i.accepted);

  return (
    <div className="p-10 max-w-5xl mx-auto">
      <p className="text-xs tracking-[0.3em] text-accent mb-2">ACCESS</p>
      <h1 className="font-serif text-5xl mb-8">Team</h1>

      <Card className="p-6 mb-6">
        <h2 className="font-serif text-xl mb-4 flex items-center gap-2"><UserPlus className="w-5 h-5 text-accent" /> Invite a team member</h2>
        <form onSubmit={sendInvite} className="grid md:grid-cols-[1fr_180px_auto] gap-3 items-end">
          <div><Label>Email</Label><Input type="email" required value={email} onChange={e => setEmail(e.target.value)} placeholder="name@sadeco.com" /></div>
          <div><Label>Role</Label>
            <Select value={role} onValueChange={v => setRole(v as Role)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="user">Member</SelectItem>
                <SelectItem value="manager">Manager</SelectItem>
                <SelectItem value="admin">Admin</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button disabled={busy} type="submit">
            {EMAIL_SENDING_ENABLED ? <Mail className="w-4 h-4 mr-2" /> : <Link2 className="w-4 h-4 mr-2" />}
            {busy ? "Working…" : EMAIL_SENDING_ENABLED ? "Send Invite" : "Create Invite Link"}
          </Button>
        </form>

        {!EMAIL_SENDING_ENABLED && (
          <div className="mt-4 flex gap-2 text-xs text-muted-foreground p-3 rounded-md bg-muted/40 border border-border">
            <AlertCircle className="w-4 h-4 mt-0.5 shrink-0 text-accent" />
            <p>
              Email sending isn't configured yet. Inviting now creates a record and a shareable signup link — copy it
              and send it to the person yourself. Once they sign up with the same email, they'll automatically receive
              their assigned role.
            </p>
          </div>
        )}

        {lastError && (
          <div className="mt-4 flex gap-2 text-xs p-3 rounded-md bg-destructive/10 border border-destructive/30 text-destructive">
            <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
            <div>
              <p className="font-medium mb-0.5">Invite failed</p>
              <code className="font-mono break-all">{lastError}</code>
            </div>
          </div>
        )}

        {lastInvite && (
          <div className="mt-4 p-4 rounded-md border border-accent/30 bg-accent/5">
            <p className="text-xs tracking-widest text-accent mb-2">SHAREABLE LINK FOR {lastInvite.email.toUpperCase()}</p>
            <div className="flex gap-2">
              <Input readOnly value={lastInvite.link} className="font-mono text-xs" onFocus={e => e.currentTarget.select()} />
              <Button type="button" variant="outline" onClick={() => copyLink(lastInvite.link)}>
                <Copy className="w-4 h-4 mr-2" />Copy
              </Button>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              {lastInvite.emailSent
                ? "Email sent. They can also use this direct link."
                : "Share this link with the invitee. They must sign up using exactly this email address to receive their role."}
            </p>
          </div>
        )}
      </Card>

      <h2 className="font-serif text-xl mb-3">Members ({members.length})</h2>
      <Card className="divide-y mb-10">
        {members.map(m => (
          <div key={m.id} className="p-4 flex flex-wrap gap-3 justify-between items-center">
            <div className="min-w-0">
              <p className="font-medium truncate">{m.full_name || m.email}</p>
              <p className="text-xs text-muted-foreground truncate">{m.email}</p>
            </div>
            <div className="flex items-center gap-2">
              <Select value={m.role} onValueChange={(v) => changeRole(m.role_id, v as Role)} disabled={m.id === user?.id}>
                <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="user">Member</SelectItem>
                  <SelectItem value="manager">Manager</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                </SelectContent>
              </Select>
              <Button variant="ghost" size="icon" onClick={() => removeMember(m.role_id)} disabled={m.id === user?.id}>
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          </div>
        ))}
      </Card>

      <h2 className="font-serif text-xl mb-3">Invitations ({pending.length} pending)</h2>
      <Card className="divide-y">
        {invites.length === 0 ? (
          <div className="p-6 text-sm text-muted-foreground text-center">No invitations yet.</div>
        ) : invites.map(i => {
          const link = buildInviteLink(i.email);
          return (
            <div key={i.id} className="p-4 flex flex-wrap gap-3 justify-between items-center">
              <div className="min-w-0">
                <p className="font-medium truncate flex items-center gap-2">
                  {i.email}
                  {i.accepted ? (
                    <Badge variant="secondary" className="gap-1"><CheckCircle2 className="w-3 h-3" /> Accepted</Badge>
                  ) : EMAIL_SENDING_ENABLED ? (
                    <Badge variant="default" className="gap-1"><Mail className="w-3 h-3" /> Email sent</Badge>
                  ) : (
                    <Badge variant="outline" className="gap-1"><Clock className="w-3 h-3" /> Pending signup</Badge>
                  )}
                </p>
                <p className="text-xs text-muted-foreground capitalize">
                  Role: {i.role} · {new Date(i.created_at).toLocaleDateString()}
                </p>
              </div>
              <div className="flex gap-2">
                {!i.accepted && (
                  <Button variant="outline" size="sm" onClick={() => copyLink(link)}>
                    <Copy className="w-3 h-3 mr-1" />Copy link
                  </Button>
                )}
                {!i.accepted && (
                  <Button variant="ghost" size="sm" onClick={() => cancelInvite(i.id)}>Cancel</Button>
                )}
              </div>
            </div>
          );
        })}
      </Card>
    </div>
  );
}
