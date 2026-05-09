import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Upload, X } from "lucide-react";
import { toast } from "sonner";

export default function CompanyProfile() {
  const [c, setC] = useState<any>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => { (async () => {
    const { data } = await supabase.from("company_profile").select("*").limit(1).single();
    setC(data);
  })(); }, []);

  if (!c) return <div className="p-10 text-muted-foreground">Loading…</div>;

  function set(k: string, v: any) { setC((prev: any) => ({ ...prev, [k]: v })); }

  async function handleLogo(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; if (!file) return;
    const path = `logo-${Date.now()}-${file.name}`;
    const { error } = await supabase.storage.from("company-assets").upload(path, file);
    if (error) return toast.error(error.message);
    const { data } = supabase.storage.from("company-assets").getPublicUrl(path);
    set("logo_url", data.publicUrl);
    toast.success("Logo uploaded — don't forget to save");
  }

  async function save() {
    setSaving(true);
    const { error } = await supabase.from("company_profile").update({
      name: c.name, logo_url: c.logo_url, about: c.about, phone: c.phone,
      email: c.email, website: c.website, address: c.address, services: c.services,
      linkedin_url: c.linkedin_url, facebook_url: c.facebook_url,
      instagram_url: c.instagram_url, youtube_url: c.youtube_url,
    }).eq("id", c.id);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Company profile saved");
  }

  const services: string[] = c.services || [];

  return (
    <div className="p-10 max-w-4xl mx-auto">
      <div className="flex items-center justify-end mb-8">
        <Button onClick={save} disabled={saving}>{saving ? "Saving…" : "Save Changes"}</Button>
      </div>

      <div className="space-y-6">
        <Card className="p-6">
          <h2 className="font-serif text-xl mb-4">Brand</h2>
          <div className="flex items-center gap-6">
            <div className="w-32 h-32 bg-muted rounded flex items-center justify-center overflow-hidden">
              {c.logo_url ? <img src={c.logo_url} className="w-full h-full object-contain p-2" /> : <span className="text-xs text-muted-foreground">No logo</span>}
            </div>
            <label className="cursor-pointer">
              <input type="file" accept="image/*" className="hidden" onChange={handleLogo} />
              <span className="inline-flex items-center px-4 py-2 text-sm bg-primary text-primary-foreground rounded hover:opacity-90"><Upload className="w-4 h-4 mr-2" />Upload Logo</span>
            </label>
          </div>
          <div className="mt-4"><Label>Company Name</Label><Input value={c.name || ""} onChange={e => set("name", e.target.value)} /></div>
        </Card>

        <Card className="p-6 space-y-4">
          <h2 className="font-serif text-xl">About</h2>
          <Textarea rows={6} value={c.about || ""} onChange={e => set("about", e.target.value)} />
        </Card>

        <Card className="p-6 space-y-4">
          <h2 className="font-serif text-xl">Contact</h2>
          <div className="grid md:grid-cols-2 gap-4">
            <div><Label>Phone</Label><Input value={c.phone || ""} onChange={e => set("phone", e.target.value)} /></div>
            <div><Label>Email</Label><Input value={c.email || ""} onChange={e => set("email", e.target.value)} /></div>
            <div><Label>Website</Label><Input value={c.website || ""} onChange={e => set("website", e.target.value)} /></div>
            <div><Label>Address</Label><Input value={c.address || ""} onChange={e => set("address", e.target.value)} /></div>
          </div>
        </Card>

        <Card className="p-6 space-y-4">
          <h2 className="font-serif text-xl">Social Media</h2>
          <p className="text-xs text-muted-foreground -mt-2">Shown as icons on the thank-you page of every PDF.</p>
          <div className="grid md:grid-cols-2 gap-4">
            <div><Label>LinkedIn URL</Label><Input value={c.linkedin_url || ""} onChange={e => set("linkedin_url", e.target.value)} placeholder="https://linkedin.com/company/..." /></div>
            <div><Label>Facebook URL</Label><Input value={c.facebook_url || ""} onChange={e => set("facebook_url", e.target.value)} placeholder="https://facebook.com/..." /></div>
            <div><Label>Instagram URL</Label><Input value={c.instagram_url || ""} onChange={e => set("instagram_url", e.target.value)} placeholder="https://instagram.com/..." /></div>
            <div><Label>YouTube URL</Label><Input value={c.youtube_url || ""} onChange={e => set("youtube_url", e.target.value)} placeholder="https://youtube.com/@..." /></div>
          </div>
        </Card>

        <Card className="p-6">
          <h2 className="font-serif text-xl mb-4">Services</h2>
          <div className="space-y-2">
            {services.map((s, i) => (
              <div key={i} className="flex gap-2">
                <Input value={s} onChange={e => {
                  const next = [...services]; next[i] = e.target.value; set("services", next);
                }} />
                <Button variant="ghost" size="icon" onClick={() => set("services", services.filter((_, j) => j !== i))}><X className="w-4 h-4" /></Button>
              </div>
            ))}
            <Button variant="outline" size="sm" onClick={() => set("services", [...services, ""])}>+ Add service</Button>
          </div>
        </Card>
      </div>
    </div>
  );
}
