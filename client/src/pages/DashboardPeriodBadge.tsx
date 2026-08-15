import { CalendarDays } from "lucide-react";
import { cn } from "@/lib/utils";

function formatIsoDate(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  return match ? `${match[3]}/${match[2]}/${match[1]}` : value;
}

export function formatDashboardPeriodLabel(label: string) {
  const [start, end] = label.split(" → ");
  if (end && (start === "…" || /^\d{4}-\d{2}-\d{2}$/.test(start)) && (end === "…" || /^\d{4}-\d{2}-\d{2}$/.test(end))) {
    return `${formatIsoDate(start)} – ${formatIsoDate(end)}`;
  }
  return label;
}

export function DashboardPeriodBadge({ label, className }: { label: string; className?: string }) {
  const displayLabel = formatDashboardPeriodLabel(label);
  return (
    <span
      className={cn(
        "inline-flex max-w-[12rem] items-center gap-1 rounded-full border border-teal-200/80 bg-teal-50/90 px-2 py-0.5 text-[10px] font-semibold leading-4 text-teal-800 dark:border-teal-800 dark:bg-teal-950/50 dark:text-teal-200",
        className,
      )}
      title={`Período ativo: ${displayLabel}`}
      aria-label={`Período ativo: ${displayLabel}`}
      data-dashboard-period-indicator="true"
    >
      <CalendarDays className="h-3 w-3 shrink-0" aria-hidden="true" />
      <span className="truncate">{displayLabel}</span>
    </span>
  );
}
