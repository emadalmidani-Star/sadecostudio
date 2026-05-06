import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Mail, Trash2, UserPlus, ShieldCheck } from "lucide-react";
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

  async function sendInvite(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const { error } = await supabase.from("invitations").insert({
      email: email.toLowerCase().trim(), role, invited_by: user?.id,
    });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success(`Invitation saved for ${email}. They'll get the role on signup.`);
    setEmail(""); setRole("user"); load();
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

  return (
    <div className="p-10 max-w-5xl mx-auto">
      <p className="text-xs tracking-[0.3em] text-accent mb-2">ACCESS</p>
      <h1 className="font-serif text-5xl mb-8">Team</h1>

      <Card className="p-6 mb-8">
        <h2 className="font-serif text-xl mb-4 flex items-center gap-2"><UserPlus className="w-5 h-5 text-accent" /> Invite a team member</h2>
        <form onSubmit={sendInvite} className="grid md:grid-cols-[1fr_180px_auto] gap-3 items-end">
          <div><Label>Email</Label><Input type="email" required value={email} onChange={e => setEmail(e.target.value)} placeholder="name@sadeco.com" /></div>
          <div><Label>Role</Label>
            <Select value={role} onValueChange={v => setRole(v as Role)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="user">Member</SelectItem>
                <SelectItem value="admin">Admin</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button disabled={busy} type="submit"><Mail className="w-4 h-4 mr-2" />Send Invite</Button>
        </form>
        <p className="text-xs text-muted-foreground mt-3">
          Invited users receive their assigned role automatically when they create an account with this email address.
        </p>
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

      <h2 className="font-serif text-xl mb-3">Pending invitations ({invites.filter(i => !i.accepted).length})</h2>
      <Card className="divide-y">
        {invites.filter(i => !i.accepted).length === 0 ? (
          <div className="p-6 text-sm text-muted-foreground text-center">No pending invitations.</div>
        ) : invites.filter(i => !i.accepted).map(i => (
          <div key={i.id} className="p-4 flex justify-between items-center">
            <div>
              <p className="font-medium">{i.email}</p>
              <p className="text-xs text-muted-foreground capitalize">Role: {i.role} · Sent {new Date(i.created_at).toLocaleDateString()}</p>
            </div>
            <Button variant="ghost" size="sm" onClick={() => cancelInvite(i.id)}>Cancel</Button>
          </div>
        ))}
      </Card>
    </div>
  );
}
