import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useUserRole } from "@/hooks/useUserRole";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { QrCode, Download, Search, RefreshCw, Contact, Mail, Phone, Globe, Pencil } from "lucide-react";
import QRCode from "qrcode";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { Slot, Template } from "@/lib/templateRender";
import { FIELDS_BY_TYPE } from "@/lib/templateRender";

type IdCardTemplate = { background_url: string | null; slots: Slot[] } | null;

type Member = {
  id: string;
  full_name: string | null;
  email: string | null;
  avatar_url: string | null;
  job_title: string | null;
  phone: string | null;
};

type Company = {
  name: string;
  logo_url: string | null;
  website: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  linkedin_url: string | null;
  facebook_url: string | null;
  instagram_url: string | null;
  youtube_url: string | null;
};

function escapeVCard(s: string) {
  return (s || "").replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");
}

function normalizeVCardUrl(url?: string | null) {
  const trimmed = (url || "").trim();
  if (!trimmed) return "";
  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
}


function foldVCardLine(line: string) {
  const chunks: string[] = [];
  let remaining = line;
  while (remaining.length > 73) {
    chunks.push(remaining.slice(0, 73));
    remaining = ` ${remaining.slice(73)}`;
  }
  chunks.push(remaining);
  return chunks.join("\r\n");
}

function buildVCard(m: Member, c: Company | null, photo?: string) {
  const lines = ["BEGIN:VCARD", "VERSION:3.0"];
  const name = m.full_name || m.email || "Member";
  lines.push(`FN:${escapeVCard(name)}`);
  const parts = name.split(" ");
  lines.push(`N:${escapeVCard(parts.slice(1).join(" "))};${escapeVCard(parts[0])};;;`);
  if (m.job_title) lines.push(`TITLE:${escapeVCard(m.job_title)}`);
  if (c?.name) lines.push(`ORG:${escapeVCard(c.name)}`);
  if (m.email) {
    lines.push(`EMAIL;TYPE=INTERNET,WORK,pref:${escapeVCard(m.email)}`);
  }
  if (m.phone) lines.push(`TEL;TYPE=CELL,VOICE,pref:${escapeVCard(m.phone)}`);
  if (c?.phone) lines.push(`TEL;TYPE=WORK,VOICE:${escapeVCard(c.phone)}`);
  const website = normalizeVCardUrl(c?.website);
  if (website) {
    lines.push(`item1.URL;TYPE=Website:${escapeVCard(website)}`);
    lines.push(`item1.X-ABLabel:Website`);
  }
  if (c?.address) lines.push(`ADR;TYPE=WORK:;;${escapeVCard(c.address)};;;;`);

  const socials: { url?: string | null; label: string; type: string }[] = [
    { url: c?.linkedin_url, label: "LinkedIn", type: "linkedin" },
    { url: c?.facebook_url, label: "Facebook", type: "facebook" },
    { url: c?.instagram_url, label: "Instagram", type: "instagram" },
    { url: c?.youtube_url, label: "YouTube", type: "youtube" },
  ];
  socials.forEach((s, i) => {
    const url = normalizeVCardUrl(s.url);
    if (!url) return;
    // Single labelled URL entry — iOS Contacts (via item/X-ABLabel) and
    // Android/Google Contacts (via TYPE=) both render it once with the label.
    const item = `item${i + 2}`;
    lines.push(`${item}.URL;TYPE=${s.label}:${escapeVCard(url)}`);
    lines.push(`${item}.X-ABLabel:${s.label}`);
  });
  if (photo) {
    const match = photo.match(/^data:image\/(\w+);base64,(.+)$/);
    if (match) {
      lines.push(`PHOTO;ENCODING=b;TYPE=${match[1].toUpperCase()}:${match[2]}`);
    } else {
      lines.push(`PHOTO;VALUE=URI:${escapeVCard(photo)}`);
    }
  }
  lines.push("END:VCARD");
  return lines.map(foldVCardLine).join("\r\n");
}

// Used only for the downloadable vCard; the on-card QR uses the photo URL so it stays scannable.
async function fetchImageAsDataUrl(url: string, maxSize = 96): Promise<string | null> {
  try {
    const res = await fetch(url, { mode: "cors" });
    const blob = await res.blob();
    const bitmap = await createImageBitmap(blob);
    const scale = Math.min(1, maxSize / Math.max(bitmap.width, bitmap.height));
    const w = Math.round(bitmap.width * scale);
    const h = Math.round(bitmap.height * scale);
    const canvas = document.createElement("canvas");
    canvas.width = w; canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(bitmap, 0, 0, w, h);
    return canvas.toDataURL("image/jpeg", 0.45);
  } catch { return null; }
}

type Theme = "gradient" | "black" | "white";

// Module-level cache so theme switches / remounts don't re-encode the QR.
const qrCache = new Map<string, string>();

function QrTile({ member, company, canEdit, template, onRegenerate, onSaved }: { member: Member; company: Company | null; canEdit: boolean; template: IdCardTemplate; onRegenerate?: () => void; onSaved?: (m: Member) => void }) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [theme, setTheme] = useState<Theme>("gradient");
  const [version, setVersion] = useState(0);
  const [regenerating, setRegenerating] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [draft, setDraft] = useState<Member>(member);
  const [saving, setSaving] = useState(false);
  useEffect(() => { setDraft(member); }, [member]);

  async function saveDraft() {
    setSaving(true);
    const { error } = await supabase.from("profiles").update({
      full_name: draft.full_name,
      job_title: draft.job_title,
      email: draft.email,
      phone: draft.phone,
    }).eq("id", member.id);
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    // Drop cache so QR re-encodes with new info
    for (const k of Array.from(qrCache.keys())) {
      if (k.startsWith(`${member.id}::`)) qrCache.delete(k);
    }
    setVersion(v => v + 1);
    setRegenerating(true);
    setEditOpen(false);
    toast.success("Info updated");
    onSaved?.(draft);
  }

  // Stable cache key — bumped via Regenerate, or when company info changes.
  const cacheKey = `${member.id}::${version}::${company?.logo_url || ""}::${company?.website || ""}`;
  const [qr, setQr] = useState<string>(() => qrCache.get(cacheKey) || "");
  const [visible, setVisible] = useState(false);

  // Card colors per theme. QR always stays on a white tile so it scans.
  const themeStyles = {
    gradient: { bandClass: "luxury-gradient", bodyClass: "bg-card", textClass: "text-foreground", mutedClass: "text-muted-foreground", ringClass: "ring-card" },
    black:    { bandClass: "bg-[#0a0a0a]",     bodyClass: "bg-[#0a0a0a]", textClass: "text-white", mutedClass: "text-white/70", ringClass: "ring-[#0a0a0a]" },
    white:    { bandClass: "bg-white border-b border-border", bodyClass: "bg-white", textClass: "text-[#0a0a0a]", mutedClass: "text-neutral-500", ringClass: "ring-white" },
  }[theme];

  // Logo overlay sized at ~18% of QR — within the 30% redundancy that
  // error-correction level "H" provides, so the code remains scannable.
  const QR_RENDER = 180;
  const LOGO_RATIO = 0.18;
  const logoBox = Math.round(QR_RENDER * LOGO_RATIO);

  // Lazy-render: only encode the QR once the card scrolls into view.
  useEffect(() => {
    if (!wrapRef.current) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          io.disconnect();
        }
      },
      { rootMargin: "200px" }
    );
    io.observe(wrapRef.current);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    if (!visible) return;
    const cached = qrCache.get(cacheKey);
    if (cached) { setQr(cached); setRegenerating(false); return; }
    let cancelled = false;
    (async () => {
      const vcard = buildVCard(member, company, normalizeVCardUrl(member.avatar_url));
      const url = await QRCode.toDataURL(vcard, {
        margin: 4,
        width: 520,
        color: { dark: "#0a0a0a", light: "#ffffff" },
        errorCorrectionLevel: "M",
      });
      if (cancelled) return;
      qrCache.set(cacheKey, url);
      setQr(url);
      setRegenerating(false);
    })().catch(() => {
      if (!cancelled) {
        setRegenerating(false);
        toast.error("QR data is too large to generate");
      }
    });
    return () => { cancelled = true; };
  }, [visible, cacheKey, member, company]);

  async function downloadPng() {
    try {
      const html2canvas = (await import("html2canvas")).default;
      if (!wrapRef.current) return;
      const canvas = await html2canvas(wrapRef.current, { scale: 3, backgroundColor: null, useCORS: true });
      const link = document.createElement("a");
      link.download = `${(member.full_name || "id-card").replace(/\s+/g, "-")}-id.png`;
      link.href = canvas.toDataURL("image/png");
      link.click();
    } catch {
      toast.error("Couldn't download card");
    }
  }

  async function downloadPdf() {
    try {
      const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
        import("html2canvas"),
        import("jspdf"),
      ]);
      if (!wrapRef.current) return;
      const canvas = await html2canvas(wrapRef.current, { scale: 3, backgroundColor: null, useCORS: true });
      const imgData = canvas.toDataURL("image/png");

      // Standard ID-card 85.6 x 54mm proportions feel cramped here; use the
      // card's own aspect ratio centered on A4 portrait with a small margin.
      const pdf = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });
      const pageW = pdf.internal.pageSize.getWidth();
      const pageH = pdf.internal.pageSize.getHeight();
      const targetW = 90; // mm — typical credit-card width
      const ratio = canvas.height / canvas.width;
      const targetH = targetW * ratio;
      const x = (pageW - targetW) / 2;
      const y = (pageH - targetH) / 2;
      pdf.addImage(imgData, "PNG", x, y, targetW, targetH);
      pdf.save(`${(member.full_name || "id-card").replace(/\s+/g, "-")}-id.pdf`);
    } catch {
      toast.error("Couldn't download PDF");
    }
  }

  async function downloadVCard() {
    const photo = member.avatar_url ? await fetchImageAsDataUrl(member.avatar_url, 160) : null;
    const vcard = buildVCard(member, company, photo || undefined);
    const blob = new Blob([vcard], { type: "text/vcard;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.download = `${(member.full_name || "contact").replace(/\s+/g, "-")}.vcf`;
    link.href = url;
    link.click();
    URL.revokeObjectURL(url);
    toast.success("vCard downloaded");
  }

  const initials = (member.full_name || member.email || "?")
    .split(" ").map((s) => s[0]).slice(0, 2).join("").toUpperCase();

  const useTemplate = !!template && template.slots.length > 0;
  const CARD_W = 340;
  const CARD_H = useTemplate ? Math.round(CARD_W * (86 / 54)) : undefined;

  function resolveTextValue(field: string): string {
    switch (field) {
      case "member_name": return member.full_name || member.email || "";
      case "member_title": return member.job_title || "";
      case "member_email": return member.email || "";
      case "member_phone": return member.phone || "";
      case "company_name": return company?.name || "";
      case "company_website": return (company?.website || "").replace(/^https?:\/\//, "").replace(/\/$/, "");
      case "company_phone": return company?.phone || "";
      default: return "";
    }
  }
  function resolveImageValue(field: string): string | null {
    if (field === "member_photo") return member.avatar_url || null;
    if (field === "company_logo") return company?.logo_url || null;
    if (field === "qr_code") return qr || null;
    return null;
  }

  return (
    <div className="flex flex-col items-center gap-3">
      {useTemplate ? (
        <div
          ref={wrapRef}
          className="relative rounded-2xl overflow-hidden shadow-2xl border border-border bg-white"
          style={{ width: CARD_W, height: CARD_H }}
        >
          {template!.background_url && (
            <img src={template!.background_url} alt="" crossOrigin="anonymous" className="absolute inset-0 w-full h-full object-cover pointer-events-none" />
          )}
          {template!.slots.map((s, i) => {
            const meta = FIELDS_BY_TYPE.idcard.find(f => f.field === s.field);
            const style: React.CSSProperties = {
              position: "absolute",
              left: `${s.x}%`, top: `${s.y}%`,
              width: `${s.w}%`, height: `${s.h}%`,
            };
            if (meta?.kind === "image") {
              const url = resolveImageValue(s.field);
              if (!url) return null;
              const isQr = s.field === "qr_code";
              return (
                <div key={i} style={style} className={isQr ? "bg-white p-1" : ""}>
                  <img src={url} alt="" crossOrigin="anonymous" className="w-full h-full object-contain" />
                </div>
              );
            }
            const text = resolveTextValue(s.field);
            if (!text) return null;
            return (
              <div
                key={i}
                style={{
                  ...style,
                  fontSize: (s.fontSize || 12) * (CARD_W / 595), // approx scale: A4@72dpi width
                  color: s.color || "#000",
                  fontWeight: s.bold ? 700 : 400,
                  textAlign: s.align || "left",
                  lineHeight: 1.15,
                  whiteSpace: "pre-wrap",
                  overflow: "hidden",
                  display: "flex",
                  alignItems: "flex-start",
                  justifyContent: s.align === "center" ? "center" : s.align === "right" ? "flex-end" : "flex-start",
                }}
              >
                <span style={{ width: "100%" }}>{text}</span>
              </div>
            );
          })}
        </div>
      ) : (
      <div
        ref={wrapRef}
        className={`relative w-[340px] rounded-2xl overflow-hidden shadow-2xl border border-border ${themeStyles.bodyClass}`}
      >
        {/* Lanyard slot */}
        <div className={`${themeStyles.bandClass} pt-5 pb-3 flex flex-col items-center`}>
          <div className="w-12 h-1.5 rounded-full bg-current opacity-20 mb-3" />
          {company?.logo_url ? (
            <img src={company.logo_url} alt="" className="h-10 max-w-[180px] object-contain" />
          ) : (
            <div className={`font-serif text-base ${themeStyles.textClass}`}>{company?.name || "Company"}</div>
          )}
          
        </div>

        {/* Photo */}
        <div className="flex justify-center -mt-2 mb-3">
          <Avatar className={`h-24 w-24 ring-4 ${themeStyles.ringClass} shadow-lg`}>
            {member.avatar_url && <AvatarImage src={member.avatar_url} />}
            <AvatarFallback className="text-2xl font-serif">{initials}</AvatarFallback>
          </Avatar>
        </div>

        {/* Name + title */}
        <div className="text-center px-5">
          <p className={`font-serif text-xl leading-tight ${themeStyles.textClass}`}>{member.full_name || "Member"}</p>
          <p className="text-[10px] text-accent tracking-[0.2em] uppercase mt-1">
            {member.job_title || "Team Member"}
          </p>
        </div>


        {/* QR with logo — always on white tile so it stays scannable */}
        <div className="mt-4 mb-5 flex flex-col items-center">
          <div
            className="relative rounded-lg bg-white p-2 border border-border"
            style={{ width: QR_RENDER + 16, height: QR_RENDER + 16 }}
          >
            {qr ? (
              <img src={qr} alt={`QR for ${member.full_name}`} className="w-full h-full" />
            ) : (
              <div className="w-full h-full bg-muted animate-pulse rounded" />
            )}
            {company?.logo_url && (
              <div
                className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-md shadow-md flex items-center justify-center"
                style={{ width: logoBox, height: logoBox, padding: Math.round(logoBox * 0.12), backgroundColor: "#0a0a0a" }}
              >
                <img src={company.logo_url} alt="" className="max-w-full max-h-full object-contain" />
              </div>
            )}
          </div>
          
        </div>

        {/* Footer band */}
        <div className={`${themeStyles.bandClass} mt-2 px-5 py-3 flex flex-col items-center gap-1 border-t border-white/10`}>
          {company?.website && (
            <p className="text-[9px] tracking-[0.35em] text-accent uppercase">
              {company.website.replace(/^https?:\/\//, "").replace(/\/$/, "")}
            </p>
          )}
        </div>
      </div>
      )}

      {/* Theme selector — only when using built-in layout */}
      {!useTemplate && (
      <div className="flex items-center gap-2">
        <span className="text-[10px] tracking-[0.2em] text-muted-foreground uppercase">Theme</span>
        {(["gradient", "black", "white"] as Theme[]).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTheme(t)}
            aria-label={`${t} theme`}
            className={`w-7 h-7 rounded-full border-2 transition-all ${theme === t ? "border-accent scale-110" : "border-border"}`}
            style={{
              background:
                t === "gradient"
                  ? "linear-gradient(135deg, hsl(var(--sidebar-background)), hsl(var(--accent)))"
                  : t === "black"
                  ? "#0a0a0a"
                  : "#ffffff",
            }}
            title={t === "gradient" ? "SADECO gradient" : t.charAt(0).toUpperCase() + t.slice(1)}
          />
        ))}
      </div>
      )}

      <div className="flex flex-wrap gap-2 justify-center">
        <Button variant="outline" size="sm" onClick={downloadPng}>
          <Download className="w-3 h-3 mr-1" /> PNG
        </Button>
        <Button variant="outline" size="sm" onClick={downloadPdf}>
          <Download className="w-3 h-3 mr-1" /> PDF
        </Button>
        <Button variant="outline" size="sm" onClick={downloadVCard}>
          <Contact className="w-3 h-3 mr-1" /> vCard
        </Button>
        {canEdit && (
          <Button variant="outline" size="sm" onClick={() => { setDraft(member); setEditOpen(true); }}>
            <Pencil className="w-3 h-3 mr-1" /> Edit Info
          </Button>
        )}
        {onRegenerate && (
          <Button variant="outline" size="sm" disabled={regenerating} onClick={() => {
            setRegenerating(true);
            for (const k of Array.from(qrCache.keys())) {
              if (k.startsWith(`${member.id}::`)) qrCache.delete(k);
            }
            onRegenerate();
            setVersion(v => v + 1);
          }}>
            <RefreshCw className={`w-3 h-3 mr-1 ${regenerating ? "animate-spin" : ""}`} />
            {regenerating ? "Regenerating…" : "Regenerate"}
          </Button>
        )}
      </div>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit QR Info</DialogTitle>
          </DialogHeader>
          <p className="text-xs text-muted-foreground -mt-2">
            Updates the contact details encoded in your QR code and shown on the badge.
          </p>
          <div className="grid gap-3 py-2">
            <div><Label>Full name</Label><Input value={draft.full_name || ""} onChange={e => setDraft({ ...draft, full_name: e.target.value })} /></div>
            <div><Label>Job title</Label><Input value={draft.job_title || ""} onChange={e => setDraft({ ...draft, job_title: e.target.value })} /></div>
            <div><Label>Email</Label><Input value={draft.email || ""} onChange={e => setDraft({ ...draft, email: e.target.value })} /></div>
            <div><Label>Phone</Label><Input value={draft.phone || ""} onChange={e => setDraft({ ...draft, phone: e.target.value })} placeholder="+971…" /></div>
            <div><Label>WhatsApp</Label><Input value={draft.whatsapp || ""} onChange={e => setDraft({ ...draft, whatsapp: e.target.value })} placeholder="+971…" /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)} disabled={saving}>Cancel</Button>
            <Button onClick={saveDraft} disabled={saving}>{saving ? "Saving…" : "Save & Update QR"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function IdCards() {
  const { user } = useAuth();
  const { isAdmin, loading: roleLoading } = useUserRole();
  const [members, setMembers] = useState<Member[]>([]);
  const [company, setCompany] = useState<Company | null>(null);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [sets, setSets] = useState<{ id: string; name: string }[]>([]);
  const [setId, setSetId] = useState<string>("__none__");
  const [template, setTemplate] = useState<IdCardTemplate>(null);

  async function loadAll() {
    const [{ data: profiles }, { data: c }] = await Promise.all([
      supabase.from("profiles").select("id, full_name, email, avatar_url, job_title, phone, whatsapp"),
      supabase.from("company_profile").select("*").limit(1).single(),
    ]);
    setMembers((profiles as Member[]) || []);
    setCompany((c as Company) || null);
    const { data: { user: u } } = await supabase.auth.getUser();
    if (u) {
      const [{ data: ts }, { data: ea }] = await Promise.all([
        supabase.from("template_sets").select("id,name").eq("user_id", u.id).order("created_at"),
        supabase.from("export_template_assignments").select("set_id").eq("user_id", u.id).eq("export_kind", "id_card").maybeSingle(),
      ]);
      setSets(ts || []);
      const initial = (ea?.set_id as string) || (ts?.[0]?.id) || "__none__";
      setSetId(initial === "__none__" ? "__none__" : initial);
    }
    setLoading(false);
  }

  useEffect(() => { loadAll(); }, []);

  // Load template for chosen set
  useEffect(() => {
    (async () => {
      if (!setId || setId === "__none__") { setTemplate(null); return; }
      const { data } = await supabase.from("pdf_templates").select("background_url,slots").eq("set_id", setId).eq("page_type", "idcard").maybeSingle();
      if (data) setTemplate({ background_url: data.background_url, slots: (data.slots as any) || [] });
      else setTemplate(null);
    })();
  }, [setId]);

  async function saveSetAssignment(newSetId: string) {
    setSetId(newSetId);
    const { data: { user: u } } = await supabase.auth.getUser();
    if (!u) return;
    if (newSetId === "__none__") {
      await supabase.from("export_template_assignments").delete().eq("user_id", u.id).eq("export_kind", "id_card");
    } else {
      await supabase.from("export_template_assignments").upsert({
        user_id: u.id, export_kind: "id_card", set_id: newSetId,
      }, { onConflict: "user_id,export_kind" });
    }
  }

  // Pre-warm export libraries during browser idle time so the first
  // PNG / PDF download click resolves instantly.
  useEffect(() => {
    const prewarm = () => {
      import("html2canvas").catch(() => {});
      import("jspdf").catch(() => {});
    };
    const w = window as Window & {
      requestIdleCallback?: (callback: IdleRequestCallback, options?: IdleRequestOptions) => number;
      cancelIdleCallback?: (handle: number) => void;
    };
    if (typeof w.requestIdleCallback === "function") {
      const id = w.requestIdleCallback(prewarm, { timeout: 2000 });
      return () => w.cancelIdleCallback?.(id);
    }
    const t = setTimeout(prewarm, 1500);
    return () => clearTimeout(t);
  }, []);

  if (loading || roleLoading) return <div className="p-10 text-muted-foreground">Loading…</div>;

  // Members see only their own QR. Admins see everyone.
  const visible = isAdmin ? members : members.filter((m) => m.id === user?.id);

  const filtered = visible.filter((m) => {
    if (!q) return true;
    const s = q.toLowerCase();
    return (
      (m.full_name || "").toLowerCase().includes(s) ||
      (m.email || "").toLowerCase().includes(s) ||
      (m.job_title || "").toLowerCase().includes(s)
    );
  });

  return (
    <div className="p-10 max-w-7xl mx-auto">
      <div className="flex items-center gap-3 mb-2">
        <QrCode className="w-5 h-5 text-accent" />
        <p className="text-xs tracking-[0.3em] text-accent">DIGITAL CONTACT</p>
      </div>
      <h1 className="font-serif text-5xl mb-2">{isAdmin ? "Team QR Codes" : "My QR Code"}</h1>
      <p className="text-muted-foreground mb-8">
        Scan to instantly save the contact — name, title, email, phone, website and company socials.
      </p>

      {isAdmin && sets.length > 0 && (
        <Card className="p-4 mb-6 flex flex-wrap items-center gap-3">
          <Label className="text-xs">ID Card template</Label>
          <Select value={setId} onValueChange={saveSetAssignment}>
            <SelectTrigger className="w-72"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">Default layout (no template)</SelectItem>
              {sets.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <span className="text-xs text-muted-foreground">Design custom layouts in <a href="/template" className="underline">Template Designer</a> → ID Card tab.</span>
        </Card>
      )}

      {isAdmin && (
        <div className="relative max-w-md mb-8">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search by name, email, or title…"
            className="pl-9"
          />
        </div>
      )}

      {filtered.length === 0 ? (
        <Card className="p-10 text-center border-dashed text-muted-foreground">
          No QR code available — complete your profile first.
        </Card>
      ) : (
        <div className="flex flex-wrap gap-10">
          {filtered.map((m) => (
            <QrTile key={m.id} member={m} company={company} template={template} canEdit={m.id === user?.id} onRegenerate={() => { toast.success("Refreshed from latest profile"); loadAll(); }} onSaved={() => loadAll()} />
          ))}
        </div>
      )}
    </div>
  );
}
