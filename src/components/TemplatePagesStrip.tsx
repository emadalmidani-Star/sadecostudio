import { Trash2 } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";

export type TemplatePage = { id: string; image_url: string; role: string | null; page_index: number };

const ROLES = [
  { value: "unused", label: "Unused" },
  { value: "cover", label: "Cover" },
  { value: "divider", label: "Divider" },
  { value: "project", label: "Project" },
  { value: "thankyou", label: "Thank You" },
  { value: "idcard", label: "ID Card" },
];

export default function TemplatePagesStrip({
  pages, onAssign, onDelete, onSelect, activeRole,
}: {
  pages: TemplatePage[];
  onAssign: (pageId: string, role: string) => void;
  onDelete: (pageId: string) => void;
  onSelect: (page: TemplatePage) => void;
  activeRole: string;
}) {
  if (pages.length === 0) return null;
  return (
    <div className="flex gap-3 overflow-x-auto pb-3 mb-3 border-b border-border">
      {pages.map(p => (
        <div key={p.id} className="shrink-0 w-32">
          <button
            onClick={() => onSelect(p)}
            className={`block w-32 h-20 border-2 ${p.role === activeRole ? "border-accent" : "border-border"} overflow-hidden bg-muted`}
          >
            <img src={p.image_url} className="w-full h-full object-cover" alt="" />
          </button>
          <Select value={p.role || "unused"} onValueChange={(v) => onAssign(p.id, v)}>
            <SelectTrigger className="h-7 text-xs mt-1"><SelectValue /></SelectTrigger>
            <SelectContent>
              {ROLES.map(r => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button variant="ghost" size="sm" className="w-full h-6 text-xs mt-1" onClick={() => onDelete(p.id)}>
            <Trash2 className="w-3 h-3 mr-1" />Remove
          </Button>
        </div>
      ))}
    </div>
  );
}
