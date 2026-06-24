// "About Us" page model used both for PDF export cover and public /about page.
// Defaults pull from company_profile; user overrides are stored in localStorage
// (per device) so we don't need an extra schema for the common case.

export type AboutStat = { label: string; value: string };

export type AboutPageData = {
  enabled: boolean;
  headline: string;
  tagline: string;
  intro: string;
  services: string[];
  stats: AboutStat[];
  contactPhone: string;
  contactEmail: string;
  contactWebsite: string;
  contactAddress: string;
  accent: string;
};

const LS_KEY = "sadeco.aboutPage.overrides.v1";

export function defaultsFromCompany(company: any): AboutPageData {
  return {
    enabled: true,
    headline: company?.name || "About Us",
    tagline: company?.tagline || "Crafting timeless interiors with uncompromising quality.",
    intro: company?.about || "",
    services: Array.isArray(company?.services) ? company.services.slice(0, 6) : [],
    stats: [
      { label: "Years", value: "10+" },
      { label: "Projects", value: "120+" },
      { label: "Clients", value: "80+" },
    ],
    contactPhone: company?.phone || "",
    contactEmail: company?.email || "",
    contactWebsite: company?.website || "",
    contactAddress: company?.address || "",
    accent: "#c9a84c",
  };
}

export function loadOverrides(): Partial<AboutPageData> {
  if (typeof window === "undefined") return {};
  try { return JSON.parse(localStorage.getItem(LS_KEY) || "{}"); }
  catch { return {}; }
}

export function saveOverrides(data: Partial<AboutPageData>) {
  if (typeof window === "undefined") return;
  localStorage.setItem(LS_KEY, JSON.stringify(data));
}

export function resolveAboutPage(company: any): AboutPageData {
  const base = defaultsFromCompany(company);
  return { ...base, ...loadOverrides() };
}
