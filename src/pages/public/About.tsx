import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { defaultsFromCompany, loadOverrides, type AboutPageData } from "@/lib/aboutPage";

export default function PublicAbout() {
  const [company, setCompany] = useState<any>(null);
  const [data, setData] = useState<AboutPageData | null>(null);
  const [projects, setProjects] = useState<any[]>([]);

  useEffect(() => { (async () => {
    const [{ data: c }, { data: p }] = await Promise.all([
      supabase.from("company_profile").select("*").limit(1).maybeSingle(),
      supabase.from("projects").select("id,name,location,cover_image").order("updated_at", { ascending: false }).limit(6),
    ]);
    setCompany(c);
    setData({ ...defaultsFromCompany(c), ...loadOverrides() });
    setProjects(p || []);
  })(); }, []);

  if (!data) return <div className="min-h-screen flex items-center justify-center text-muted-foreground">Loading…</div>;
  const accent = data.accent || "#c9a84c";

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border">
        <div className="max-w-5xl mx-auto px-6 py-6 flex items-center justify-between">
          {company?.logo_url
            ? <img src={company.logo_url} alt={company?.name || ""} className="h-10" />
            : <div className="font-serif text-xl">{company?.name || "Studio"}</div>}
          {company?.website && (
            <a href={/^https?:\/\//.test(company.website) ? company.website : `https://${company.website}`}
              className="text-xs uppercase tracking-[0.2em] hover:opacity-70" target="_blank" rel="noreferrer">Visit site</a>
          )}
        </div>
      </header>

      <section className="max-w-5xl mx-auto px-6 py-20 grid md:grid-cols-12 gap-10 items-start">
        <div className="md:col-span-7 space-y-6">
          <p className="text-xs tracking-[0.3em]" style={{ color: accent }}>ABOUT US</p>
          <h1 className="font-serif text-5xl md:text-6xl leading-tight">{data.headline}</h1>
          {data.tagline && <p className="text-lg text-muted-foreground">{data.tagline}</p>}
          <div className="h-px w-16" style={{ backgroundColor: accent }} />
          {data.intro && <p className="whitespace-pre-wrap leading-relaxed">{data.intro}</p>}
        </div>

        {data.services?.length > 0 && (
          <aside className="md:col-span-5">
            <p className="text-xs tracking-[0.3em] mb-3" style={{ color: accent }}>WHAT WE DO</p>
            <ul className="space-y-2">
              {data.services.map((s, i) => (
                <li key={i} className="flex gap-3 border-b border-border py-2"><span style={{ color: accent }}>—</span><span>{s}</span></li>
              ))}
            </ul>
          </aside>
        )}
      </section>

      {data.stats?.length > 0 && (
        <section className="border-y border-border bg-muted/30">
          <div className="max-w-5xl mx-auto px-6 py-10 grid grid-cols-2 md:grid-cols-4 gap-6">
            {data.stats.map((s, i) => (
              <div key={i}>
                <div className="font-serif text-4xl" style={{ color: accent }}>{s.value}</div>
                <div className="text-xs tracking-[0.2em] text-muted-foreground mt-1 uppercase">{s.label}</div>
              </div>
            ))}
          </div>
        </section>
      )}

      {projects.length > 0 && (
        <section className="max-w-5xl mx-auto px-6 py-16">
          <p className="text-xs tracking-[0.3em] mb-6" style={{ color: accent }}>SELECTED WORK</p>
          <div className="grid md:grid-cols-3 gap-4">
            {projects.map(p => (
              <article key={p.id} className="border border-border overflow-hidden">
                {p.cover_image && <img src={p.cover_image} alt={p.name} className="w-full h-48 object-cover" />}
                <div className="p-4">
                  <h3 className="font-serif text-lg">{p.name}</h3>
                  {p.location && <p className="text-xs text-muted-foreground mt-1">{p.location}</p>}
                </div>
              </article>
            ))}
          </div>
        </section>
      )}

      <footer className="border-t border-border">
        <div className="max-w-5xl mx-auto px-6 py-8 text-xs text-muted-foreground flex flex-wrap gap-x-6 gap-y-2">
          {data.contactPhone && <span>{data.contactPhone}</span>}
          {data.contactEmail && <a href={`mailto:${data.contactEmail}`} className="hover:text-foreground">{data.contactEmail}</a>}
          {data.contactWebsite && <span>{data.contactWebsite}</span>}
          {data.contactAddress && <span>{data.contactAddress}</span>}
        </div>
      </footer>
    </div>
  );
}
