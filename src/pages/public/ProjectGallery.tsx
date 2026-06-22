import { useEffect, useState, useCallback } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import LazyImage from "@/components/LazyImage";

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

export default function PublicProjectGallery() {
  const { id } = useParams<{ id: string }>();
  const [project, setProject] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [idx, setIdx] = useState<number | null>(null);

  useEffect(() => {
    (async () => {
      if (!id) { setNotFound(true); setLoading(false); return; }
      const { data, error } = await supabase
        .from("projects")
        .select("id,name,location,cover_image,images")
        .eq("id", id)
        .maybeSingle();
      if (error || !data) setNotFound(true);
      else setProject(data);
      setLoading(false);
    })();
  }, [id]);

  const images = project ? collectImages(project) : [];

  const close = useCallback(() => setIdx(null), []);
  const prev = useCallback(() => setIdx(i => i === null ? i : (i - 1 + images.length) % images.length), [images.length]);
  const next = useCallback(() => setIdx(i => i === null ? i : (i + 1) % images.length), [images.length]);

  useEffect(() => {
    if (idx === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") prev();
      else if (e.key === "ArrowRight") next();
      else if (e.key === "Escape") close();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [idx, prev, next, close]);

  useEffect(() => {
    if (project) document.title = `${project.name} — Gallery`;
  }, [project]);

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center text-muted-foreground">Loading…</div>;
  }
  if (notFound || !project) {
    return <div className="min-h-screen flex items-center justify-center text-muted-foreground">Project not found.</div>;
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="px-6 md:px-10 py-8 border-b">
        <div className="max-w-screen-2xl mx-auto">
          <p className="eyebrow mb-2">{project.client_name || "PROJECT"}</p>
          <h1 className="page-title">{project.name}</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {project.location || "—"} · {images.length} {images.length === 1 ? "image" : "images"}
          </p>
        </div>
      </header>

      <main className="px-6 md:px-10 py-8 max-w-screen-2xl mx-auto">
        {images.length === 0 ? (
          <p className="text-center text-muted-foreground py-20">No images to display.</p>
        ) : (
          <div className="columns-2 md:columns-3 lg:columns-4 xl:columns-5 2xl:columns-6 gap-3 [column-fill:_balance]">
            {images.map((url, i) => (
              <button
                key={`${url}-${i}`}
                onClick={() => setIdx(i)}
                className="mb-3 block w-full break-inside-avoid overflow-hidden rounded shadow-card hover:shadow-elegant transition-shadow group bg-muted"
              >
                {/* eslint-disable-next-line jsx-a11y/alt-text */}
                <img
                  loading="lazy"
                  decoding="async"
                  src={url}
                  alt={project.name}
                  className="w-full h-auto block group-hover:scale-[1.02] transition-transform duration-500"
                />
              </button>
            ))}
          </div>
        )}
      </main>

      <footer className="px-6 py-6 text-center text-xs text-muted-foreground">
        {project.client_name ? `Shared with ${project.client_name}` : "Shared gallery"}
      </footer>

      <Dialog open={idx !== null} onOpenChange={(v) => { if (!v) close(); }}>
        <DialogContent className="max-w-6xl p-0 bg-background border-0 overflow-hidden">
          {idx !== null && images[idx] && (
            <div className="relative">
              <div className="bg-black flex items-center justify-center max-h-[80vh]">
                <LazyImage src={images[idx]} alt={project.name} className="!h-auto max-h-[80vh] w-auto object-contain" />
              </div>
              <button onClick={close} aria-label="Close" className="absolute top-3 right-3 bg-background/80 hover:bg-background rounded-full p-2 shadow">
                <X className="w-4 h-4" />
              </button>
              {images.length > 1 && (
                <>
                  <button onClick={prev} aria-label="Previous" className="absolute left-3 top-1/2 -translate-y-1/2 bg-background/80 hover:bg-background rounded-full p-2 shadow">
                    <ChevronLeft className="w-5 h-5" />
                  </button>
                  <button onClick={next} aria-label="Next" className="absolute right-3 top-1/2 -translate-y-1/2 bg-background/80 hover:bg-background rounded-full p-2 shadow">
                    <ChevronRight className="w-5 h-5" />
                  </button>
                </>
              )}
              <div className="p-4 border-t">
                <h3 className="font-serif text-lg truncate">{project.name}</h3>
                <p className="text-xs text-muted-foreground truncate">
                  {project.location || "—"}{images.length > 1 && ` · ${idx + 1} / ${images.length}`}
                </p>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
