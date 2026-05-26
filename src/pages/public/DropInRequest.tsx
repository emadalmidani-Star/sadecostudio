import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { CheckCircle2, Loader2 } from "lucide-react";
import { fnUrl } from "@/lib/meetings";

export default function PublicDropIn() {
  const { token } = useParams();
  const [info, setInfo] = useState<{ designer: string; company: string; logo_url: string | null } | null>(null);
  const [form, setForm] = useState({ name: "", message: "" });
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`${fnUrl("dropin-create")}?token=${encodeURIComponent(token || "")}`)
      .then((r) => r.json()).then((d) => { if (!d.error) setInfo(d); else setError(d.error); });
  }, [token]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) { setError("Name is required"); return; }
    setSubmitting(true); setError(null);
    try {
      const res = await fetch(fnUrl("dropin-create"), {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, client_name: form.name.trim(), message: form.message.trim() || undefined }),
      });
      const data = await res.json();
      if (!res.ok || data?.error) throw new Error(data?.error || "Failed");
      setDone(true);
    } catch (e: any) { setError(e.message); }
    finally { setSubmitting(false); }
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          {info?.logo_url && <img src={info.logo_url} alt={info.company} className="h-12 mx-auto mb-3" />}
          <CardTitle className="font-serif text-3xl">Request a call</CardTitle>
          {info?.designer && <p className="text-sm text-muted-foreground">with {info.designer}</p>}
        </CardHeader>
        <CardContent>
          {done ? (
            <div className="text-center py-8 space-y-3">
              <CheckCircle2 className="w-12 h-12 text-green-600 mx-auto" />
              <p className="font-medium">Request sent.</p>
              <p className="text-sm text-muted-foreground">You'll hear back shortly.</p>
            </div>
          ) : (
            <form onSubmit={submit} className="space-y-3">
              <div><Label>Your name *</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required maxLength={200} /></div>
              <div><Label>Message</Label><Textarea rows={4} value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} maxLength={1000} placeholder="What would you like to discuss?" /></div>
              {error && <p className="text-sm text-destructive">{error}</p>}
              <Button type="submit" className="w-full" disabled={submitting}>{submitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}Send request</Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
