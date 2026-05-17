import { cn } from "@/lib/utils";

function initials(name?: string | null) {
  if (!name) return "—";
  return name.trim().split(/\s+/).slice(0, 2).map((p) => p[0]?.toUpperCase()).join("") || "—";
}

export default function PMAvatar({ name, className }: { name?: string | null; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center justify-center w-6 h-6 rounded-full bg-accent/15 text-accent text-[10px] font-semibold ring-1 ring-accent/40 shrink-0",
        className,
      )}
      title={name || undefined}
    >
      {initials(name)}
    </span>
  );
}
