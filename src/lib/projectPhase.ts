export const PROJECT_PHASES = [
  "Inquiry",
  "Design",
  "Approval",
  "Execution",
  "Finishing",
  "Handover",
] as const;
export type ProjectPhase = (typeof PROJECT_PHASES)[number];

export const PHASE_DEFAULT_PCT: Record<ProjectPhase, number> = {
  Inquiry: 5,
  Design: 20,
  Approval: 35,
  Execution: 60,
  Finishing: 85,
  Handover: 100,
};

export function statusLabel(status?: string | null) {
  if (!status) return "—";
  return status === "in_progress" ? "In Progress" : status[0].toUpperCase() + status.slice(1);
}

export function inferPhase(p: { phase?: string | null; status?: string | null }): ProjectPhase {
  if (p.phase && (PROJECT_PHASES as readonly string[]).includes(p.phase)) return p.phase as ProjectPhase;
  if (p.status === "completed") return "Handover";
  return "Execution";
}

export function inferProgress(p: { phase?: string | null; progress_pct?: number | null; status?: string | null }): number {
  if (typeof p.progress_pct === "number" && p.progress_pct > 0) return Math.min(100, Math.max(0, p.progress_pct));
  return PHASE_DEFAULT_PCT[inferPhase(p)];
}
