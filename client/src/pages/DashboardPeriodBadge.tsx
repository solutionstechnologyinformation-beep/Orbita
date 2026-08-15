import { useState } from "react";
import { CalendarDays, SlidersHorizontal } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import type { GlobalPeriodRange } from "@/contexts/GlobalPeriodContext";
import { useGlobalPeriod } from "@/contexts/GlobalPeriodContext";

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

export function getDashboardPeriodDays(range: GlobalPeriodRange) {
  if (!range.start || !range.end) return null;
  const start = Date.UTC(range.start.getFullYear(), range.start.getMonth(), range.start.getDate());
  const end = Date.UTC(range.end.getFullYear(), range.end.getMonth(), range.end.getDate());
  return Math.max(0, Math.floor((end - start) / 86_400_000) + 1);
}

export function getDashboardPeriodDaysLabel(range: GlobalPeriodRange) {
  const days = getDashboardPeriodDays(range);
  if (days === null) return range.start || range.end ? "Defina as duas datas" : "Sem limite de dias";
  return `${days} ${days === 1 ? "dia" : "dias"}`;
}

function focusGlobalPeriodFilter() {
  const filter = document.getElementById("global-period-filter");
  if (!filter) return;
  filter.focus({ preventScroll: true });
  filter.scrollIntoView({ behavior: "smooth", block: "center" });
}

export function DashboardPeriodBadge({ label, className }: { label?: string; className?: string }) {
  const { label: contextLabel, range } = useGlobalPeriod();
  const [open, setOpen] = useState(false);
  const displayLabel = formatDashboardPeriodLabel(label ?? contextLabel);
  const daysLabel = getDashboardPeriodDaysLabel(range);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            "inline-flex max-w-[12rem] items-center gap-1 rounded-full border border-teal-200/80 bg-teal-50/90 px-2 py-0.5 text-[10px] font-semibold leading-4 text-teal-800 transition-colors hover:border-teal-300 hover:bg-teal-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-1 dark:border-teal-800 dark:bg-teal-950/50 dark:text-teal-200 dark:hover:border-teal-700 dark:hover:bg-teal-900/70",
            className,
          )}
          title={`Período ativo: ${displayLabel}. Clique para ver detalhes.`}
          aria-label={`Período ativo: ${displayLabel}. Clique para ver detalhes.`}
          aria-haspopup="dialog"
          aria-expanded={open}
          data-dashboard-period-indicator="true"
        >
          <CalendarDays className="h-3 w-3 shrink-0" aria-hidden="true" />
          <span className="truncate">{displayLabel}</span>
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" sideOffset={8} className="w-[min(19rem,calc(100vw-2rem))] space-y-3 rounded-xl border-teal-200 bg-white p-3 shadow-xl dark:border-teal-800 dark:bg-slate-900">
        <div className="space-y-1">
          <p className="text-xs font-semibold text-slate-900 dark:text-slate-100">Período ativo</p>
          <p className="truncate text-sm font-medium text-teal-700 dark:text-teal-300" title={displayLabel}>{displayLabel}</p>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Total do intervalo: <strong className="text-slate-700 dark:text-slate-200">{daysLabel}</strong>
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            setOpen(false);
            window.setTimeout(focusGlobalPeriodFilter, 0);
          }}
          className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-teal-600 px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-teal-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2 dark:bg-teal-700 dark:hover:bg-teal-600"
        >
          <SlidersHorizontal className="h-3.5 w-3.5" aria-hidden="true" />
          Alterar filtro global
        </button>
      </PopoverContent>
    </Popover>
  );
}
