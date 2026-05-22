import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { CalendarClock, Sparkles, Loader2, Linkedin, Save, Send, Trash2, ImagePlus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";
import LazyImage from "@/components/LazyImage";
import { cn } from "@/lib/utils";

type Project = {
  id: string; name: string; client_name: string | null; location: string | null;
  type: string | null; area_sqm: number | null; status: string | null; phase: string | null;
  progress_pct: number | null; estimated_completion: string | null; description: string | null;
  cover_image: string | null; images: any; highlights: any;
};

type PostRow = {
  id: string; project_id: string | null; content: string; image_urls: string[];
  scheduled_for: string | null; status: string; created_at: string; updated_at: string;
};

function projectImages(p: Project | null): string[] {
  if (!p) return [];
  const arr = Array.isArray(p.images) ? p.images.filter((x: any) => typeof x === "string") : [];
  const all = p.cover_image ? [p.cover_image, ...arr] : arr;
  return Array.from(new Set(all));
}

export default function MarketingScheduler() {
  const { user } = useAuth();
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectId, setProjectId] = useState<string>("");
  const [tone, setTone] = useState("professional");
  const [length, setLength] = useState("medium");
  const [hashtags, setHashtags] = useState(true);
  const [content, setContent] = useState("");
  const [selectedImages, setSelectedImages] = useState<string[]>([]);
  const [scheduledFor, setScheduledFor] = useState<string>("");
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [posts, setPosts] = useState<PostRow[]>([]);
  const [hasLinkedIn, setHasLinkedIn] = useState(false);

  const project = useMemo(() => projects.find((p) => p.id === projectId) || null, [projects, projectId]);
  const images = useMemo(() => projectImages(project), [project]);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("projects")
        .select("id,name,client_name,location,type,area_sqm,status,phase,progress_pct,estimated_completion,description,cover_image,images,highlights")
        .order("updated_at", { ascending: false });
      setProjects((data as Project[]) || []);
    })();
  }, []);

  async function loadPosts() {
    if (!user) return;
    const { data } = await supabase
      .from("scheduled_posts").select("*").eq("user_id", user.id)
      .order("created_at", { ascending: false }).limit(20);
    setPosts((data as any) || []);
  }
  useEffect(() => { loadPosts(); }, [user?.id]);

  useEffect(() => {
    if (!user) return;
    supabase.from("linkedin_connections").select("user_id").eq("user_id", user.id).maybeSingle()
      .then(({ data }) => setHasLinkedIn(!!data));
  }, [user?.id]);

  useEffect(() => { setSelectedImages([]); }, [projectId]);

  async function generate() {
    if (!project) { toast({ title: "Pick a project first", variant: "destructive" }); return; }
    setGenerating(true);
    const { data, error } = await supabase.functions.invoke("generate-linkedin-post", {
      body: { project, tone, length, hashtags },
    });
    setGenerating(false);
    if (error || !data?.content) {
      toast({ title: "Could not draft post", description: error?.message || data?.error, variant: "destructive" });
      return;
    }
    setContent(data.content);
  }

  async function save(asScheduled: boolean) {
    if (!user) return;
    if (!content.trim()) { toast({ title: "Write or generate post content first", variant: "destructive" }); return; }
    if (asScheduled && !scheduledFor) { toast({ title: "Pick a date & time to schedule", variant: "destructive" }); return; }
    setSaving(true);
    const { error } = await supabase.from("scheduled_posts").insert({
      user_id: user.id,
      project_id: project?.id ?? null,
      platform: "linkedin",
      content: content.trim(),
      image_urls: selectedImages,
      scheduled_for: asScheduled ? new Date(scheduledFor).toISOString() : null,
      status: asScheduled ? "scheduled" : "draft",
    });
    setSaving(false);
    if (error) { toast({ title: "Save failed", description: error.message, variant: "destructive" }); return; }
    toast({ title: asScheduled ? "Post scheduled" : "Draft saved" });
    setContent(""); setSelectedImages([]); setScheduledFor("");
    loadPosts();
  }

  async function removePost(id: string) {
    await supabase.from("scheduled_posts").delete().eq("id", id);
    loadPosts();
  }

  return (
    <div className="p-8 max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="font-serif text-4xl">Post Scheduler</h1>
        <p className="text-muted-foreground mt-1">Draft a LinkedIn post from a project, edit, and schedule.</p>
      </div>

      {!hasLinkedIn && (
        <div className="rounded-md border border-dashed p-3 text-sm text-muted-foreground flex items-center gap-2">
          <Linkedin className="w-4 h-4" /> LinkedIn isn't connected yet — scheduled posts will queue but cannot publish until you connect on the Connections page.
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Sparkles className="w-5 h-5 text-accent" /> Compose
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <div className="md:col-span-2 space-y-1.5">
              <Label>Project</Label>
              <Select value={projectId} onValueChange={setProjectId}>
                <SelectTrigger><SelectValue placeholder="Select project…" /></SelectTrigger>
                <SelectContent>
                  {projects.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}{p.client_name ? ` · ${p.client_name}` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Tone</Label>
              <Select value={tone} onValueChange={setTone}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="professional">Professional</SelectItem>
                  <SelectItem value="confident">Confident</SelectItem>
                  <SelectItem value="warm">Warm</SelectItem>
                  <SelectItem value="celebratory">Celebratory</SelectItem>
                  <SelectItem value="storytelling">Storytelling</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Length</Label>
              <Select value={length} onValueChange={setLength}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="short">Short</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="long">Long</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Button onClick={generate} disabled={generating || !projectId}>
              {generating ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Sparkles className="w-4 h-4 mr-2" />}
              {content ? "Regenerate" : "Draft with AI"}
            </Button>
            <label className="text-sm text-muted-foreground inline-flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={hashtags} onChange={(e) => setHashtags(e.target.checked)} />
              Include hashtags
            </label>
            <span className="ml-auto text-xs text-muted-foreground">{content.length} chars</span>
          </div>

          <div className="space-y-1.5">
            <Label>Post content</Label>
            <Textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Your post will appear here. You can edit freely before saving or scheduling."
              className="min-h-[220px] font-sans"
            />
          </div>

          {images.length > 0 && (
            <div className="space-y-2">
              <Label className="flex items-center gap-2"><ImagePlus className="w-4 h-4" /> Attach images <span className="text-muted-foreground font-normal">({selectedImages.length} selected)</span></Label>
              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2">
                {images.map((url) => {
                  const sel = selectedImages.includes(url);
                  return (
                    <button
                      type="button"
                      key={url}
                      onClick={() => setSelectedImages((s) => sel ? s.filter((u) => u !== url) : [...s, url])}
                      className={cn(
                        "relative aspect-square rounded-md overflow-hidden border-2 transition",
                        sel ? "border-primary ring-2 ring-primary/30" : "border-transparent hover:border-muted-foreground/30"
                      )}
                    >
                      <LazyImage src={url} alt="" className="w-full h-full object-cover" />
                      {sel && <span className="absolute top-1 right-1 bg-primary text-primary-foreground text-[10px] px-1.5 py-0.5 rounded">✓</span>}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_auto] gap-3 items-end pt-2 border-t">
            <div className="space-y-1.5">
              <Label className="flex items-center gap-2"><CalendarClock className="w-4 h-4" /> Schedule for</Label>
              <Input
                type="datetime-local"
                value={scheduledFor}
                onChange={(e) => setScheduledFor(e.target.value)}
              />
            </div>
            <Button variant="outline" onClick={() => save(false)} disabled={saving}>
              <Save className="w-4 h-4 mr-2" /> Save draft
            </Button>
            <Button onClick={() => save(true)} disabled={saving}>
              <Send className="w-4 h-4 mr-2" /> Schedule
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-lg">Recent</CardTitle></CardHeader>
        <CardContent>
          {posts.length === 0 ? (
            <p className="text-sm text-muted-foreground">No drafts or scheduled posts yet.</p>
          ) : (
            <ul className="divide-y">
              {posts.map((p) => (
                <li key={p.id} className="py-3 flex items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <Badge variant={p.status === "scheduled" ? "default" : p.status === "published" ? "secondary" : "outline"}>
                        {p.status}
                      </Badge>
                      {p.scheduled_for && (
                        <span className="text-xs text-muted-foreground">
                          {new Date(p.scheduled_for).toLocaleString()}
                        </span>
                      )}
                      {Array.isArray(p.image_urls) && p.image_urls.length > 0 && (
                        <span className="text-xs text-muted-foreground">· {p.image_urls.length} image{p.image_urls.length > 1 ? "s" : ""}</span>
                      )}
                    </div>
                    <p className="text-sm whitespace-pre-wrap line-clamp-3">{p.content}</p>
                  </div>
                  <Button variant="ghost" size="icon" onClick={() => removePost(p.id)}>
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
