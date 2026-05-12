import { useEffect, useMemo, useRef, useState } from "react";
import { Rnd } from "react-rnd";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Plus, Save, Trash2, Upload, X, FilePlus2 } from "lucide-react";
import { toast } from "sonner";
import { FIELDS_BY_TYPE, type Slot, type Template } from "@/lib/templateRender";
import { uploadTemplateFiles } from "@/lib/pdfRasterize";
import TemplatePagesStrip, { type TemplatePage } from "@/components/TemplatePagesStrip";

type PageType = Template["page_type"];
type TplSet = { id: string; name: string };

const PAGE_TABS: { key: PageType; label: string }[] = [
  { key: "cover", label: "Cover" },
  { key: "divider", label: "Category Divider" },
  { key: "project", label: "Project Page" },
  { key: "thankyou", label: "Thank You" },
  { key: "idcard", label: "ID Card" },
];

const A4_RATIO = 297 / 210;
const IDCARD_RATIO = 54 / 86; // portrait credit-card

export default function TemplateDesigner() {
  const [sets, setSets] = useState<TplSet[]>([]);
  const [setId, setSetId] = useState<string | null>(null);
  const [pageType, setPageType] = useState<PageType>("project");
  const [bgUrl, setBgUrl] = useState<string | null>(null);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [pages, setPages] = useState<TemplatePage[]>([]);
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const canvasRef = useRef<HTMLDivElement>(null);
  const ratio = pageType === "idcard" ? IDCARD_RATIO : A4_RATIO;
  const [canvasSize, setCanvasSize] = useState({ w: 800, h: 800 / A4_RATIO });

  useEffect(() => {
    const update = () => {
      if (!canvasRef.current) return;
      const w = canvasRef.current.clientWidth;
      const maxW = pageType === "idcard" ? 420 : w;
      const cw = Math.min(w, maxW);
      setCanvasSize({ w: cw, h: cw / ratio });
    };
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, [ratio, pageType]);

  // Load sets
  useEffect(() => { (async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data } = await supabase.from("template_sets").select("id,name").eq("user_id", user.id).order("created_at");
    let list = data || [];
    if (list.length === 0) {
      const { data: created } = await supabase.from("template_sets").insert({ user_id: user.id, name: "Default" }).select("id,name").single();
      if (created) list = [created];
    }
    setSets(list);
    setSetId(list[0]?.id || null);
  })(); }, []);

  // Load template + pages for current set/pageType
  useEffect(() => { (async () => {
    if (!setId) return;
    setLoading(true);
    const [{ data: tpl }, { data: pgs }] = await Promise.all([
      supabase.from("pdf_templates").select("*").eq("set_id", setId).eq("page_type", pageType).maybeSingle(),
      supabase.from("template_pages").select("*").eq("set_id", setId).order("page_index"),
    ]);
    setBgUrl(tpl?.background_url || null);
    setSlots((tpl?.slots as any) || []);
    setPages((pgs as any) || []);
    setSelectedIdx(null);
    setLoading(false);
  })(); }, [setId, pageType]);

  const fields = FIELDS_BY_TYPE[pageType];
  const usedFields = useMemo(() => new Set(slots.map(s => s.field)), [slots]);

  function addSlot(field: string) {
    const meta = fields.find(f => f.field === field);
    if (!meta) return;
    const def: Slot = meta.kind === "image"
      ? { field, x: 30, y: 30, w: 40, h: 30 }
      : { field, x: 10, y: 10, w: 50, h: 10, fontSize: 16, align: "left", color: "#000000" };
    setSlots(prev => [...prev, def]);
    setSelectedIdx(slots.length);
  }
  function updateSlot(idx: number, patch: Partial<Slot>) { setSlots(prev => prev.map((s, i) => i === idx ? { ...s, ...patch } : s)); }
  function removeSlot(idx: number) { setSlots(prev => prev.filter((_, i) => i !== idx)); setSelectedIdx(null); }

  async function uploadBackground(file: File) {
    setUploading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not signed in");
      const path = `${user.id}/template-${pageType}-${Date.now()}-${file.name}`;
      const { error: upErr } = await supabase.storage.from("project-images").upload(path, file);
      if (upErr) throw upErr;
      const { publicUrl } = supabase.storage.from("project-images").getPublicUrl(path).data;
      setBgUrl(publicUrl);
      toast.success("Background uploaded");
    } catch (e: any) { toast.error(e.message); }
    setUploading(false);
  }

  async function uploadPages(files: File[]) {
    if (!setId) return;
    setUploading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not signed in");
      const urls = await uploadTemplateFiles(files);
      const startIdx = pages.length;
      const rows = urls.map((u, i) => ({ user_id: user.id, set_id: setId, image_url: u, page_index: startIdx + i, role: null }));
      const { data, error } = await supabase.from("template_pages").insert(rows).select("*");
      if (error) throw error;
      setPages(prev => [...prev, ...((data as any) || [])]);
      toast.success(`${urls.length} page${urls.length === 1 ? "" : "s"} added`);
    } catch (e: any) { toast.error(e.message); }
    setUploading(false);
  }

  async function assignPageRole(pageId: string, role: string) {
    const page = pages.find(p => p.id === pageId);
    if (!page || !setId) return;
    const newRole = role === "unused" ? null : role;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    // Clear any other page in same role
    if (newRole) {
      await supabase.from("template_pages").update({ role: null }).eq("set_id", setId).eq("role", newRole);
    }
    await supabase.from("template_pages").update({ role: newRole }).eq("id", pageId);
    setPages(prev => prev.map(p => p.id === pageId ? { ...p, role: newRole } : (p.role === newRole ? { ...p, role: null } : p)));
    if (newRole) {
      // Upsert template background for that role
      await supabase.from("pdf_templates").upsert({
        user_id: user.id, set_id: setId, page_type: newRole, background_url: page.image_url,
        slots: (newRole === pageType ? slots : undefined) as any,
      } as any, { onConflict: "set_id,page_type" });
      if (newRole === pageType) setBgUrl(page.image_url);
      toast.success(`Mapped to ${newRole}`);
    }
  }

  async function deletePage(pageId: string) {
    await supabase.from("template_pages").delete().eq("id", pageId);
    setPages(prev => prev.filter(p => p.id !== pageId));
  }

  async function save() {
    if (!setId) return;
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not signed in");
      const { error } = await supabase.from("pdf_templates").upsert({
        user_id: user.id, set_id: setId, page_type: pageType, background_url: bgUrl, slots: slots as any,
      } as any, { onConflict: "set_id,page_type" });
      if (error) throw error;
      toast.success("Template saved");
    } catch (e: any) { toast.error(e.message); }
    setSaving(false);
  }

  async function reset() {
    if (!confirm("Clear background and all slots for this page?")) return;
    setBgUrl(null); setSlots([]); setSelectedIdx(null);
  }

  async function newSet() {
    const name = prompt("Set name?", "New template set");
    if (!name) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data, error } = await supabase.from("template_sets").insert({ user_id: user.id, name }).select("id,name").single();
    if (error) return toast.error(error.message);
    setSets(s => [...s, data!]); setSetId(data!.id);
  }

  async function renameSet() {
    if (!setId) return;
    const cur = sets.find(s => s.id === setId);
    const name = prompt("New name?", cur?.name);
    if (!name) return;
    await supabase.from("template_sets").update({ name }).eq("id", setId);
    setSets(s => s.map(x => x.id === setId ? { ...x, name } : x));
  }

  async function deleteSet() {
    if (!setId || sets.length <= 1) return toast.error("At least one set required");
    if (!confirm("Delete this set and all its templates?")) return;
    await supabase.from("template_sets").delete().eq("id", setId);
    const rest = sets.filter(s => s.id !== setId);
    setSets(rest); setSetId(rest[0]?.id || null);
  }

  const selected = selectedIdx != null ? slots[selectedIdx] : null;
  const selectedMeta = selected ? fields.find(f => f.field === selected.field) : null;

  return (
    <div className="p-8 max-w-[1600px] mx-auto">
      <p className="text-xs tracking-[0.3em] text-accent mb-2">DESIGNER</p>
      <h1 className="font-serif text-4xl mb-2">Template Mapper</h1>
      <p className="text-muted-foreground mb-6">Upload your page backgrounds (PDF or images) and drag fields onto each. Save layouts as named sets, then pick which set each export uses.</p>

      {/* Set selector */}
      <Card className="p-4 mb-4 flex flex-wrap items-center gap-3">
        <Label className="text-xs">Template set</Label>
        <Select value={setId || ""} onValueChange={setSetId}>
          <SelectTrigger className="w-64"><SelectValue /></SelectTrigger>
          <SelectContent>
            {sets.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Button variant="outline" size="sm" onClick={newSet}><Plus className="w-3 h-3 mr-1" />New set</Button>
        <Button variant="ghost" size="sm" onClick={renameSet}>Rename</Button>
        <Button variant="ghost" size="sm" onClick={deleteSet} className="text-destructive">Delete</Button>
      </Card>

      <Tabs value={pageType} onValueChange={(v) => setPageType(v as PageType)} className="mb-4">
        <TabsList>{PAGE_TABS.map(t => <TabsTrigger key={t.key} value={t.key}>{t.label}</TabsTrigger>)}</TabsList>
      </Tabs>

      {/* Multi-page upload + strip */}
      <Card className="p-4 mb-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-serif text-lg">Template pages</h3>
          <label className="cursor-pointer">
            <input type="file" accept="application/pdf,image/*" multiple className="hidden"
              onChange={(e) => { const fs = Array.from(e.target.files || []); if (fs.length) uploadPages(fs); e.target.value = ""; }} />
            <span className="inline-flex items-center px-3 py-2 text-sm bg-primary text-primary-foreground rounded hover:opacity-90">
              {uploading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <FilePlus2 className="w-4 h-4 mr-2" />}
              Upload PDF or images
            </span>
          </label>
        </div>
        <TemplatePagesStrip
          pages={pages}
          activeRole={pageType}
          onAssign={assignPageRole}
          onDelete={deletePage}
          onSelect={(p) => { setBgUrl(p.image_url); }}
        />
        {pages.length === 0 && <p className="text-sm text-muted-foreground">Upload a multi-page PDF (e.g. exported from Canva) — each page becomes a thumbnail you can map to Cover, Divider, Project, or Thank You.</p>}
      </Card>

      <div className="grid grid-cols-12 gap-4">
        <Card className="col-span-3 p-4 h-fit sticky top-4">
          <h3 className="font-serif text-lg mb-3">Available fields</h3>
          <div className="space-y-1">
            {fields.map(f => (
              <Button key={f.field} variant="ghost" size="sm" disabled={usedFields.has(f.field)}
                onClick={() => addSlot(f.field)} className="w-full justify-start">
                <Plus className="w-3 h-3 mr-2" />
                <span className="truncate">{f.label}</span>
                <span className="ml-auto text-[10px] text-muted-foreground">{f.kind}</span>
              </Button>
            ))}
          </div>
        </Card>

        <div className="col-span-6">
          <div className="flex items-center gap-2 mb-3">
            <label className="cursor-pointer">
              <input type="file" accept="image/*" className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadBackground(f); e.target.value = ""; }} />
              <span className="inline-flex items-center px-3 py-2 text-sm bg-secondary text-secondary-foreground rounded hover:opacity-90">
                {uploading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Upload className="w-4 h-4 mr-2" />}
                {bgUrl ? "Change background" : "Upload background"}
              </span>
            </label>
            {bgUrl && <Button variant="ghost" size="sm" onClick={() => setBgUrl(null)}><X className="w-4 h-4 mr-1" />Remove bg</Button>}
            <div className="flex-1" />
            <Button variant="outline" onClick={reset}>Reset</Button>
            <Button onClick={save} disabled={saving}>
              {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
              Save
            </Button>
          </div>

          <div ref={canvasRef}
            className="relative w-full bg-white border border-border shadow-card overflow-hidden"
            style={{ height: canvasSize.h }}
            onMouseDown={(e) => { if (e.target === e.currentTarget) setSelectedIdx(null); }}
          >
            {bgUrl && <img src={bgUrl} alt="" className="absolute inset-0 w-full h-full object-cover pointer-events-none" />}
            {!bgUrl && (
              <div className="absolute inset-0 flex items-center justify-center text-muted-foreground text-sm">
                Upload pages above and assign one to "{pageType}", or use a single background image.
              </div>
            )}
            {loading && <div className="absolute inset-0 bg-background/50 flex items-center justify-center"><Loader2 className="w-6 h-6 animate-spin" /></div>}

            {slots.map((s, i) => {
              const meta = fields.find(f => f.field === s.field);
              const isSel = i === selectedIdx;
              return (
                <Rnd key={i}
                  size={{ width: (s.w / 100) * canvasSize.w, height: (s.h / 100) * canvasSize.h }}
                  position={{ x: (s.x / 100) * canvasSize.w, y: (s.y / 100) * canvasSize.h }}
                  bounds="parent"
                  onDragStop={(_, d) => updateSlot(i, { x: (d.x / canvasSize.w) * 100, y: (d.y / canvasSize.h) * 100 })}
                  onResizeStop={(_, __, ref, ___, pos) => updateSlot(i, {
                    w: (ref.offsetWidth / canvasSize.w) * 100, h: (ref.offsetHeight / canvasSize.h) * 100,
                    x: (pos.x / canvasSize.w) * 100, y: (pos.y / canvasSize.h) * 100,
                  })}
                  onMouseDown={() => setSelectedIdx(i)}
                  className={`border-2 ${isSel ? "border-accent" : "border-primary/40"} ${meta?.kind === "image" ? "bg-primary/10" : "bg-accent/10"}`}
                >
                  <div className="w-full h-full flex items-center justify-center text-[10px] font-mono text-primary/80 px-1 text-center select-none">
                    {meta?.label || s.field}
                  </div>
                </Rnd>
              );
            })}
          </div>
        </div>

        <Card className="col-span-3 p-4 h-fit sticky top-4">
          <h3 className="font-serif text-lg mb-3">Properties</h3>
          {!selected && <p className="text-sm text-muted-foreground">Select a box on the canvas to edit.</p>}
          {selected && (
            <div className="space-y-3">
              <div><Label className="text-xs">Field</Label><p className="text-sm font-medium">{selectedMeta?.label}</p></div>
              <div className="grid grid-cols-2 gap-2">
                <div><Label className="text-xs">X %</Label><Input type="number" value={Math.round(selected.x)} onChange={e => updateSlot(selectedIdx!, { x: +e.target.value })} /></div>
                <div><Label className="text-xs">Y %</Label><Input type="number" value={Math.round(selected.y)} onChange={e => updateSlot(selectedIdx!, { y: +e.target.value })} /></div>
                <div><Label className="text-xs">W %</Label><Input type="number" value={Math.round(selected.w)} onChange={e => updateSlot(selectedIdx!, { w: +e.target.value })} /></div>
                <div><Label className="text-xs">H %</Label><Input type="number" value={Math.round(selected.h)} onChange={e => updateSlot(selectedIdx!, { h: +e.target.value })} /></div>
              </div>
              {selectedMeta?.kind === "text" && (
                <>
                  <div><Label className="text-xs">Font size (pt)</Label><Input type="number" value={selected.fontSize || 12} onChange={e => updateSlot(selectedIdx!, { fontSize: +e.target.value })} /></div>
                  <div><Label className="text-xs">Align</Label>
                    <Select value={selected.align || "left"} onValueChange={v => updateSlot(selectedIdx!, { align: v as any })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="left">Left</SelectItem><SelectItem value="center">Center</SelectItem><SelectItem value="right">Right</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div><Label className="text-xs">Color</Label><Input type="color" value={selected.color || "#000000"} onChange={e => updateSlot(selectedIdx!, { color: e.target.value })} /></div>
                  <label className="flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={!!selected.bold} onChange={e => updateSlot(selectedIdx!, { bold: e.target.checked })} />Bold
                  </label>
                </>
              )}
              <Button variant="destructive" size="sm" onClick={() => removeSlot(selectedIdx!)} className="w-full">
                <Trash2 className="w-4 h-4 mr-2" />Remove
              </Button>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
