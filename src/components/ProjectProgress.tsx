import { Calendar } from "lucide-react";
import { inferPhase, inferProgress, statusLabel } from "@/lib/projectPhase";

type Props = {
  project: {
    phase?: string | null;
    progress_pct?: number | null;
    estimated_completion?: string | null;
    status?: string | null;
  };
  size?: "sm" | "md";
};

export default function ProjectProgress({ project, size = "md" }: Props) {
  const phase = inferPhase(project);
  const pct = inferProgress(project);
  const status = statusLabel(project.status);
  const eta = project.estimated_completion
    ? new Date(project.estimated_completion).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })
    : null;

  return (
    <div className={size === "sm" ? "space-y-1.5" : "space-y-2"}>
      <div className="flex items-center justify-between gap-2">
        <span className="inline-flex items-center text-[10px] tracking-[0.18em] uppercase border border-accent/50 text-accent px-2 py-0.5 rounded-sm">
          {phase}
        </span>
        <span className="text-xs font-medium text-foreground tabular-nums">{pct}%</span>
      </div>
      <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
        <div
          className="h-full progress-gold rounded-full origin-left animate-progress-grow"
          style={{ width: `${pct}%` }}
          role="progressbar"
          aria-valuenow={pct}
          aria-valuemin={0}
          aria-valuemax={100}
        />
      </div>
      <div className="flex items-center justify-between text-[11px] text-muted-foreground">
        <span>{status}</span>
        {eta && (
          <span className="inline-flex items-center gap-1">
            <Calendar className="w-3 h-3" /> {eta}
          </span>
        )}
      </div>
    </div>
  );
}
