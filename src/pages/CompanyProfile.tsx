import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Upload, X, ArrowUp, ArrowDown, Image as ImageIcon } from "lucide-react";
import { toast } from "sonner";
import { flattenToWhite } from "@/lib/flattenImage";

type Partner = { id: string; name: string; logo_url: string | null; sort_order: number };

export default function CompanyProfile() {
  const [c, setC] = useState<any>(null);
  const [saving, setSaving] = useState(false);
  const [partners, setPartners] = useState<Partner[]>([]);
  const [newPartner, setNewPartner] = useState("");

  useEffect(() => { (async () => {
    const { data } = await supabase.from("company_profile").select("*").limit(1).single();
    setC(data);
    const { data: ps } = await supabase.from("partners").select("*").order("sort_order", { ascending: true });
    setPartners((ps || []) as Partner[]);
  })(); }, []);

  if (!c) return <div className="p-10 text-muted-foreground">Loading…</div>;

  function set(k: string, v: any) { setC((prev: any) => ({ ...prev, [k]: v })); }
  function setLayout(k: string, v: any) {
    setC((prev: any) => ({ ...prev, partners_layout: { ...(prev.partners_layout || {}), [k]: v } }));
  }

  async function handleLogo(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; if (!file) return;
    const { blob, filename } = await flattenToWhite(file);
    const path = `logo-${Date.now()}-${filename}`;
    const { error } = await supabase.storage.from("company-assets").upload(path, blob, { contentType: blob.type });
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
      partners_intro: c.partners_intro, partners_layout: c.partners_layout,
    }).eq("id", c.id);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Company profile saved");
  }

  // Partners CRUD
  async function addPartner() {
    const name = newPartner.trim(); if (!name) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return toast.error("Not signed in");
    const sort_order = partners.length ? Math.max(...partners.map(p => p.sort_order)) + 1 : 0;
    const { data, error } = await supabase.from("partners")
      .insert({ name, user_id: user.id, sort_order }).select().single();
    if (error) return toast.error(error.message);
    setPartners([...partners, data as Partner]);
    setNewPartner("");
  }

  async function renamePartner(id: string, name: string) {
    setPartners(partners.map(p => p.id === id ? { ...p, name } : p));
  }
  async function commitPartner(p: Partner) {
    const { error } = await supabase.from("partners").update({ name: p.name }).eq("id", p.id);
    if (error) toast.error(error.message);
  }

  async function deletePartner(id: string) {
    const { error } = await supabase.from("partners").delete().eq("id", id);
    if (error) return toast.error(error.message);
    setPartners(partners.filter(p => p.id !== id));
  }

  async function movePartner(id: string, dir: -1 | 1) {
    const idx = partners.findIndex(p => p.id === id);
    const swap = idx + dir;
    if (idx < 0 || swap < 0 || swap >= partners.length) return;
    const next = [...partners];
    [next[idx], next[swap]] = [next[swap], next[idx]];
    const reordered = next.map((p, i) => ({ ...p, sort_order: i }));
    setPartners(reordered);
    await Promise.all(reordered.map(p =>
      supabase.from("partners").update({ sort_order: p.sort_order }).eq("id", p.id)
    ));
  }

  async function uploadPartnerLogo(p: Partner, file: File) {
    const { blob, filename } = await flattenToWhite(file);
    const path = `partner-${p.id}-${Date.now()}-${filename}`;
    const { error } = await supabase.storage.from("company-assets").upload(path, blob, { contentType: blob.type });
    if (error) return toast.error(error.message);
    const { data } = supabase.storage.from("company-assets").getPublicUrl(path);
    const { error: e2 } = await supabase.from("partners").update({ logo_url: data.publicUrl }).eq("id", p.id);
    if (e2) return toast.error(e2.message);
    setPartners(partners.map(x => x.id === p.id ? { ...x, logo_url: data.publicUrl } : x));
    toast.success("Logo uploaded");
  }

  async function removePartnerLogo(p: Partner) {
    const { error } = await supabase.from("partners").update({ logo_url: null }).eq("id", p.id);
    if (error) return toast.error(error.message);
    setPartners(partners.map(x => x.id === p.id ? { ...x, logo_url: null } : x));
  }

  const services: string[] = c.services || [];
  const layout = c.partners_layout || { cols: 3, tile_style: "outlined", font_size: 13, logo_mode: true };

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
              <input type="file" accept="image/*,.svg,image/svg+xml" className="hidden" onChange={handleLogo} />
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

        <Card className="p-6 space-y-5">
          <div>
            <h2 className="font-serif text-xl">Clients & Partners</h2>
            <p className="text-xs text-muted-foreground mt-1">Shown on the Clients & Partners page in the company profile PDF.</p>
          </div>

          <div className="space-y-2">
            <Label>Intro paragraph</Label>
            <Textarea rows={4} value={c.partners_intro ?? ""} onChange={e => set("partners_intro", e.target.value)}
              placeholder="Leave empty to use the default intro." />
          </div>

          <div className="grid md:grid-cols-4 gap-4">
            <div>
              <Label>Columns</Label>
              <Select value={String(layout.cols ?? 3)} onValueChange={v => setLayout("cols", Number(v))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {[2,3,4,5,6].map(n => <SelectItem key={n} value={String(n)}>{n}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Tile style</Label>
              <Select value={layout.tile_style ?? "outlined"} onValueChange={v => setLayout("tile_style", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="outlined">Outlined</SelectItem>
                  <SelectItem value="filled">Filled</SelectItem>
                  <SelectItem value="none">None</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Font size</Label>
              <Input type="number" min={7} max={24} value={layout.font_size ?? 13}
                onChange={e => setLayout("font_size", Number(e.target.value))} />
            </div>
            <div className="flex items-end gap-3">
              <div className="flex items-center gap-2">
                <Switch checked={layout.logo_mode !== false} onCheckedChange={v => setLayout("logo_mode", v)} />
                <Label className="cursor-pointer">Show logos</Label>
              </div>
            </div>
          </div>

          <div className="space-y-2 pt-2">
            <Label>Partners</Label>
            {partners.map((p, i) => (
              <div key={p.id} className="flex items-center gap-2 border rounded p-2">
                <div className="w-14 h-14 bg-muted rounded flex items-center justify-center overflow-hidden shrink-0">
                  {p.logo_url
                    ? <img src={p.logo_url} className="w-full h-full object-contain p-1" />
                    : <ImageIcon className="w-5 h-5 text-muted-foreground" />}
                </div>
                <Input
                  value={p.name}
                  onChange={e => renamePartner(p.id, e.target.value)}
                  onBlur={() => commitPartner(p)}
                />
                <label className="cursor-pointer">
                  <input type="file" accept="image/*,.svg,image/svg+xml" className="hidden"
                    onChange={e => { const f = e.target.files?.[0]; if (f) uploadPartnerLogo(p, f); }} />
                  <span className="inline-flex items-center px-3 py-2 text-xs bg-secondary text-secondary-foreground rounded hover:opacity-90">
                    <Upload className="w-3 h-3 mr-1" />Logo
                  </span>
                </label>
                {p.logo_url && (
                  <Button variant="ghost" size="icon" onClick={() => removePartnerLogo(p)} title="Remove logo">
                    <X className="w-4 h-4" />
                  </Button>
                )}
                <Button variant="ghost" size="icon" disabled={i === 0} onClick={() => movePartner(p.id, -1)}>
                  <ArrowUp className="w-4 h-4" />
                </Button>
                <Button variant="ghost" size="icon" disabled={i === partners.length - 1} onClick={() => movePartner(p.id, 1)}>
                  <ArrowDown className="w-4 h-4" />
                </Button>
                <Button variant="ghost" size="icon" onClick={() => deletePartner(p.id)} title="Delete">
                  <X className="w-4 h-4" />
                </Button>
              </div>
            ))}
            <div className="flex gap-2">
              <Input value={newPartner} onChange={e => setNewPartner(e.target.value)}
                placeholder="New partner name" onKeyDown={e => { if (e.key === "Enter") addPartner(); }} />
              <Button variant="outline" onClick={addPartner}>+ Add</Button>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
