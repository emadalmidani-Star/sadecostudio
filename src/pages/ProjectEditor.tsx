import { useEffect, useState } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Sparkles, Upload, X, FileDown, Trash2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { exportProjectPDF } from "@/lib/pdf";

const TYPES = ["fit-out", "construction", "interior", "renovation"];
const TONES = ["luxury", "corporate", "minimal", "technical"];

export default function ProjectEditor() {
  const { id } = useParams();
  const isNew = !id || id === "new";
  const nav = useNavigate();
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [keywords, setKeywords] = useState("");
  const [tone, setTone] = useState("luxury");

  const [p, setP] = useState<any>({
    name: "", location: "", type: "fit-out", area_sqm: "", client_name: "",
    status: "ongoing", description: "", highlights: [], images: [], cover_image: null,
  });

  useEffect(() => { if (!isNew) (async () => {
    const { data, error } = await supabase.from("projects").select("*").eq("id", id).maybeSingle();
    if (error || !data) { toast.error("Project not found"); nav("/projects"); return; }
    setP(data); setLoading(false);
  })(); }, [id]);

  function set<K extends string>(k: K, v: any) { setP((prev: any) => ({ ...prev, [k]: v })); }

  async function handleSave() {
    setSaving(true);
    const payload = { ...p, area_sqm: p.area_sqm ? Number(p.area_sqm) : null };
    if (isNew) {
      const { data: u } = await supabase.auth.getUser();
      const { data, error } = await supabase.from("projects").insert({ ...payload, created_by: u.user?.id }).select().single();
      setSaving(false);
      if (error) return toast.error(error.message);
      toast.success("Project created");
      nav(`/projects/${data.id}`);
    } else {
      const { error } = await supabase.from("projects").update(payload).eq("id", id);
      setSaving(false);
      if (error) return toast.error(error.message);
      toast.success("Saved");
    }
  }

  async function handleDelete() {
    if (!confirm("Delete this project permanently?")) return;
    await supabase.from("projects").delete().eq("id", id);
    toast.success("Deleted");
    nav("/projects");
  }

  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  async function uploadFiles(files: File[]) {
    const imgs = files.filter(f => f.type.startsWith("image/"));
    if (!imgs.length) return;
    setUploading(true);
    const urls: string[] = [];
    for (const f of imgs) {
      const path = `${Date.now()}-${f.name}`;
      const { error } = await supabase.storage.from("project-images").upload(path, f);
      if (error) { toast.error(error.message); continue; }
      const { data } = supabase.storage.from("project-images").getPublicUrl(path);
      urls.push(data.publicUrl);
    }
    setP((prev: any) => ({ ...prev, images: [...(prev.images || []), ...urls], cover_image: prev.cover_image || urls[0] }));
    setUploading(false);
    if (urls.length) toast.success(`${urls.length} image(s) added`);
  }

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    await uploadFiles(Array.from(e.target.files || []));
    e.target.value = "";
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    uploadFiles(Array.from(e.dataTransfer.files || []));
  }

  function removeImage(url: string) {
    const next = (p.images || []).filter((u: string) => u !== url);
    setP((prev: any) => ({ ...prev, images: next, cover_image: prev.cover_image === url ? next[0] || null : prev.cover_image }));
  }

  async function generateAI() {
    if (!p.name || !p.type) { toast.error("Add project name and type first"); return; }
    setGenerating(true);
    const { data, error } = await supabase.functions.invoke("generate-description", {
      body: { name: p.name, type: p.type, location: p.location, area: p.area_sqm, client: p.client_name, keywords, tone }
    });
    setGenerating(false);
    if (error) { toast.error(error.message); return; }
    if ((data as any)?.error) { toast.error((data as any).error); return; }
    setP((prev: any) => ({ ...prev, description: (data as any).description, highlights: (data as any).highlights }));
    toast.success("AI content generated — review and save");
  }

  async function handleExport() {
    if (isNew) return toast.error("Save the project first");
    const { data: company } = await supabase.from("company_profile").select("*").single();
    await exportProjectPDF(p, company);
  }

  if (loading) return <div className="p-10 text-muted-foreground">Loading…</div>;

  return (
    <div className="p-10 max-w-6xl mx-auto">
      <Link to="/projects" className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-6"><ArrowLeft className="w-4 h-4 mr-1" />All projects</Link>

      <div className="flex items-end justify-between mb-8 gap-4 flex-wrap">
        <div>
          <p className="text-xs tracking-[0.3em] text-accent mb-2">{isNew ? "NEW PROJECT" : "EDIT PROJECT"}</p>
          <h1 className="font-serif text-4xl">{p.name || "Untitled Project"}</h1>
        </div>
        <div className="flex gap-2">
          {!isNew && <Button variant="outline" onClick={handleExport}><FileDown className="w-4 h-4 mr-2" />Export PDF</Button>}
          {!isNew && <Button variant="ghost" size="icon" onClick={handleDelete}><Trash2 className="w-4 h-4" /></Button>}
          <Button onClick={handleSave} disabled={saving}>{saving ? "Saving…" : "Save"}</Button>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <Card className="p-6 lg:col-span-2 space-y-4">
          <h2 className="font-serif text-xl mb-2">Project Details</h2>
          <div><Label>Project Name</Label><Input value={p.name} onChange={e => set("name", e.target.value)} /></div>
          <div className="grid md:grid-cols-2 gap-4">
            <div><Label>Location</Label><Input value={p.location || ""} onChange={e => set("location", e.target.value)} /></div>
            <div><Label>Client Name</Label><Input value={p.client_name || ""} onChange={e => set("client_name", e.target.value)} /></div>
          </div>
          <div className="grid md:grid-cols-3 gap-4">
            <div><Label>Type</Label>
              <Select value={p.type} onValueChange={v => set("type", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{TYPES.map(t => <SelectItem key={t} value={t} className="capitalize">{t}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Area (sqm)</Label><Input type="number" value={p.area_sqm || ""} onChange={e => set("area_sqm", e.target.value)} /></div>
            <div><Label>Status</Label>
              <Select value={p.status} onValueChange={v => set("status", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="ongoing">Ongoing</SelectItem><SelectItem value="completed">Completed</SelectItem></SelectContent>
              </Select>
            </div>
          </div>
        </Card>

        <Card className="p-6 space-y-4 brass-gradient/5 border-accent/30">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-accent" />
            <h2 className="font-serif text-xl">AI Generator</h2>
          </div>
          <div><Label>Tone</Label>
            <Select value={tone} onValueChange={setTone}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{TONES.map(t => <SelectItem key={t} value={t} className="capitalize">{t}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div><Label>Optional keywords</Label><Textarea rows={3} value={keywords} onChange={e => setKeywords(e.target.value)} placeholder="e.g. marble, custom millwork, biophilic" /></div>
          <Button onClick={generateAI} disabled={generating} className="w-full">
            {generating ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Generating…</> : <><Sparkles className="w-4 h-4 mr-2" />Generate Description</>}
          </Button>
        </Card>

        <Card className="p-6 lg:col-span-3 space-y-4">
          <h2 className="font-serif text-xl">Description</h2>
          <Textarea rows={8} value={p.description || ""} onChange={e => set("description", e.target.value)}
            placeholder="Manually write or generate with AI…" />
          <div>
            <Label>Key Highlights</Label>
            <div className="space-y-2 mt-2">
              {(p.highlights || []).map((h: string, i: number) => (
                <div key={i} className="flex gap-2">
                  <Input value={h} onChange={e => {
                    const next = [...p.highlights]; next[i] = e.target.value; set("highlights", next);
                  }} />
                  <Button variant="ghost" size="icon" onClick={() => set("highlights", p.highlights.filter((_: any, j: number) => j !== i))}><X className="w-4 h-4" /></Button>
                </div>
              ))}
              <Button variant="outline" size="sm" onClick={() => set("highlights", [...(p.highlights || []), ""])}>+ Add highlight</Button>
            </div>
          </div>
        </Card>

        <Card className="p-6 lg:col-span-3">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-serif text-xl">Image Gallery</h2>
            <label className="cursor-pointer">
              <input type="file" multiple accept="image/*" className="hidden" onChange={handleUpload} />
              <span className="inline-flex items-center px-4 py-2 text-sm bg-primary text-primary-foreground rounded hover:opacity-90"><Upload className="w-4 h-4 mr-2" />Upload Images</span>
            </label>
          </div>
          <div
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            className={`rounded transition-colors ${dragOver ? "ring-2 ring-accent bg-accent/5" : ""}`}
          >
            {(p.images || []).length === 0 ? (
              <div className="border-2 border-dashed rounded p-12 text-center text-muted-foreground">
                {uploading ? "Uploading…" : dragOver ? "Drop images to upload" : "Drag & drop images here, or click Upload Images"}
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {p.images.map((url: string) => (
                  <div key={url} className="relative group aspect-square rounded overflow-hidden">
                    <img src={url} className="w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-2">
                      <Button size="sm" variant="secondary" onClick={() => set("cover_image", url)}>{p.cover_image === url ? "Cover ✓" : "Set Cover"}</Button>
                      <Button size="sm" variant="destructive" onClick={() => removeImage(url)}>Remove</Button>
                    </div>
                  </div>
                ))}
                {dragOver && <div className="col-span-full text-center text-sm text-accent py-4">Drop to add more images</div>}
              </div>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
