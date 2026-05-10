import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { QrCode, Download, Search, Globe, Mail, Phone, MessageCircle } from "lucide-react";
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
  const socials = [c?.linkedin_url, c?.facebook_url, c?.instagram_url, c?.youtube_url].filter(Boolean) as string[];
  socials.forEach((u) => lines.push(`URL:${u}`));
  lines.push("END:VCARD");
  return lines.join("\n");
}

function IdCard({ member, company }: { member: Member; company: Company | null }) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [qr, setQr] = useState<string>("");

  useEffect(() => {
    QRCode.toDataURL(buildVCard(member, company), {
      margin: 1,
      width: 320,
      color: { dark: "#0a0a0a", light: "#ffffff" },
      errorCorrectionLevel: "M",
    }).then(setQr);
  }, [member, company]);

  async function downloadCard() {
    try {
      const html2canvas = (await import("html2canvas")).default;
      if (!cardRef.current) return;
      const canvas = await html2canvas(cardRef.current, { scale: 3, backgroundColor: null });
      const link = document.createElement("a");
      link.download = `${(member.full_name || "id-card").replace(/\s+/g, "-")}.png`;
      link.href = canvas.toDataURL("image/png");
      link.click();
    } catch (e: any) {
      toast.error("Couldn't download card");
    }
  }

  const initials = (member.full_name || member.email || "?")
    .split(" ").map((s) => s[0]).slice(0, 2).join("").toUpperCase();

  return (
    <div className="space-y-3">
      <div
        ref={cardRef}
        className="relative w-[360px] rounded-2xl overflow-hidden shadow-2xl border border-border bg-card"
        style={{ aspectRatio: "1.586 / 1" }}
      >
        {/* Top luxury band */}
        <div className="luxury-gradient h-24 px-5 flex items-center justify-between">
          {company?.logo_url ? (
            <img src={company.logo_url} alt="" className="h-12 max-w-[140px] object-contain" />
          ) : (
            <div className="text-sidebar-foreground font-serif text-lg">{company?.name || "Company"}</div>
          )}
          <div className="text-right">
            <p className="text-[9px] tracking-[0.3em] text-accent">TEAM</p>
            <p className="text-[9px] tracking-[0.2em] text-sidebar-foreground/70">ID CARD</p>
          </div>
        </div>

        {/* Body */}
        <div className="p-5 flex gap-4">
          <Avatar className="h-20 w-20 -mt-12 ring-4 ring-card shrink-0">
            {member.avatar_url && <AvatarImage src={member.avatar_url} />}
            <AvatarFallback className="text-lg font-serif">{initials}</AvatarFallback>
          </Avatar>

          <div className="flex-1 min-w-0">
            <p className="font-serif text-lg leading-tight truncate">{member.full_name || "Member"}</p>
            <p className="text-[11px] text-accent tracking-wider uppercase truncate">
              {member.job_title || "Team Member"}
            </p>
            <div className="mt-2 space-y-0.5 text-[10px] text-muted-foreground">
              {member.email && (
                <p className="flex items-center gap-1 truncate"><Mail className="w-3 h-3" />{member.email}</p>
              )}
              {(member.phone || company?.phone) && (
                <p className="flex items-center gap-1 truncate"><Phone className="w-3 h-3" />{member.phone || company?.phone}</p>
              )}
              {company?.website && (
                <p className="flex items-center gap-1 truncate"><Globe className="w-3 h-3" />{company.website.replace(/^https?:\/\//, "")}</p>
              )}
            </div>
          </div>

          <div className="shrink-0 flex flex-col items-center gap-1">
            {qr ? (
              <img src={qr} alt="QR" className="w-20 h-20 rounded-md bg-white p-1" />
            ) : (
              <div className="w-20 h-20 rounded-md bg-muted animate-pulse" />
            )}
            <p className="text-[8px] tracking-widest text-muted-foreground">SCAN ME</p>
          </div>
        </div>
      </div>

      <div className="flex gap-2">
        <Button variant="outline" size="sm" onClick={downloadCard} className="flex-1">
          <Download className="w-3 h-3 mr-1" /> Download PNG
        </Button>
      </div>
    </div>
  );
}

export default function IdCards() {
  const [members, setMembers] = useState<Member[]>([]);
  const [company, setCompany] = useState<Company | null>(null);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");

  useEffect(() => {
    (async () => {
      const [{ data: profiles }, { data: c }] = await Promise.all([
        supabase.from("profiles").select("id, full_name, email, avatar_url, job_title, phone, whatsapp"),
        supabase.from("company_profile").select("*").limit(1).single(),
      ]);
      setMembers((profiles as Member[]) || []);
      setCompany((c as Company) || null);
      setLoading(false);
    })();
  }, []);

  const filtered = members.filter((m) => {
    if (!q) return true;
    const s = q.toLowerCase();
    return (m.full_name || "").toLowerCase().includes(s) ||
           (m.email || "").toLowerCase().includes(s) ||
           (m.job_title || "").toLowerCase().includes(s);
  });

  if (loading) return <div className="p-10 text-muted-foreground">Loading…</div>;

  return (
    <div className="p-10 max-w-7xl mx-auto">
      <div className="flex items-center gap-3 mb-2">
        <QrCode className="w-5 h-5 text-accent" />
        <p className="text-xs tracking-[0.3em] text-accent">DIGITAL BUSINESS CARDS</p>
      </div>
      <h1 className="font-serif text-5xl mb-2">Team ID Cards</h1>
      <p className="text-muted-foreground mb-8">
        Scan any QR to instantly save the contact — including company website, phone, and social profiles.
      </p>

      <div className="relative max-w-md mb-8">
        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by name, email, or title…" className="pl-9" />
      </div>

      {filtered.length === 0 ? (
        <Card className="p-10 text-center border-dashed text-muted-foreground">No team members found.</Card>
      ) : (
        <div className="flex flex-wrap gap-6">
          {filtered.map((m) => (
            <IdCard key={m.id} member={m} company={company} />
          ))}
        </div>
      )}
    </div>
  );
}
