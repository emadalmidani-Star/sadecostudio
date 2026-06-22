import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "@/hooks/use-toast";
import { Plus, Trash2, ArrowUp, ArrowDown, Upload, Monitor, Smartphone, ExternalLink } from "lucide-react";
import { renderBlocks, defaultBlocks, type EmailBlock } from "@/lib/emailRender";

export default function EmailTemplates() {
  const { user } = useAuth();
  const [device, setDevice] = useState<"desktop" | "mobile">("desktop");
  const [list, setList] = useState<any[]>([]);
  const [cur, setCur] = useState<any | null>(null);

  async function load() {
    const { data } = await supabase.from("email_templates").select("*").order("updated_at", { ascending: false });
    setList(data || []);
  }
  useEffect(() => { load(); }, [user?.id]);

  async function create(preset: "brand" | "minimal") {
    if (!user) return;
    const { data, error } = await supabase.from("email_templates").insert({
      user_id: user.id, name: `New ${preset} template`, preset, subject: "Hello {{name}}", blocks: defaultBlocks(preset),
    }).select().single();
    if (error) return toast({ title: "Failed", description: error.message, variant: "destructive" });
    setCur(data); load();
  }

  async function save() {
    if (!cur) return;
    const { error } = await supabase.from("email_templates").update({
      name: cur.name, subject: cur.subject, preheader: cur.preheader, preset: cur.preset, blocks: cur.blocks,
    }).eq("id", cur.id);
    if (error) toast({ title: "Save failed", description: error.message, variant: "destructive" });
    else { toast({ title: "Saved" }); load(); }
  }

  async function del(id: string) {
    await supabase.from("email_templates").delete().eq("id", id);
    if (cur?.id === id) setCur(null);
    load();
  }

  function updateBlock(i: number, patch: any) {
    const blocks = [...cur.blocks]; blocks[i] = { ...blocks[i], ...patch }; setCur({ ...cur, blocks });
  }
  function move(i: number, dir: -1 | 1) {
    const blocks = [...cur.blocks]; const j = i + dir; if (j < 0 || j >= blocks.length) return;
    [blocks[i], blocks[j]] = [blocks[j], blocks[i]]; setCur({ ...cur, blocks });
  }
  function addBlock(type: EmailBlock["type"]) {
    const defaults: Record<string, EmailBlock> = {
      heading: { type: "heading", text: "Heading" },
      text: { type: "text", text: "Some text…" },
      image: { type: "image", url: "https://images.unsplash.com/photo-1505691938895-1758d7feb511?w=1200&q=60" },
      button: { type: "button", text: "Click me", url: "https://" },
      divider: { type: "divider" },
      spacer: { type: "spacer", height: 24 },
      video: { type: "video", url: "https://youtu.be/", thumbnail: "https://images.unsplash.com/photo-1517077304055-6e89abbf09b0?w=1200&q=60", title: "Watch our video" },
      gallery: { type: "gallery", layout: "side", images: [
        { url: "https://images.unsplash.com/photo-1505691938895-1758d7feb511?w=800&q=60", alt: "" },
        { url: "https://images.unsplash.com/photo-1493663284031-b7e3aefcae8e?w=800&q=60", alt: "" },
      ] },
      social: { type: "social", links: [
        { platform: "instagram", url: "https://instagram.com/" },
        { platform: "facebook", url: "https://facebook.com/" },
        { platform: "linkedin", url: "https://linkedin.com/" },
      ] },
    };
    setCur({ ...cur, blocks: [...cur.blocks, defaults[type]] });
  }
  function removeBlock(i: number) {
    const blocks = cur.blocks.filter((_: any, idx: number) => idx !== i); setCur({ ...cur, blocks });
  }

  const preview = cur && renderBlocks(cur, {
    siteName: "Your Brand", logoUrl: null, physicalAddress: "123 Example St", unsubscribeUrl: "#", recipientName: "Jane",
  });

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-serif">Templates</h1>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => create("minimal")}><Plus className="w-4 h-4 mr-1" />Minimal</Button>
          <Button size="sm" onClick={() => create("brand")}><Plus className="w-4 h-4 mr-1" />Brand</Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-3 space-y-2">
          {list.map(t => (
            <Card key={t.id} className={`cursor-pointer ${cur?.id === t.id ? "border-accent" : ""}`} onClick={() => setCur(t)}>
              <CardContent className="p-3 flex items-center justify-between">
                <div className="min-w-0">
                  <div className="text-sm font-medium truncate">{t.name}</div>
                  <div className="text-xs text-muted-foreground">{t.preset}</div>
                </div>
                <Button size="sm" variant="ghost" onClick={(e) => { e.stopPropagation(); del(t.id); }}><Trash2 className="w-3.5 h-3.5" /></Button>
              </CardContent>
            </Card>
          ))}
        </div>

        {cur && (
          <>
            <div className="lg:col-span-5 space-y-3">
              <div><Label>Name</Label><Input value={cur.name} onChange={e => setCur({ ...cur, name: e.target.value })} /></div>
              <div><Label>Subject</Label><Input value={cur.subject || ""} onChange={e => setCur({ ...cur, subject: e.target.value })} /></div>
              <div><Label>Preheader</Label><Input value={cur.preheader || ""} onChange={e => setCur({ ...cur, preheader: e.target.value })} /></div>
              <div className="border rounded-md p-3 space-y-3">
                {cur.blocks.map((b: any, i: number) => (
                  <div key={i} className="border rounded p-2 space-y-2 bg-muted/30">
                    <div className="flex items-center justify-between">
                      <span className="text-xs uppercase tracking-wide text-muted-foreground">{b.type}</span>
                      <div className="flex gap-1">
                        <Button size="sm" variant="ghost" onClick={() => move(i, -1)}><ArrowUp className="w-3 h-3" /></Button>
                        <Button size="sm" variant="ghost" onClick={() => move(i, 1)}><ArrowDown className="w-3 h-3" /></Button>
                        <Button size="sm" variant="ghost" onClick={() => removeBlock(i)}><Trash2 className="w-3 h-3" /></Button>
                      </div>
                    </div>
                    {b.type === "heading" && <Input value={b.text} onChange={e => updateBlock(i, { text: e.target.value })} />}
                    {b.type === "text" && <Textarea rows={3} value={b.text} onChange={e => updateBlock(i, { text: e.target.value })} />}
                    {b.type === "image" && <Input value={b.url} onChange={e => updateBlock(i, { url: e.target.value })} placeholder="Image URL" />}
                    {b.type === "button" && (
                      <>
                        <Input value={b.text} onChange={e => updateBlock(i, { text: e.target.value })} placeholder="Label" />
                        <Input value={b.url} onChange={e => updateBlock(i, { url: e.target.value })} placeholder="URL" />
                      </>
                    )}
                    {b.type === "video" && (
                      <>
                        <Input value={b.url} onChange={e => updateBlock(i, { url: e.target.value })} placeholder="Video URL (YouTube / Vimeo / direct link)" />
                        <div className="flex gap-2 items-start">
                          <Input value={b.thumbnail} onChange={e => updateBlock(i, { thumbnail: e.target.value })} placeholder="Thumbnail image URL" />
                          <label className="shrink-0">
                            <input
                              type="file"
                              accept="image/*"
                              className="hidden"
                              onChange={async (e) => {
                                const file = e.target.files?.[0]; if (!file || !user) return;
                                const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
                                const path = `${user.id}/email-thumbs/${crypto.randomUUID()}.${ext}`;
                                const { error } = await supabase.storage.from("company-assets").upload(path, file, { contentType: file.type, upsert: true });
                                if (error) return toast({ title: "Upload failed", description: error.message, variant: "destructive" });
                                const { data } = supabase.storage.from("company-assets").getPublicUrl(path);
                                updateBlock(i, { thumbnail: data.publicUrl });
                                toast({ title: "Thumbnail uploaded" });
                              }}
                            />
                            <span className="inline-flex items-center gap-1 h-9 px-3 border rounded-md text-sm cursor-pointer hover:bg-accent">
                              <Upload className="w-3.5 h-3.5" /> Upload
                            </span>
                          </label>
                        </div>
                        {b.thumbnail && <img src={b.thumbnail} alt="" className="w-full max-h-32 object-cover rounded border" />}
                        <Input value={b.alt || ""} onChange={e => updateBlock(i, { alt: e.target.value })} placeholder="Alt text (for accessibility / image blocking)" />
                        <Input value={b.playLabel || ""} onChange={e => updateBlock(i, { playLabel: e.target.value })} placeholder="Play-button label (e.g. ‘Watch the tour’)" />
                        <Input value={b.title || ""} onChange={e => updateBlock(i, { title: e.target.value })} placeholder="Caption title (optional)" />
                        <p className="text-[11px] text-muted-foreground">Email clients don't play video inline — this renders a clickable thumbnail that opens the video URL.</p>
                      </>
                    )}
                    {b.type === "gallery" && (
                      <>
                        <select
                          className="w-full border rounded h-9 px-2 bg-background text-sm"
                          value={b.layout || "side"}
                          onChange={e => updateBlock(i, { layout: e.target.value })}
                        >
                          <option value="side">Side by side (2)</option>
                          <option value="grid">Grid (up to 4)</option>
                        </select>
                        {(b.images || []).map((im: any, k: number) => (
                          <div key={k} className="space-y-1 border-l-2 pl-2">
                            <Input value={im.url} onChange={e => {
                              const images = [...b.images]; images[k] = { ...im, url: e.target.value }; updateBlock(i, { images });
                            }} placeholder="Image URL" />
                            <Input value={im.caption || ""} onChange={e => {
                              const images = [...b.images]; images[k] = { ...im, caption: e.target.value }; updateBlock(i, { images });
                            }} placeholder="Caption (optional)" />
                            <Button size="sm" variant="ghost" onClick={() => {
                              const images = b.images.filter((_: any, x: number) => x !== k); updateBlock(i, { images });
                            }}>Remove image</Button>
                          </div>
                        ))}
                        {(b.images?.length || 0) < 4 && (
                          <Button size="sm" variant="outline" onClick={() => updateBlock(i, { images: [...(b.images || []), { url: "" }] })}>+ Add image</Button>
                        )}
                      </>
                    )}
                    {b.type === "social" && (
                      <>
                        <select
                          className="w-full border rounded h-9 px-2 bg-background text-sm"
                          value={b.iconStyle || "color"}
                          onChange={e => updateBlock(i, { iconStyle: e.target.value })}
                        >
                          <option value="color">Colored icons</option>
                          <option value="mono">Monochrome icons</option>
                        </select>
                        {(b.links || []).map((l: any, k: number) => (
                          <div key={k} className="flex gap-2">
                            <select
                              className="border rounded h-9 px-2 bg-background text-sm"
                              value={l.platform}
                              onChange={e => {
                                const links = [...b.links]; links[k] = { ...l, platform: e.target.value }; updateBlock(i, { links });
                              }}
                            >
                              {["instagram","facebook","linkedin","youtube","tiktok","twitter","website"].map(p => <option key={p} value={p}>{p}</option>)}
                            </select>
                            <Input value={l.url} onChange={e => {
                              const links = [...b.links]; links[k] = { ...l, url: e.target.value }; updateBlock(i, { links });
                            }} placeholder="https://" />
                            <Button size="sm" variant="ghost" onClick={() => {
                              const links = b.links.filter((_: any, x: number) => x !== k); updateBlock(i, { links });
                            }}><Trash2 className="w-3 h-3" /></Button>
                          </div>
                        ))}
                        <Button size="sm" variant="outline" onClick={() => updateBlock(i, { links: [...(b.links || []), { platform: "instagram", url: "" }] })}>+ Add link</Button>
                      </>
                    )}
                  </div>
                ))}
                <div className="flex flex-wrap gap-2 pt-2 border-t">
                  {(["heading", "text", "image", "gallery", "video", "button", "social", "divider", "spacer"] as const).map(t => (
                    <Button key={t} size="sm" variant="outline" onClick={() => addBlock(t)}>+ {t}</Button>
                  ))}
                </div>
              </div>
              <Button onClick={save}>Save template</Button>
            </div>
            <div className="lg:col-span-4">
              <div className="sticky top-4 space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="m-0">Live preview</Label>
                  <div className="flex items-center gap-1">
                    <Button size="sm" variant={device === "desktop" ? "default" : "outline"} onClick={() => setDevice("desktop")} title="Desktop">
                      <Monitor className="w-3.5 h-3.5" />
                    </Button>
                    <Button size="sm" variant={device === "mobile" ? "default" : "outline"} onClick={() => setDevice("mobile")} title="Mobile">
                      <Smartphone className="w-3.5 h-3.5" />
                    </Button>
                    <Button size="sm" variant="outline" title="Open in new tab" onClick={() => {
                      const w = window.open("", "_blank"); if (w) { w.document.open(); w.document.write(preview || ""); w.document.close(); }
                    }}>
                      <ExternalLink className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
                <p className="text-[11px] text-muted-foreground">Updates as you type — video thumbnails, gallery layout and social icons render exactly as they'll be sent.</p>
                <div className="border rounded-md bg-muted/40 p-3 flex justify-center overflow-auto">
                  <iframe
                    srcDoc={preview}
                    title="preview"
                    className="bg-white border rounded shadow-sm transition-all"
                    style={{ width: device === "mobile" ? 380 : "100%", height: 700 }}
                  />
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
          </>
        )}
      </div>
    </div>
  );
}
