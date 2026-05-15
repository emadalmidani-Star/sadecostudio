import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FileDown, FileText, Files, GripVertical, Loader2, Search, Upload, X } from "lucide-react";
import { exportFullProfilePDF, exportSelectedPDF, setPdfCompression, setGalleryColumns, type CompressOpts, type GalleryColumns, type CompanyFooterFields } from "@/lib/pdf";
import { useUserRole } from "@/hooks/useUserRole";
import { toast } from "sonner";
import { safeStorageFilename } from "@/lib/storagePath";
import {
  DndContext, closestCenter, PointerSensor, useSensor, useSensors, type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext, arrayMove, useSortable, verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

type TplSet = { id: string; name: string };
const KINDS: { key: "profile" | "project" | "portfolio"; label: string }[] = [
  { key: "profile", label: "Full Company Profile" },
  { key: "portfolio", label: "Selected Projects Portfolio" },
  { key: "project", label: "Single Project Case Study" },
];

const QUALITY_PRESETS: Record<string, CompressOpts & { label: string; hint: string }> = {
  high:    { label: "High quality", hint: "Best visuals, large file. Up to ~50 projects.",  maxDim: 2200, quality: 0.9 },
  balanced:{ label: "Balanced",     hint: "Good quality, moderate size. ~50-150 projects.", maxDim: 1600, quality: 0.82 },
  compact: { label: "Compact",      hint: "Smaller file, slight softness. 100+ projects.",  maxDim: 1200, quality: 0.72 },
  tiny:    { label: "Smallest",     hint: "Email-friendly. 200+ projects.",                 maxDim: 900,  quality: 0.6 },
};

function SortableSelected({ id, project, onRemove }: { id: string; project: any; onRemove: () => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 };
  return (
    <div ref={setNodeRef} style={style} className="flex items-center gap-3 p-3 bg-card border rounded">
      <button {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground" aria-label="Drag to reorder">
        <GripVertical className="w-4 h-4" />
      </button>
      <div className="flex-1 min-w-0">
        <p className="text-[10px] text-accent uppercase tracking-wider">{project?.type || "—"}</p>
        <p className="font-serif truncate">{project?.name}</p>
      </div>
      <button onClick={onRemove} className="text-muted-foreground hover:text-destructive" aria-label="Remove">
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}

export default function Exports() {
  const [projects, setProjects] = useState<any[]>([]);
  const [company, setCompany] = useState<any>(null);
  const [selectedOrder, setSelectedOrder] = useState<string[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [covers, setCovers] = useState<Record<string, string>>({});
  const [uploadingType, setUploadingType] = useState<string | null>(null);
  const [sets, setSets] = useState<TplSet[]>([]);
  const [assignments, setAssignments] = useState<Record<string, string | null>>({});
  const [quality, setQuality] = useState<keyof typeof QUALITY_PRESETS>("balanced");
  const [galleryCols, setGalleryCols] = useState<GalleryColumns>(3);
  const [teamMembers, setTeamMembers] = useState<any[]>([]);
  const [contactId, setContactId] = useState<string>("__none__");
  const [companyFields, setCompanyFields] = useState<CompanyFooterFields>({ phone: true, email: true, website: true, address: false });
  const selected = useMemo(() => new Set(selectedOrder), [selectedOrder]);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));
  const { isAdmin } = useUserRole();

  useEffect(() => { (async () => {
    const [{ data: p }, { data: c }, { data: cc }] = await Promise.all([
      supabase.from("projects").select("*").order("updated_at", { ascending: false }),
      supabase.from("company_profile").select("*").single(),
      supabase.from("category_covers").select("type,image_url"),
    ]);
    setProjects(p || []); setCompany(c);
    const map: Record<string, string> = {};
    (cc || []).forEach((r: any) => { if (r.image_url) map[r.type] = r.image_url; });
    setCovers(map);
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const [{ data: ts }, { data: ea }, { data: members }] = await Promise.all([
        supabase.from("template_sets").select("id,name").eq("user_id", user.id).order("created_at"),
        supabase.from("export_template_assignments").select("export_kind,set_id").eq("user_id", user.id),
        supabase.from("profiles").select("*"),
      ]);
      setSets(ts || []);
      const a: Record<string, string | null> = {};
      (ea || []).forEach((r: any) => { a[r.export_kind] = r.set_id; });
      setAssignments(a);
      setTeamMembers(members || []);
    }
  })(); }, []);

  async function resolveSelectedContact() {
    if (contactId === "__none__") return null;
    if (contactId === "__me__") {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;
      const { data } = await supabase.from("profiles").select("*").eq("id", user.id).maybeSingle();
      return data || null;
    }
    return teamMembers.find(m => m.id === contactId) || null;
  }

  async function setKindAssignment(kind: string, setId: string | null) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    setAssignments(prev => ({ ...prev, [kind]: setId }));
    if (setId === null) {
      await supabase.from("export_template_assignments").delete().eq("user_id", user.id).eq("export_kind", kind);
    } else {
      await supabase.from("export_template_assignments").upsert({
        user_id: user.id, export_kind: kind, set_id: setId,
      }, { onConflict: "user_id,export_kind" });
    }
  }

  function toggle(id: string) {
    setSelectedOrder(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  }

  function onDragEnd(e: DragEndEvent) {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    setSelectedOrder(prev => {
      const oldIndex = prev.indexOf(String(active.id));
      const newIndex = prev.indexOf(String(over.id));
      if (oldIndex < 0 || newIndex < 0) return prev;
      return arrayMove(prev, oldIndex, newIndex);
    });
  }

  async function fullProfile() {
    setBusy("full");
    setPdfCompression(QUALITY_PRESETS[quality]); setGalleryColumns(galleryCols);
    try {
      const c = await resolveSelectedContact();
      await exportFullProfilePDF(company, projects, covers, c, companyFields);
      toast.success("Profile PDF generated");
    } catch (e: any) { toast.error(e.message); }
    setBusy(null);
  }

  async function selectedExport() {
    if (selectedOrder.length === 0) return toast.error("Select at least one project");
    setBusy("selected");
    setPdfCompression(QUALITY_PRESETS[quality]); setGalleryColumns(galleryCols);
    try {
      const byId = new Map(projects.map(p => [p.id, p]));
      const list = selectedOrder.map(id => byId.get(id)).filter(Boolean);
      const c = await resolveSelectedContact();
      await exportSelectedPDF(company, list, covers, c, companyFields);
      toast.success("Portfolio PDF generated");
    } catch (e: any) { toast.error(e.message); }
    setBusy(null);
  }

  async function uploadCategoryCover(type: string, file: File) {
    setUploadingType(type);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not signed in");
      const safe = type.replace(/[^a-z0-9]/gi, "_");
      const path = `${user.id}/category-${safe}-${Date.now()}-${safeStorageFilename(file.name)}`;
      const { error: upErr } = await supabase.storage.from("project-images").upload(path, file);
      if (upErr) throw upErr;
      const { data: { publicUrl } } = supabase.storage.from("project-images").getPublicUrl(path);
      const { error } = await supabase.from("category_covers")
        .upsert({ user_id: user.id, type, image_url: publicUrl }, { onConflict: "user_id,type" });
      if (error) throw error;
      setCovers(prev => ({ ...prev, [type]: publicUrl }));
      toast.success(`Cover updated for ${type}`);
    } catch (e: any) { toast.error(e.message); }
    setUploadingType(null);
  }

  async function clearCategoryCover(type: string) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    await supabase.from("category_covers").delete().eq("user_id", user.id).eq("type", type);
    setCovers(prev => { const n = { ...prev }; delete n[type]; return n; });
    toast.success("Cover removed");
  }

  const types = useMemo(
    () => Array.from(new Set(projects.map(p => p.type).filter(Boolean))).sort(),
    [projects]
  );
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return projects.filter(p => {
      if (typeFilter !== "all" && p.type !== typeFilter) return false;
      if (!q) return true;
      return [p.name, p.location, p.client_name, p.type]
        .filter(Boolean).some((v: string) => v.toLowerCase().includes(q));
    });
  }, [projects, query, typeFilter]);

  return (
    <div className="p-10 max-w-6xl mx-auto">
      <p className="text-xs tracking-[0.3em] text-accent mb-2">EXPORT</p>
      <h1 className="font-serif text-5xl mb-2">Generate PDFs</h1>
      <p className="text-muted-foreground mb-6">Premium client-ready documents in one click.</p>

      {isAdmin && (
        <Card className="p-5 mb-8">
          <h2 className="font-serif text-lg mb-1">Template assignments</h2>
          <p className="text-xs text-muted-foreground mb-4">Pick which template set each export uses. Manage sets in <a href="/template" className="underline">Template Designer</a>.</p>
          <div className="grid md:grid-cols-3 gap-3">
            {KINDS.map(k => (
              <div key={k.key}>
                <p className="text-xs text-accent uppercase tracking-wider mb-1">{k.label}</p>
                <Select
                  value={assignments[k.key] || "__none__"}
                  onValueChange={(v) => setKindAssignment(k.key, v === "__none__" ? null : v)}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">Default layout (no template)</SelectItem>
                    {sets.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            ))}
          </div>
        </Card>
      )}

      <div className="grid md:grid-cols-2 gap-6 mb-10">
        <Card className="p-8 luxury-gradient text-primary-foreground">
          <FileText className="w-8 h-8 text-accent mb-4" />
          <h2 className="font-serif text-2xl mb-2">Full Company Profile</h2>
          <p className="text-primary-foreground/70 text-sm mb-6">Cover, about, services, and every project as a complete brand document.</p>
          <Button variant="secondary" onClick={fullProfile} disabled={busy === "full"}>
            {busy === "full" ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <FileDown className="w-4 h-4 mr-2" />}
            Export Profile PDF
          </Button>
        </Card>

        <Card className="p-8 border-accent/40">
          <Files className="w-8 h-8 text-accent mb-4" />
          <h2 className="font-serif text-2xl mb-2">Selected Projects Portfolio</h2>
          <p className="text-muted-foreground text-sm mb-6">Cherry-pick projects below, drag to reorder, and merge them into a single portfolio PDF.</p>
          <Button onClick={selectedExport} disabled={busy === "selected" || selectedOrder.length === 0}>
            {busy === "selected" ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <FileDown className="w-4 h-4 mr-2" />}
            Export {selectedOrder.length > 0 ? `(${selectedOrder.length})` : ""}
          </Button>
        </Card>
      </div>

      <Card className="p-5 mb-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div>
            <h2 className="font-serif text-lg mb-1">Thank-you contact</h2>
            <p className="text-xs text-muted-foreground">Whose photo &amp; contact details appear on the final page.</p>
          </div>
          <Select value={contactId} onValueChange={setContactId}>
            <SelectTrigger className="md:w-72"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">None — company only</SelectItem>
              <SelectItem value="__me__">Me (signed-in user)</SelectItem>
              {teamMembers.map(m => (
                <SelectItem key={m.id} value={m.id}>
                  {m.full_name || m.email}{m.job_title ? ` — ${m.job_title}` : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="mt-4 pt-4 border-t">
          <p className="text-xs text-accent uppercase tracking-wider mb-2">Company contact fields on footer</p>
          <p className="text-xs text-muted-foreground mb-3">Choose which company details appear at the bottom of the thank-you page.</p>
          <div className="flex flex-wrap gap-4">
            {(["phone", "email", "website", "address"] as const).map(k => (
              <label key={k} className="flex items-center gap-2 text-sm capitalize cursor-pointer">
                <Checkbox
                  checked={!!companyFields[k]}
                  onCheckedChange={(v) => setCompanyFields(prev => ({ ...prev, [k]: !!v }))}
                />
                {k}
                {!company?.[k] && <span className="text-xs text-muted-foreground">(empty)</span>}
              </label>
            ))}
          </div>
        </div>
      </Card>

      <Card className="p-5 mb-10">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div>
            <h2 className="font-serif text-lg mb-1">PDF size & quality</h2>
            <p className="text-xs text-muted-foreground">{QUALITY_PRESETS[quality].hint}</p>
          </div>
          <Select value={quality} onValueChange={(v) => setQuality(v as keyof typeof QUALITY_PRESETS)}>
            <SelectTrigger className="md:w-64"><SelectValue /></SelectTrigger>
            <SelectContent>
              {Object.entries(QUALITY_PRESETS).map(([k, v]) => (
                <SelectItem key={k} value={k}>{v.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="mt-4 pt-4 border-t flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div>
            <h2 className="font-serif text-lg mb-1">Visual Story gallery layout</h2>
            <p className="text-xs text-muted-foreground">Choose how many images appear per row in the project gallery.</p>
          </div>
          <Select value={String(galleryCols)} onValueChange={(v) => setGalleryCols(Number(v) as GalleryColumns)}>
            <SelectTrigger className="md:w-64"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="2">2 columns — larger images</SelectItem>
              <SelectItem value="3">3 columns — denser layout</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </Card>

      {selectedOrder.length > 0 && (
        <Card className="p-5 mb-10">
          <h2 className="font-serif text-lg mb-1">Portfolio order</h2>
          <p className="text-xs text-muted-foreground mb-4">Drag to reorder. Projects appear in this order in the PDF (grouped by category).</p>
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
            <SortableContext items={selectedOrder} strategy={verticalListSortingStrategy}>
              <div className="space-y-2">
                {selectedOrder.map(id => {
                  const p = projects.find(x => x.id === id);
                  if (!p) return null;
                  return <SortableSelected key={id} id={id} project={p} onRemove={() => toggle(id)} />;
                })}
              </div>
            </SortableContext>
          </DndContext>
        </Card>
      )}

      {isAdmin && types.length > 0 && (
        <>
          <h2 className="font-serif text-2xl mb-2">Category covers</h2>
          <p className="text-muted-foreground text-sm mb-4">Each project type gets its own divider page in the PDF. Upload a custom cover image per category, or we'll auto-pick from a project in that category.</p>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4 mb-10">
            {types.map(t => (
              <Card key={t} className="overflow-hidden">
                <div className="aspect-[16/9] bg-muted relative">
                  {covers[t] ? (
                    <img src={covers[t]} className="w-full h-full object-cover" alt={`${t} cover`} />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-xs text-muted-foreground">Auto from first project</div>
                  )}
                  {covers[t] && (
                    <button
                      onClick={() => clearCategoryCover(t)}
                      className="absolute top-2 right-2 bg-background/90 rounded p-1 hover:bg-background"
                      aria-label="Remove cover"
                    ><X className="w-3.5 h-3.5" /></button>
                  )}
                </div>
                <div className="p-3 flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-xs text-accent uppercase tracking-wider">Category</p>
                    <p className="font-serif truncate">{t}</p>
                  </div>
                  <label className="cursor-pointer shrink-0">
                    <input type="file" accept="image/*" className="hidden"
                      onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadCategoryCover(t, f); e.target.value = ""; }} />
                    <span className="inline-flex items-center px-3 py-1.5 text-xs bg-primary text-primary-foreground rounded hover:opacity-90">
                      {uploadingType === t ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <><Upload className="w-3.5 h-3.5 mr-1" />{covers[t] ? "Change" : "Upload"}</>}
                    </span>
                  </label>
                </div>
              </Card>
            ))}
          </div>
        </>
      )}

      <h2 className="font-serif text-2xl mb-4">Pick projects for portfolio</h2>

      <div className="flex flex-col md:flex-row gap-3 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search projects by name, location or client..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="md:w-64"><SelectValue placeholder="All types" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All types</SelectItem>
            {types.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map(p => (
          <Card key={p.id} className={`p-4 cursor-pointer transition-all ${selected.has(p.id) ? "ring-2 ring-accent" : ""}`} onClick={() => toggle(p.id)}>
            <div className="flex items-start gap-3">
              <Checkbox checked={selected.has(p.id)} className="mt-1" />
              <div className="flex-1 min-w-0">
                <p className="text-xs text-accent uppercase tracking-wider">{p.type}</p>
                <h3 className="font-serif text-lg truncate">{p.name}</h3>
                <p className="text-sm text-muted-foreground truncate">{p.location || "—"}</p>
              </div>
            </div>
          </Card>
        ))}
        {filtered.length === 0 && (
          <p className="text-muted-foreground col-span-full text-center py-10">No projects match your search.</p>
        )}
      </div>
    </div>
  );
}
