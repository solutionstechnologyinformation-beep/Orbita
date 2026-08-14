import { Minus, TrendingDown, TrendingUp } from "lucide-react";
import { formatTrendDescription, getTrendPresentation } from "./dashboard-trend-utils";
import { TREND_COMPARISON_PERIOD_LABELS, TREND_COMPARISON_PERIODS, type TrendComparisonPeriod } from "./dashboard-trend-period";
import { DashboardSparkline } from "./DashboardSparkline";

type DashboardTrendIndicatorProps = {
  value?: number | null;
  suffix?: string;
  period?: string;
  label: string;
  positiveWhenUp?: boolean;
  series?: number[];
};

type DashboardTrendPeriodSelectProps = {
  value: TrendComparisonPeriod;
  onChange: (period: TrendComparisonPeriod) => void;
};

export function DashboardTrendPeriodSelect({ value, onChange }: DashboardTrendPeriodSelectProps) {
  return (
    <label className="dashboard-trend-period-control inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-[11px] font-medium">
      <span className="sr-only">Comparar tendências por período</span>
      <span aria-hidden="true">Comparar</span>
      <select
        value={value}
        aria-label="Período de comparação das tendências"
        onChange={(event) => onChange(event.target.value as TrendComparisonPeriod)}
        className="dashboard-trend-period-select rounded border-0 bg-transparent px-1 py-0.5 text-[11px] font-semibold focus:outline-none focus:ring-2 focus:ring-[#ffc30d]"
      >
        {TREND_COMPARISON_PERIODS.map((period) => (
          <option key={period} value={period}>{TREND_COMPARISON_PERIOD_LABELS[period]}</option>
        ))}
      </select>
    </label>
  );
}

export function DashboardTrendIndicator({
  value,
  suffix = "%",
  period = "período anterior",
  label,
  positiveWhenUp = true,
  series = [],
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
        className="dashboard-trend-tooltip pointer-events-none absolute bottom-full left-1/2 z-30 mb-2 w-56 -translate-x-1/2 rounded-lg px-3 py-2 text-[11px] font-medium opacity-0 shadow-lg transition-opacity duration-150 group-hover:opacity-100 group-focus-visible:opacity-100"
      >
        <span className="block text-[10px] uppercase tracking-wide opacity-70">Tendência · {label}</span>
        <span className="mt-0.5 block">{description}</span>
        {series.length >= 2 ? (
          <span className="mt-2 block" aria-label={`Série histórica de ${label}`}>
            <DashboardSparkline data={series} color={presentation.tone === "negative" ? "#ef4444" : presentation.tone === "positive" ? "#22c55e" : "#94a3b8"} />
          </span>
        ) : (
          <span className="mt-2 block text-[10px] opacity-70">Série histórica insuficiente.</span>
        )}
      </span>
    </span>
  );
}
