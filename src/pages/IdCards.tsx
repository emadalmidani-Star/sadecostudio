import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useUserRole } from "@/hooks/useUserRole";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { QrCode, Download, Search } from "lucide-react";
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

function QrTile({ member, company }: { member: Member; company: Company | null }) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [qr, setQr] = useState<string>("");

  useEffect(() => {
    QRCode.toDataURL(buildVCard(member, company), {
      margin: 2,
      width: 600,
      color: { dark: "#0a0a0a", light: "#ffffff" },
      errorCorrectionLevel: "H", // high — allows the logo overlay
    }).then(setQr);
  }, [member, company]);

  async function download() {
    try {
      const html2canvas = (await import("html2canvas")).default;
      if (!wrapRef.current) return;
      const canvas = await html2canvas(wrapRef.current, { scale: 3, backgroundColor: "#ffffff" });
      const link = document.createElement("a");
      link.download = `${(member.full_name || "qr").replace(/\s+/g, "-")}-qr.png`;
      link.href = canvas.toDataURL("image/png");
      link.click();
    } catch {
      toast.error("Couldn't download QR");
    }
  }

  return (
    <div className="flex flex-col items-center gap-3">
      <div
        ref={wrapRef}
        className="relative w-72 h-72 rounded-xl bg-white p-4 shadow-lg border border-border"
      >
        {qr ? (
          <img src={qr} alt={`QR for ${member.full_name}`} className="w-full h-full" />
        ) : (
          <div className="w-full h-full bg-muted animate-pulse rounded" />
        )}
        {company?.logo_url && (
          <div
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white rounded-md p-1.5 shadow-md flex items-center justify-center"
            style={{ width: 64, height: 64 }}
          >
            <img src={company.logo_url} alt="" className="max-w-full max-h-full object-contain" />
          </div>
        )}
      </div>
      <div className="text-center">
        <p className="font-serif text-base">{member.full_name || member.email}</p>
        {member.job_title && (
          <p className="text-xs text-accent tracking-wider uppercase">{member.job_title}</p>
        )}
      </div>
      <Button variant="outline" size="sm" onClick={download}>
        <Download className="w-3 h-3 mr-1" /> Download
      </Button>
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
            <QrTile key={m.id} member={m} company={company} />
          ))}
        </div>
      )}
    </div>
  );
}
