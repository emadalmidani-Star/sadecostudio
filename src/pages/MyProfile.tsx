import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Upload } from "lucide-react";
import { toast } from "sonner";

export default function MyProfile() {
  const { user } = useAuth();
  const [p, setP] = useState<any>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => { (async () => {
    if (!user) return;
    const { data } = await supabase.from("profiles").select("*").eq("id", user.id).maybeSingle();
    setP(data || { id: user.id, email: user.email, full_name: "", job_title: "", phone: "", whatsapp: "", avatar_url: "" });
  })(); }, [user]);

  if (!p) return <div className="p-10 text-muted-foreground">Loading…</div>;
  const set = (k: string, v: any) => setP((prev: any) => ({ ...prev, [k]: v }));

  async function handleAvatar(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; if (!file || !user) return;
    const path = `${user.id}/avatar-${Date.now()}-${file.name}`;
    const { error } = await supabase.storage.from("company-assets").upload(path, file, { upsert: true });
    if (error) return toast.error(error.message);
    const { data } = supabase.storage.from("company-assets").getPublicUrl(path);
    set("avatar_url", data.publicUrl);
    toast.success("Photo uploaded — don't forget to save");
  }

  async function save() {
    if (!user) return;
    setSaving(true);
    const payload = {
      id: user.id, email: user.email, full_name: p.full_name, job_title: p.job_title,
      phone: p.phone, whatsapp: p.whatsapp, avatar_url: p.avatar_url,
    };
    const { error } = await supabase.from("profiles").upsert(payload, { onConflict: "id" });
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Profile saved");
  }

  const initials = (p.full_name || p.email || "?").split(" ").map((x: string) => x[0]).slice(0, 2).join("").toUpperCase();

  return (
    <div className="p-10 max-w-3xl mx-auto">
      <div className="flex items-end justify-between mb-8">
        <div>
          <p className="text-xs tracking-[0.3em] text-accent mb-2">SALES CONTACT</p>
          <h1 className="font-serif text-5xl">My Profile</h1>
          <p className="text-muted-foreground mt-2">Used on the thank-you page of PDFs you generate.</p>
        </div>
        <Button onClick={save} disabled={saving}>{saving ? "Saving…" : "Save Changes"}</Button>
      </div>

      <Card className="p-6 mb-6">
        <h2 className="font-serif text-xl mb-4">Photo</h2>
        <div className="flex items-center gap-6">
          <Avatar className="w-28 h-28">
            <AvatarImage src={p.avatar_url || undefined} />
            <AvatarFallback className="text-xl">{initials}</AvatarFallback>
          </Avatar>
          <label className="cursor-pointer">
            <input type="file" accept="image/*" className="hidden" onChange={handleAvatar} />
            <span className="inline-flex items-center px-4 py-2 text-sm bg-primary text-primary-foreground rounded hover:opacity-90">
              <Upload className="w-4 h-4 mr-2" />Upload Photo
            </span>
          </label>
        </div>
      </Card>

      <Card className="p-6 space-y-4">
        <h2 className="font-serif text-xl">Contact</h2>
        <div className="grid md:grid-cols-2 gap-4">
          <div><Label>Full name</Label><Input value={p.full_name || ""} onChange={e => set("full_name", e.target.value)} /></div>
          <div><Label>Job title</Label><Input value={p.job_title || ""} onChange={e => set("job_title", e.target.value)} placeholder="Sales Manager" /></div>
          <div><Label>Email</Label><Input value={p.email || ""} disabled /></div>
          <div><Label>Phone</Label><Input value={p.phone || ""} onChange={e => set("phone", e.target.value)} placeholder="+971…" /></div>
          <div><Label>WhatsApp</Label><Input value={p.whatsapp || ""} onChange={e => set("whatsapp", e.target.value)} placeholder="+971…" /></div>
        </div>
      </Card>
    </div>
  );
}
