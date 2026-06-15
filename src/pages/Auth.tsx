import { useEffect, useState } from "react";
import { Link, Navigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import logo from "@/assets/sadeco-logo-white.png";

export default function Auth() {
  const { user, loading } = useAuth();
  const [params] = useSearchParams();
  const invitedEmail = params.get("invite") || "";
  const [email, setEmail] = useState(invitedEmail);
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [tab, setTab] = useState(invitedEmail ? "signup" : "signin");

  useEffect(() => { if (invitedEmail) setEmail(invitedEmail); }, [invitedEmail]);

  if (loading) return null;
  if (user) return <Navigate to="/" replace />;

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault(); setBusy(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setBusy(false);
    if (error) toast.error(error.message); else toast.success("Welcome back");
  };
  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault(); setBusy(true);
    const { error } = await supabase.auth.signUp({
      email, password,
      options: { emailRedirectTo: `${window.location.origin}/`, data: { full_name: name } }
    });
    setBusy(false);
    if (error) toast.error(error.message); else toast.success("Account created — you're in.");
  };

  return (
    <div className="min-h-screen grid lg:grid-cols-2">
      <div className="hidden lg:flex luxury-gradient items-center justify-center p-12 relative overflow-hidden">
        <div className="absolute inset-0 opacity-10 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-accent to-transparent" />
        <div className="relative z-10 max-w-md text-center">
          <img src={logo} alt="SADECO Decor LLC" className="w-64 mx-auto mb-8 opacity-95" />
          <h1 className="font-serif text-4xl text-primary-foreground mb-4">Project & Profile Studio</h1>
          <p className="text-primary-foreground/70 leading-relaxed">
            Internal platform for SADECO to craft client-ready company profiles and project portfolios in one click.
          </p>
        </div>
      </div>
      <div className="flex items-center justify-center p-8">
        <div className="w-full max-w-md">
          <h2 className="font-serif text-3xl mb-2">Internal Access</h2>
          <p className="text-muted-foreground mb-8 text-sm">SADECO team members only</p>
          {invitedEmail && (
            <div className="mb-4 p-3 rounded-md bg-accent/10 border border-accent/30 text-xs text-accent">
              You've been invited. Create your account with <strong>{invitedEmail}</strong> to receive your assigned role.
            </div>
          )}
          <Tabs value={tab} onValueChange={setTab}>
            <TabsList className="grid grid-cols-2 w-full mb-6">
              <TabsTrigger value="signin">Sign In</TabsTrigger>
              <TabsTrigger value="signup">Create Account</TabsTrigger>
            </TabsList>
            <TabsContent value="signin">
              <form onSubmit={handleSignIn} className="space-y-4">
                <div><Label>Email</Label><Input type="email" required value={email} onChange={e => setEmail(e.target.value)} /></div>
                <div><Label>Password</Label><Input type="password" required value={password} onChange={e => setPassword(e.target.value)} /></div>
                <div className="flex justify-end">
                  <Link to="/forgot-password" className="text-xs text-muted-foreground hover:text-accent transition-colors">
                    Forgot password?
                  </Link>
                </div>
                <Button disabled={busy} className="w-full" type="submit">{busy ? "Signing in..." : "Sign In"}</Button>
              </form>
            </TabsContent>
            <TabsContent value="signup">
              <form onSubmit={handleSignUp} className="space-y-4">
                <div><Label>Full Name</Label><Input required value={name} onChange={e => setName(e.target.value)} /></div>
                <div><Label>Email</Label><Input type="email" required value={email} onChange={e => setEmail(e.target.value)} /></div>
                <div><Label>Password</Label><Input type="password" required minLength={4} value={password} onChange={e => setPassword(e.target.value)} /></div>
                <Button disabled={busy} className="w-full" type="submit">{busy ? "Creating..." : "Create Account"}</Button>
              </form>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}
