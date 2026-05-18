import { useEffect, useMemo, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Search, ChevronLeft, ChevronRight, ExternalLink, X, ArrowLeft, ImageIcon } from "lucide-react";
import LazyImage from "@/components/LazyImage";
import EmptyState from "@/components/EmptyState";
import { cn } from "@/lib/utils";

type StatusFilter = "all" | "ongoing" | "in_progress" | "completed";

function collectImages(p: any): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  const push = (url?: string | null) => {
    if (!url || typeof url !== "string" || seen.has(url)) return;
    seen.add(url); out.push(url);
  };
  push(p.cover_image);
  const arr = Array.isArray(p.images) ? p.images : [];
  for (const im of arr) {
    if (typeof im === "string") push(im);
    else if (im && typeof im === "object") push(im.url || im.src);
  }
  return out;
}

export default function Gallery() {
  const [projects, setProjects] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [activeProject, setActiveProject] = useState<any | null>(null);
  const [lightboxIdx, setLightboxIdx] = useState<number | null>(null);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data } = await supabase
        .from("projects")
        .select("id,name,location,client_name,status,cover_image,images,updated_at")
        .order("updated_at", { ascending: false });
      setProjects(data || []);
      setLoading(false);
    })();
  }, []);

  const projectsWithImages = useMemo(() =>
    projects.map(p => ({ ...p, _images: collectImages(p) })).filter(p => p._images.length > 0)
  , [projects]);

  const filtered = useMemo(() => {
    const text = q.trim().toLowerCase();
    return projectsWithImages.filter(p =>
      (status === "all" || p.status === status) &&
      (text === "" ||
        p.name?.toLowerCase().includes(text) ||
        (p.location || "").toLowerCase().includes(text) ||
        (p.client_name || "").toLowerCase().includes(text))
    );
  }, [projectsWithImages, q, status]);

  const activeImages: string[] = activeProject?._images ?? [];

  const close = useCallback(() => setLightboxIdx(null), []);
  const prev = useCallback(() => setLightboxIdx(i => (i === null ? i : (i - 1 + activeImages.length) % activeImages.length)), [activeImages.length]);
  const next = useCallback(() => setLightboxIdx(i => (i === null ? i : (i + 1) % activeImages.length)), [activeImages.length]);

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

  // ---------- Project detail view ----------
  if (activeProject) {
    return (
      <div className="p-6 md:p-10 max-w-screen-2xl mx-auto">
        <button
          onClick={() => { setActiveProject(null); setLightboxIdx(null); }}
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-6"
        >
          <ArrowLeft className="w-4 h-4" /> Back to gallery
        </button>

        <div className="flex items-end justify-between mb-8 gap-4 flex-wrap">
          <div>
            <p className="eyebrow mb-2">{activeProject.client_name || "PROJECT"}</p>
            <h1 className="page-title">{activeProject.name}</h1>
            <p className="text-sm text-muted-foreground mt-1">
              {activeProject.location || "—"} · {activeImages.length} {activeImages.length === 1 ? "image" : "images"}
            </p>
          </div>
          <Button asChild variant="outline">
            <Link to={`/projects/${activeProject.id}`}>
              <ExternalLink className="w-3.5 h-3.5 mr-2" />Open project
            </Link>
          </Button>
        </div>

        <div className="columns-2 md:columns-3 lg:columns-4 xl:columns-5 2xl:columns-6 gap-3 [column-fill:_balance]">
          {activeImages.map((url, i) => (
            <button
              key={`${url}-${i}`}
              onClick={() => setLightboxIdx(i)}
              className="mb-3 block w-full break-inside-avoid overflow-hidden rounded shadow-card hover:shadow-elegant transition-shadow group bg-muted"
            >
              {/* eslint-disable-next-line jsx-a11y/alt-text */}
              <img
                loading="lazy"
                decoding="async"
                src={url}
                alt={activeProject.name}
                className="w-full h-auto block group-hover:scale-[1.02] transition-transform duration-500"
              />
            </button>
          ))}
        </div>

        <Lightbox
          open={lightboxIdx !== null}
          images={activeImages}
          index={lightboxIdx}
          title={activeProject.name}
          subtitle={activeProject.location}
          onClose={close}
          onPrev={prev}
          onNext={next}
        />
      </div>
    );
  }

  // ---------- Grid of project cards ----------
  return (
    <div className="p-6 md:p-10 max-w-screen-2xl mx-auto">
      <div className="flex items-end justify-between mb-8 gap-4 flex-wrap">
        <div>
          <p className="eyebrow mb-2">PORTFOLIO</p>
          <h1 className="page-title">Gallery</h1>
          <p className="text-sm text-muted-foreground mt-1">Browse each project's images.</p>
        </div>
        <div className="text-sm text-muted-foreground">{filtered.length} {filtered.length === 1 ? "project" : "projects"}</div>
      </div>

      <div className="flex flex-wrap items-center gap-3 mb-6">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input value={q} onChange={e => setQ(e.target.value)} placeholder="Search projects…" className="pl-9" />
        </div>
        <div className="flex gap-1 bg-muted p-1 rounded">
          {(["all","ongoing","in_progress","completed"] as const).map(f => (
            <button key={f} onClick={() => setStatus(f)}
              className={cn("px-3 py-1.5 text-sm rounded transition-colors capitalize", status === f ? "bg-background shadow-sm" : "text-muted-foreground")}>
              {f === "in_progress" ? "In Progress" : f}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-5">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i} className="overflow-hidden shadow-card">
              <Skeleton className="aspect-[4/3] w-full" />
              <div className="p-5 space-y-2"><Skeleton className="h-3 w-20" /><Skeleton className="h-5 w-3/4" /></div>
            </Card>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          title={projectsWithImages.length === 0 ? "No project images yet." : "No projects match your filters."}
          actionLabel={projectsWithImages.length === 0 ? "Go to Projects" : undefined}
          actionTo={projectsWithImages.length === 0 ? "/projects" : undefined}
        />
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-5">
          {filtered.map(p => (
            <button
              key={p.id}
              onClick={() => { setActiveProject(p); setLightboxIdx(null); }}
              className="text-left"
            >
              <Card className="overflow-hidden hover:shadow-elegant transition-all group h-full shadow-card">
                <div className="aspect-[4/3] bg-muted relative overflow-hidden">
                  {p._images[0]
                    ? <LazyImage src={p._images[0]} alt={p.name} className="group-hover:scale-105 transition-transform duration-500" />
                    : <div className="w-full h-full luxury-gradient" />}
                  <div className="absolute top-3 right-3 px-2 py-1 text-xs rounded bg-background/85 backdrop-blur inline-flex items-center gap-1.5">
                    <ImageIcon className="w-3 h-3" />
                    {p._images.length}
                  </div>
                </div>
                <div className="p-5">
                  <p className="text-xs text-accent uppercase tracking-wider mb-1">{p.client_name || p.type || "Project"}</p>
                  <h3 className="font-serif text-xl mb-1 truncate">{p.name}</h3>
                  <p className="text-sm text-muted-foreground truncate">{p.location || "—"}</p>
                </div>
              </Card>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function Lightbox({
  open, images, index, title, subtitle, onClose, onPrev, onNext,
}: {
  open: boolean; images: string[]; index: number | null;
  title: string; subtitle?: string;
  onClose: () => void; onPrev: () => void; onNext: () => void;
}) {
  const url = index !== null ? images[index] : null;
  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-6xl p-0 bg-background border-0 overflow-hidden">
        {url && (
          <div className="relative">
            <div className="bg-black flex items-center justify-center max-h-[80vh]">
              <LazyImage src={url} alt={title} className="!h-auto max-h-[80vh] w-auto object-contain" />
            </div>
            <button onClick={onClose} aria-label="Close" className="absolute top-3 right-3 bg-background/80 hover:bg-background rounded-full p-2 shadow">
              <X className="w-4 h-4" />
            </button>
            {images.length > 1 && (
              <>
                <button onClick={onPrev} aria-label="Previous" className="absolute left-3 top-1/2 -translate-y-1/2 bg-background/80 hover:bg-background rounded-full p-2 shadow">
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <button onClick={onNext} aria-label="Next" className="absolute right-3 top-1/2 -translate-y-1/2 bg-background/80 hover:bg-background rounded-full p-2 shadow">
                  <ChevronRight className="w-5 h-5" />
                </button>
              </>
            )}
            <div className="flex items-center justify-between gap-3 p-4 border-t">
              <div className="min-w-0">
                <h3 className="font-serif text-lg truncate">{title}</h3>
                <p className="text-xs text-muted-foreground truncate">
                  {subtitle || "—"}{images.length > 1 && ` · ${(index ?? 0) + 1} / ${images.length}`}
                </p>
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
