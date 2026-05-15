import { FitoutStatus, STATUS_TOKEN } from "@/lib/fitout";
import { cn } from "@/lib/utils";

export default function StatusBadge({ status, className }: { status: FitoutStatus; className?: string }) {
  return (
    <span className={cn("inline-flex items-center px-2 py-0.5 rounded text-xs border whitespace-nowrap", STATUS_TOKEN[status], className)}>
      {status}
    </span>
  );
}
