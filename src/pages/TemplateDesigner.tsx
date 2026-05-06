import { useEffect, useMemo, useRef, useState } from "react";
import { Rnd } from "react-rnd";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Plus, Save, Trash2, Upload, X } from "lucide-react";
import { toast } from "sonner";
import { FIELDS_BY_TYPE, type Slot, type Template } from "@/lib/templateRender";

type PageType = Template["page_type"];

const PAGE_TABS: { key: PageType; label: string }[] = [
  { key: "cover", label: "Cover" },
  { key: "divider", label: "Category Divider" },
  { key: "project", label: "Project Page" },
  { key: "thankyou", label: "Thank You" },
];

// A4 landscape ratio: 297 x 210
const RATIO = 297 / 210;

export default function TemplateDesigner() {
  const [pageType, setPageType] = useState<PageType>("project");
  const [bgUrl, setBgUrl] = useState<string | null>(null);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const canvasRef = useRef<HTMLDivElement>(null);
  const [canvasSize, setCanvasSize] = useState({ w: 800, h: 800 / RATIO });

  useEffect(() => {
    const update = () => {
      if (!canvasRef.current) return;
      const w = canvasRef.current.clientWidth;
      setCanvasSize({ w, h: w / RATIO });
    };
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  useEffect(() => { (async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }
    const { data } = await supabase.from("pdf_templates")
      .select("*").eq("user_id", user.id).eq("page_type", pageType).maybeSingle();
    setBgUrl(data?.background_url || null);
    setSlots((data?.slots as any) || []);
    setSelectedIdx(null);
    setLoading(false);
  })(); }, [pageType]);

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

  function updateSlot(idx: number, patch: Partial<Slot>) {
    setSlots(prev => prev.map((s, i) => i === idx ? { ...s, ...patch } : s));
  }

  function removeSlot(idx: number) {
    setSlots(prev => prev.filter((_, i) => i !== idx));
    setSelectedIdx(null);
  }

  async function uploadBackground(file: File) {
    setUploading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not signed in");
      const path = `${user.id}/template-${pageType}-${Date.now()}-${file.name}`;
      const { error: upErr } = await supabase.storage.from("project-images").upload(path, file);
      if (upErr) throw upErr;
      const { data: { publicUrl } } = supabase.storage.from("project-images").getPublicUrl(path);
      setBgUrl(publicUrl);
      toast.success("Background uploaded");
    } catch (e: any) { toast.error(e.message); }
    setUploading(false);
  }

  async function save() {
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not signed in");
      const { error } = await supabase.from("pdf_templates").upsert({
        user_id: user.id, page_type: pageType, background_url: bgUrl, slots: slots as any,
      }, { onConflict: "user_id,page_type" });
      if (error) throw error;
      toast.success("Template saved");
    } catch (e: any) { toast.error(e.message); }
    setSaving(false);
  }

  async function reset() {
    if (!confirm("Clear background and all slots for this page?")) return;
    setBgUrl(null); setSlots([]); setSelectedIdx(null);
  }

  const selected = selectedIdx != null ? slots[selectedIdx] : null;
  const selectedMeta = selected ? fields.find(f => f.field === selected.field) : null;

  return (
    <div className="p-8 max-w-[1600px] mx-auto">
      <p className="text-xs tracking-[0.3em] text-accent mb-2">DESIGNER</p>
      <h1 className="font-serif text-4xl mb-2">Template Mapper</h1>
      <p className="text-muted-foreground mb-6">Upload your page background and drag fields onto it. Saved layouts are used automatically when you export PDFs.</p>

      <Tabs value={pageType} onValueChange={(v) => setPageType(v as PageType)} className="mb-6">
        <TabsList>{PAGE_TABS.map(t => <TabsTrigger key={t.key} value={t.key}>{t.label}</TabsTrigger>)}</TabsList>
      </Tabs>

      <div className="grid grid-cols-12 gap-4">
        {/* Left: fields */}
        <Card className="col-span-3 p-4 h-fit sticky top-4">
          <h3 className="font-serif text-lg mb-3">Available fields</h3>
          <div className="space-y-1">
            {fields.map(f => (
              <Button
                key={f.field}
                variant="ghost"
                size="sm"
                disabled={usedFields.has(f.field)}
                onClick={() => addSlot(f.field)}
                className="w-full justify-start"
              >
                <Plus className="w-3 h-3 mr-2" />
                <span className="truncate">{f.label}</span>
                <span className="ml-auto text-[10px] text-muted-foreground">{f.kind}</span>
              </Button>
            ))}
          </div>
        </Card>

        {/* Center: canvas */}
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

          <div
            ref={canvasRef}
            className="relative w-full bg-white border border-border shadow-card overflow-hidden"
            style={{ height: canvasSize.h }}
            onMouseDown={(e) => { if (e.target === e.currentTarget) setSelectedIdx(null); }}
          >
            {bgUrl && <img src={bgUrl} alt="" className="absolute inset-0 w-full h-full object-cover pointer-events-none" />}
            {!bgUrl && (
              <div className="absolute inset-0 flex items-center justify-center text-muted-foreground text-sm">
                Upload a background to start (or work on blank A4 landscape)
              </div>
            )}
            {loading && <div className="absolute inset-0 bg-background/50 flex items-center justify-center"><Loader2 className="w-6 h-6 animate-spin" /></div>}

            {slots.map((s, i) => {
              const meta = fields.find(f => f.field === s.field);
              const isSel = i === selectedIdx;
              return (
                <Rnd
                  key={i}
                  size={{ width: (s.w / 100) * canvasSize.w, height: (s.h / 100) * canvasSize.h }}
                  position={{ x: (s.x / 100) * canvasSize.w, y: (s.y / 100) * canvasSize.h }}
                  bounds="parent"
                  onDragStop={(_, d) => updateSlot(i, {
                    x: (d.x / canvasSize.w) * 100,
                    y: (d.y / canvasSize.h) * 100,
                  })}
                  onResizeStop={(_, __, ref, ___, pos) => updateSlot(i, {
                    w: (ref.offsetWidth / canvasSize.w) * 100,
                    h: (ref.offsetHeight / canvasSize.h) * 100,
                    x: (pos.x / canvasSize.w) * 100,
                    y: (pos.y / canvasSize.h) * 100,
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

        {/* Right: properties */}
        <Card className="col-span-3 p-4 h-fit sticky top-4">
          <h3 className="font-serif text-lg mb-3">Properties</h3>
          {!selected && <p className="text-sm text-muted-foreground">Select a box on the canvas to edit.</p>}
          {selected && (
            <div className="space-y-3">
              <div>
                <Label className="text-xs">Field</Label>
                <p className="text-sm font-medium">{selectedMeta?.label}</p>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div><Label className="text-xs">X %</Label><Input type="number" value={Math.round(selected.x)} onChange={e => updateSlot(selectedIdx!, { x: +e.target.value })} /></div>
                <div><Label className="text-xs">Y %</Label><Input type="number" value={Math.round(selected.y)} onChange={e => updateSlot(selectedIdx!, { y: +e.target.value })} /></div>
                <div><Label className="text-xs">W %</Label><Input type="number" value={Math.round(selected.w)} onChange={e => updateSlot(selectedIdx!, { w: +e.target.value })} /></div>
                <div><Label className="text-xs">H %</Label><Input type="number" value={Math.round(selected.h)} onChange={e => updateSlot(selectedIdx!, { h: +e.target.value })} /></div>
              </div>
              {selectedMeta?.kind === "text" && (
                <>
                  <div>
                    <Label className="text-xs">Font size (pt)</Label>
                    <Input type="number" value={selected.fontSize || 12} onChange={e => updateSlot(selectedIdx!, { fontSize: +e.target.value })} />
                  </div>
                  <div>
                    <Label className="text-xs">Align</Label>
                    <Select value={selected.align || "left"} onValueChange={v => updateSlot(selectedIdx!, { align: v as any })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="left">Left</SelectItem>
                        <SelectItem value="center">Center</SelectItem>
                        <SelectItem value="right">Right</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs">Color</Label>
                    <Input type="color" value={selected.color || "#000000"} onChange={e => updateSlot(selectedIdx!, { color: e.target.value })} />
                  </div>
                  <label className="flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={!!selected.bold} onChange={e => updateSlot(selectedIdx!, { bold: e.target.checked })} />
                    Bold
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
