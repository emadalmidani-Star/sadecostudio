import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Sparkles, Upload, X, FileDown, Trash2, Loader2, GripVertical } from "lucide-react";
import { toast } from "sonner";
import { exportProjectPDF } from "@/lib/pdf";
import ImageCropDialog from "@/components/ImageCropDialog";
import { safeStorageFilename } from "@/lib/storagePath";
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors, DragEndEvent } from "@dnd-kit/core";
import { SortableContext, arrayMove, rectSortingStrategy, useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

const TYPES = [
  "Furniture, Novelties, Home",
  "Entertainment",
  "Financial Services",
  "Supermarket",
  "Offices & Villas",
  "F&B Restaurants & Cafe's",
  "Retail - Fashion & Accessories",
  "Jewellery",
  "Spa Salons and Beauty",
  "Health Care",
  "Company Profile",
];
const TONES = ["luxury", "corporate", "minimal", "technical"];

type UploadItem = { id: string; name: string; progress: number };

function SortableImage({ url, isCover, onSetCover, onRemove }: {
  url: string; isCover: boolean; onSetCover: () => void; onRemove: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: url });
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 }}
      className="relative group aspect-square rounded overflow-hidden border border-border"
    >
      <img src={url} className="w-full h-full object-cover pointer-events-none" />
      {isCover && (
        <span className="absolute top-2 left-2 bg-accent text-accent-foreground text-[10px] font-semibold tracking-wider px-2 py-1 rounded">COVER</span>
      )}
      <button
        {...attributes}
        {...listeners}
        className="absolute top-2 right-2 bg-background/80 hover:bg-background p-1 rounded cursor-grab active:cursor-grabbing"
        aria-label="Drag to reorder"
        type="button"
      >
        <GripVertical className="w-4 h-4" />
      </button>
      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex justify-center gap-2 p-3">
        <Button size="sm" variant="secondary" onClick={onSetCover}>{isCover ? "Cover ✓" : "Set Cover"}</Button>
        <Button size="sm" variant="destructive" onClick={onRemove}>Remove</Button>
      </div>
    </div>
  );
}

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
    setP(data); if (data.cover_image) coverManuallySet.current = true; setLoading(false);
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

  const [uploads, setUploads] = useState<UploadItem[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const [cropQueue, setCropQueue] = useState<File[]>([]);
  const [skipCrop, setSkipCrop] = useState(false);
  const coverManuallySet = useRef(false);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  async function uploadOne(file: File | Blob, name: string) {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    setUploads(prev => [...prev, { id, name, progress: 10 }]);
    const path = `${Date.now()}-${safeStorageFilename(name)}`;
    // Simulated progress (Supabase JS doesn't expose real progress)
    const tick = setInterval(() => {
      setUploads(prev => prev.map(u => u.id === id ? { ...u, progress: Math.min(90, u.progress + 10) } : u));
    }, 200);
    const { error } = await supabase.storage.from("project-images").upload(path, file, { contentType: (file as any).type || "image/jpeg" });
    clearInterval(tick);
    if (error) {
      setUploads(prev => prev.filter(u => u.id !== id));
      toast.error("Upload failed. Please try another image or rename the file.");
      return null;
    }
    const { data } = supabase.storage.from("project-images").getPublicUrl(path);
    setUploads(prev => prev.map(u => u.id === id ? { ...u, progress: 100 } : u));
    setTimeout(() => setUploads(prev => prev.filter(u => u.id !== id)), 600);
    setP((prev: any) => ({
      ...prev,
      images: [...(prev.images || []), data.publicUrl],
      cover_image: coverManuallySet.current ? prev.cover_image : data.publicUrl,
    }));
    return data.publicUrl;
  }

  function queueFiles(files: File[]) {
    const imgs = files.filter(f => f.type.startsWith("image/"));
    if (!imgs.length) return;
    if (skipCrop) imgs.forEach(f => uploadOne(f, f.name));
    else setCropQueue(prev => [...prev, ...imgs]);
  }

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    queueFiles(Array.from(e.target.files || []));
    e.target.value = "";
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    queueFiles(Array.from(e.dataTransfer.files || []));
  }

  async function handleCropConfirm(blob: Blob) {
    const f = cropQueue[0];
    setCropQueue(prev => prev.slice(1));
    await uploadOne(blob, f.name.replace(/\.[^.]+$/, "") + ".jpg");
  }
  async function handleCropSkip() {
    const f = cropQueue[0];
    setCropQueue(prev => prev.slice(1));
    await uploadOne(f, f.name);
  }

  function removeImage(url: string) {
    const next = (p.images || []).filter((u: string) => u !== url);
    setP((prev: any) => ({ ...prev, images: next, cover_image: prev.cover_image === url ? next[0] || null : prev.cover_image }));
  }

  function handleSetCover(url: string) {
    coverManuallySet.current = true;
    set("cover_image", url);
  }

  function handleDragEnd(e: DragEndEvent) {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const imgs: string[] = p.images || [];
    const oldIdx = imgs.indexOf(active.id as string);
    const newIdx = imgs.indexOf(over.id as string);
    if (oldIdx < 0 || newIdx < 0) return;
    set("images", arrayMove(imgs, oldIdx, newIdx));
  }

  async function generateAI() {
    if (!p.name || !p.type) { toast.error("Add project name and type first"); return; }
    setGenerating(true);
    const { data: company } = await supabase.from("company_profile")
      .select("name,about,services").maybeSingle();
    const { data, error } = await supabase.functions.invoke("generate-description", {
      body: {
        name: p.name, type: p.type, location: p.location,
        area: p.area_sqm, client: p.client_name, status: p.status,
        keywords, tone,
        company: company || undefined,
      }
    });
    setGenerating(false);
    if (error) { toast.error(error.message); return; }
    if ((data as any)?.error) { toast.error((data as any).error); return; }
    const d = data as any;
    const headline = d?.headline?.trim();
    const body = d?.description || "";
    const description = headline ? `${headline}\n\n${body}` : body;
    setP((prev: any) => ({ ...prev, description, highlights: d?.highlights || [] }));
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
          <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
            <div>
              <h2 className="font-serif text-xl">Image Gallery</h2>
              <p className="text-xs text-muted-foreground mt-1">Drag tiles to reorder. Drop files to upload.</p>
            </div>
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer">
                <input type="checkbox" checked={skipCrop} onChange={e => setSkipCrop(e.target.checked)} />
                Skip crop
              </label>
              <label className="cursor-pointer">
                <input type="file" multiple accept="image/*" className="hidden" onChange={handleUpload} />
                <span className="inline-flex items-center px-4 py-2 text-sm bg-primary text-primary-foreground rounded hover:opacity-90"><Upload className="w-4 h-4 mr-2" />Upload Images</span>
              </label>
            </div>
          </div>

          {uploads.length > 0 && (
            <div className="space-y-2 mb-4">
              {uploads.map(u => (
                <div key={u.id} className="space-y-1">
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span className="truncate mr-2">{u.name}</span>
                    <span>{u.progress}%</span>
                  </div>
                  <Progress value={u.progress} className="h-1.5" />
                </div>
              ))}
            </div>
          )}

          <div
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            className={`rounded transition-colors ${dragOver ? "ring-2 ring-accent bg-accent/5" : ""}`}
          >
            {(p.images || []).length === 0 ? (
              <div className="border-2 border-dashed rounded p-12 text-center text-muted-foreground">
                {dragOver ? "Drop images to upload" : "Drag & drop images here, or click Upload Images"}
              </div>
            ) : (
              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                <SortableContext items={p.images} strategy={rectSortingStrategy}>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {p.images.map((url: string) => (
                      <SortableImage
                        key={url}
                        url={url}
                        isCover={p.cover_image === url}
                        onSetCover={() => handleSetCover(url)}
                        onRemove={() => removeImage(url)}
                      />
                    ))}
                  </div>
                </SortableContext>
              </DndContext>
            )}
          </div>
        </Card>
      </div>

      <ImageCropDialog
        file={cropQueue[0] || null}
        onCancel={() => setCropQueue([])}
        onConfirm={handleCropConfirm}
        onSkip={handleCropSkip}
      />
    </div>
  );
}
