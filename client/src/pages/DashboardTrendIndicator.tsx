import { Minus, TrendingDown, TrendingUp } from "lucide-react";
import { formatTrendDescription, getTrendPresentation } from "./dashboard-trend-utils";

type DashboardTrendIndicatorProps = {
  value?: number | null;
  suffix?: string;
  period?: string;
  label: string;
  positiveWhenUp?: boolean;
};

export function DashboardTrendIndicator({
  value,
  suffix = "%",
  period = "período anterior",
  label,
  positiveWhenUp = true,
}: DashboardTrendIndicatorProps) {
  const presentation = getTrendPresentation(value, positiveWhenUp);
  const description = formatTrendDescription(value, suffix, period);
  const toneClass = presentation.tone === "positive"
    ? "dashboard-trend-positive"
    : presentation.tone === "negative"
      ? "dashboard-trend-negative"
      : "dashboard-trend-neutral";
  const Icon = presentation.direction === "up" ? TrendingUp : presentation.direction === "down" ? TrendingDown : Minus;

  return (
    <span
      className="dashboard-trend-anchor group relative inline-flex"
      tabIndex={0}
      aria-label={`${label}: ${description}`}
    >
      <span className={`inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${toneClass}`}>
        <Icon className="h-3 w-3" aria-hidden="true" />
        {presentation.label}{suffix}
      </span>
      <span
        role="tooltip"
        className="dashboard-trend-tooltip pointer-events-none absolute bottom-full left-1/2 z-30 mb-2 w-52 -translate-x-1/2 rounded-lg px-3 py-2 text-[11px] font-medium opacity-0 shadow-lg transition-opacity duration-150 group-hover:opacity-100 group-focus-visible:opacity-100"
      >
        <span className="block text-[10px] uppercase tracking-wide opacity-70">Tendência · {label}</span>
        <span className="mt-0.5 block">{description}</span>
      </span>
    </span>
  );
}
