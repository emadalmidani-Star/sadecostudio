import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useUserRole } from "@/hooks/useUserRole";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { QrCode, Download, Search, RefreshCw, Contact, Mail, Phone, Globe } from "lucide-react";
import QRCode from "qrcode";
import { toast } from "sonner";

type Member = {
  id: string;
  full_name: string | null;
  email: string | null;
  avatar_url: string | null;
  job_title: string | null;
  phone: string | null;
  whatsapp: string | null;
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

function buildVCard(m: Member, c: Company | null) {
  const lines = ["BEGIN:VCARD", "VERSION:3.0"];
  const name = m.full_name || m.email || "Member";
  lines.push(`FN:${escapeVCard(name)}`);
  const parts = name.split(" ");
  lines.push(`N:${escapeVCard(parts.slice(1).join(" "))};${escapeVCard(parts[0])};;;`);
  if (m.job_title) lines.push(`TITLE:${escapeVCard(m.job_title)}`);
  if (c?.name) lines.push(`ORG:${escapeVCard(c.name)}`);
  if (m.email) lines.push(`EMAIL;TYPE=WORK:${m.email}`);
  if (m.phone) lines.push(`TEL;TYPE=CELL:${m.phone}`);
  if (m.whatsapp) lines.push(`TEL;TYPE=WORK:${m.whatsapp}`);
  if (c?.phone) lines.push(`TEL;TYPE=WORK,VOICE:${c.phone}`);
  if (c?.website) lines.push(`URL:${c.website}`);
  if (c?.address) lines.push(`ADR;TYPE=WORK:;;${escapeVCard(c.address)};;;;`);
  [c?.linkedin_url, c?.facebook_url, c?.instagram_url, c?.youtube_url]
    .filter(Boolean)
    .forEach((u) => lines.push(`URL:${u}`));
  lines.push("END:VCARD");
  return lines.join("\n");
}

type Theme = "gradient" | "black" | "white";

function QrTile({ member, company, onRegenerate }: { member: Member; company: Company | null; onRegenerate?: () => void }) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [qr, setQr] = useState<string>("");
  const [theme, setTheme] = useState<Theme>("gradient");
  const [version, setVersion] = useState(0);

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

  useEffect(() => {
    QRCode.toDataURL(buildVCard(member, company), {
      margin: 2,
      width: 800,
      color: { dark: "#0a0a0a", light: "#ffffff" },
      errorCorrectionLevel: "H",
    }).then(setQr);
  }, [member, company, version]);

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

  function downloadVCard() {
    const vcard = buildVCard(member, company);
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

  return (
    <div className="flex flex-col items-center gap-3">
      {/* Vertical ID-card badge */}
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
        <div className={`${themeStyles.bandClass} px-5 py-2 flex items-center justify-between`}>
          <p className={`text-[8px] tracking-[0.2em] truncate opacity-70 ${themeStyles.textClass}`}>{company?.name}</p>
          {company?.website && (
            <p className="text-[8px] tracking-[0.2em] text-accent truncate">{company.website.replace(/^https?:\/\//, "")}</p>
          )}
        </div>
      </div>

      {/* Theme selector */}
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
        {onRegenerate && (
          <Button variant="outline" size="sm" onClick={() => { onRegenerate(); setVersion(v => v + 1); }}>
            <RefreshCw className="w-3 h-3 mr-1" /> Regenerate
          </Button>
        )}
      </div>
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

  async function loadAll() {
    const [{ data: profiles }, { data: c }] = await Promise.all([
      supabase.from("profiles").select("id, full_name, email, avatar_url, job_title, phone, whatsapp"),
      supabase.from("company_profile").select("*").limit(1).single(),
    ]);
    setMembers((profiles as Member[]) || []);
    setCompany((c as Company) || null);
    setLoading(false);
  }

  useEffect(() => { loadAll(); }, []);

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
            <QrTile key={m.id} member={m} company={company} onRegenerate={() => { toast.success("Refreshed from latest profile"); loadAll(); }} />
          ))}
        </div>
      )}
    </div>
  );
}
