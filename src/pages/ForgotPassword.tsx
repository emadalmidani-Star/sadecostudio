import { useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { ArrowLeft, Mail } from "lucide-react";
import logo from "@/assets/sadeco-logo-white.png";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setBusy(false);
    if (error) {
      toast.error(error.message);
    } else {
      setSent(true);
      toast.success("Password reset email sent — check your inbox.");
    }
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
          <Link to="/auth" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-6">
            <ArrowLeft className="w-4 h-4" />
            Back to Sign In
          </Link>
          <h2 className="font-serif text-3xl mb-2">Reset Password</h2>
          <p className="text-muted-foreground mb-8 text-sm">
            Enter your email and we'll send you a link to reset your password.
          </p>

          {sent ? (
            <div className="flex flex-col items-center text-center space-y-4 py-8">
              <div className="w-12 h-12 rounded-full bg-accent/10 flex items-center justify-center">
                <Mail className="w-6 h-6 text-accent" />
              </div>
              <div>
                <p className="font-medium">Check your inbox</p>
                <p className="text-sm text-muted-foreground mt-1">
                  We sent a password reset link to <strong>{email}</strong>
                </p>
              </div>
              <Button variant="outline" onClick={() => setSent(false)}>
                Send again
              </Button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label>Email</Label>
                <Input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@sadeco.ae"
                />
              </div>
              <Button disabled={busy} className="w-full" type="submit">
                {busy ? "Sending..." : "Send Reset Link"}
              </Button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
