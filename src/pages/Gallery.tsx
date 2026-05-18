import { useEffect, useMemo, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Search, ChevronLeft, ChevronRight, ExternalLink, X, Images } from "lucide-react";
import LazyImage from "@/components/LazyImage";
import EmptyState from "@/components/EmptyState";
import { cn } from "@/lib/utils";

type Img = { url: string; projectId: string; projectName: string; location: string; status: string };
type Density = "sm" | "md" | "lg";
type StatusFilter = "all" | "ongoing" | "in_progress" | "completed";

const DENSITY_KEY = "sadeco.gallery.density";

export default function Gallery() {
  const [projects, setProjects] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [projectFilter, setProjectFilter] = useState<string>("all");
  const [density, setDensity] = useState<Density>(() => (localStorage.getItem(DENSITY_KEY) as Density) || "md");
  const [lightboxIdx, setLightboxIdx] = useState<number | null>(null);

  useEffect(() => { localStorage.setItem(DENSITY_KEY, density); }, [density]);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data } = await supabase
        .from("projects")
        .select("id,name,location,status,cover_image,images")
        .order("updated_at", { ascending: false });
      setProjects(data || []);
      setLoading(false);
    })();
  }, []);

  const images: Img[] = useMemo(() => {
    const out: Img[] = [];
    for (const p of projects) {
      const seen = new Set<string>();
      const push = (url?: string | null) => {
        if (!url || seen.has(url)) return;
        seen.add(url);
        out.push({ url, projectId: p.id, projectName: p.name, location: p.location || "", status: p.status });
      };
      push(p.cover_image);
      const arr = Array.isArray(p.images) ? p.images : [];
      for (const im of arr) {
        if (typeof im === "string") push(im);
        else if (im && typeof im === "object") push(im.url || im.src);
      }
    }
    return out;
  }, [projects]);

  const filtered = useMemo(() => {
    const text = q.trim().toLowerCase();
    return images.filter(im =>
      (status === "all" || im.status === status) &&
      (projectFilter === "all" || im.projectId === projectFilter) &&
      (text === "" || im.projectName?.toLowerCase().includes(text) || im.location?.toLowerCase().includes(text))
    );
  }, [images, q, status, projectFilter]);

  const close = useCallback(() => setLightboxIdx(null), []);
  const prev = useCallback(() => setLightboxIdx(i => (i === null ? i : (i - 1 + filtered.length) % filtered.length)), [filtered.length]);
  const next = useCallback(() => setLightboxIdx(i => (i === null ? i : (i + 1) % filtered.length)), [filtered.length]);

  useEffect(() => {
    if (lightboxIdx === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") prev();
      else if (e.key === "ArrowRight") next();
      else if (e.key === "Escape") close();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [lightboxIdx, prev, next, close]);

  const cols = density === "sm" ? "columns-2 md:columns-4 lg:columns-6" : density === "lg" ? "columns-1 md:columns-2 lg:columns-3" : "columns-2 md:columns-3 lg:columns-4";

  const active = lightboxIdx !== null ? filtered[lightboxIdx] : null;

  return (
    <div className="p-6 md:p-10 max-w-7xl mx-auto">
      <div className="flex items-end justify-between mb-8 gap-4 flex-wrap">
        <div>
          <p className="eyebrow mb-2">PORTFOLIO</p>
          <h1 className="page-title">Gallery</h1>
          <p className="text-sm text-muted-foreground mt-1">All project imagery in one place.</p>
        </div>
        <div className="text-sm text-muted-foreground">{filtered.length} {filtered.length === 1 ? "image" : "images"}</div>
      </div>

      <div className="flex flex-wrap items-center gap-3 mb-6">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input value={q} onChange={e => setQ(e.target.value)} placeholder="Search by project or location…" className="pl-9" />
        </div>

        <div className="flex gap-1 bg-muted p-1 rounded">
          {(["all","ongoing","in_progress","completed"] as const).map(f => (
            <button key={f} onClick={() => setStatus(f)}
              className={cn("px-3 py-1.5 text-sm rounded transition-colors capitalize", status === f ? "bg-background shadow-sm" : "text-muted-foreground")}>
              {f === "in_progress" ? "In Progress" : f}
            </button>
          ))}
        </div>

        <select
          value={projectFilter}
          onChange={(e) => setProjectFilter(e.target.value)}
          className="h-9 px-3 rounded border border-input bg-background text-sm"
        >
          <option value="all">All projects</option>
          {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>

        <div className="flex gap-1 bg-muted p-1 rounded ml-auto">
          {(["sm","md","lg"] as Density[]).map(d => (
            <button key={d} onClick={() => setDensity(d)}
              className={cn("px-2.5 py-1.5 rounded text-xs uppercase tracking-wider", density === d ? "bg-background shadow-sm" : "text-muted-foreground")}>
              {d === "sm" ? "S" : d === "md" ? "M" : "L"}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className={cn(cols, "gap-3 [column-fill:_balance]")}>
          {Array.from({ length: 12 }).map((_, i) => (
            <Skeleton key={i} className="mb-3 w-full" style={{ height: 120 + ((i * 37) % 180) }} />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          title={images.length === 0 ? "No images yet." : "No images match your filters."}
          actionLabel={images.length === 0 ? "Go to Projects" : undefined}
          actionTo={images.length === 0 ? "/projects" : undefined}
        />
      ) : (
        <div className={cn(cols, "gap-3 [column-fill:_balance]")}>
          {filtered.map((im, i) => (
            <button
              key={`${im.projectId}-${im.url}-${i}`}
              onClick={() => setLightboxIdx(i)}
              className="mb-3 block w-full break-inside-avoid overflow-hidden rounded shadow-card hover:shadow-elegant transition-shadow group relative bg-muted"
            >
              <div className="w-full">
                {/* eslint-disable-next-line jsx-a11y/alt-text */}
                <img
                  loading="lazy"
                  decoding="async"
                  src={im.url}
                  alt={im.projectName}
                  className="w-full h-auto block group-hover:scale-[1.02] transition-transform duration-500"
                />
              </div>
              <div className="absolute inset-x-0 bottom-0 p-3 bg-gradient-to-t from-black/70 to-transparent text-white opacity-0 group-hover:opacity-100 transition-opacity">
                <p className="text-xs font-serif truncate">{im.projectName}</p>
                {im.location && <p className="text-[10px] text-white/70 truncate">{im.location}</p>}
              </div>
            </button>
          ))}
        </div>
      )}

      <Dialog open={lightboxIdx !== null} onOpenChange={(v) => { if (!v) close(); }}>
        <DialogContent className="max-w-6xl p-0 bg-background border-0 overflow-hidden">
          {active && (
            <div className="relative">
              <div className="bg-black flex items-center justify-center max-h-[80vh]">
                <LazyImage src={active.url} alt={active.projectName} className="!h-auto max-h-[80vh] w-auto object-contain" />
              </div>
              <button onClick={close} aria-label="Close" className="absolute top-3 right-3 bg-background/80 hover:bg-background rounded-full p-2 shadow">
                <X className="w-4 h-4" />
              </button>
              {filtered.length > 1 && (
                <>
                  <button onClick={prev} aria-label="Previous" className="absolute left-3 top-1/2 -translate-y-1/2 bg-background/80 hover:bg-background rounded-full p-2 shadow">
                    <ChevronLeft className="w-5 h-5" />
                  </button>
                  <button onClick={next} aria-label="Next" className="absolute right-3 top-1/2 -translate-y-1/2 bg-background/80 hover:bg-background rounded-full p-2 shadow">
                    <ChevronRight className="w-5 h-5" />
                  </button>
                </>
              )}
              <div className="flex items-center justify-between gap-3 p-4 border-t">
                <div className="min-w-0">
                  <h3 className="font-serif text-lg truncate">{active.projectName}</h3>
                  <p className="text-xs text-muted-foreground truncate">
                    {active.location || "—"}{filtered.length > 1 && ` · ${(lightboxIdx ?? 0) + 1} / ${filtered.length}`}
                  </p>
                </div>
                <Button asChild size="sm" variant="outline">
                  <Link to={`/projects/${active.projectId}`} onClick={close}>
                    <ExternalLink className="w-3.5 h-3.5 mr-2" />Open project
                  </Link>
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
