import { useState } from "react";

type DashboardTrendDetailChartProps = {
  data: number[];
  labels?: string[];
  color?: string;
  valueSuffix?: string;
  label: string;
};

const CHART_WIDTH = 520;
const CHART_HEIGHT = 250;
const PADDING = { top: 22, right: 18, bottom: 38, left: 42 };

export function DashboardTrendDetailChart({
  data,
  labels = [],
  color = "#3b82f6",
  valueSuffix = "%",
  label,
}: DashboardTrendDetailChartProps) {
  const [activeIndex, setActiveIndex] = useState<number | null>(data.length > 0 ? data.length - 1 : null);
  if (data.length < 2) return null;

  const plotWidth = CHART_WIDTH - PADDING.left - PADDING.right;
  const plotHeight = CHART_HEIGHT - PADDING.top - PADDING.bottom;
  const rawMin = Math.min(...data);
  const rawMax = Math.max(...data);
  const range = rawMax - rawMin || 1;
  const min = rawMin - range * 0.1;
  const max = rawMax + range * 0.1;
  const scaledRange = max - min;
  const points = data.map((value, index) => {
    const x = PADDING.left + (index / (data.length - 1)) * plotWidth;
    const y = PADDING.top + (1 - (value - min) / scaledRange) * plotHeight;
    return { x, y, value, label: labels[index] ?? `Ponto ${index + 1}` };
  });
  const polyline = points.map((point) => `${point.x},${point.y}`).join(" ");
  const activePoint = activeIndex === null ? null : points[activeIndex];
  const tooltipWidth = 132;
  const tooltipX = activePoint ? Math.min(Math.max(activePoint.x - tooltipWidth / 2, 4), CHART_WIDTH - tooltipWidth - 4) : 0;
  const tooltipY = activePoint ? Math.max(activePoint.y - 48, 4) : 0;

  return (
    <div className="dashboard-trend-detail-chart" role="group" aria-label={`Gráfico detalhado de ${label}`}>
      <svg viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`} className="h-auto w-full overflow-visible" aria-hidden="false">
        {[0, 0.5, 1].map((ratio) => {
          const y = PADDING.top + ratio * plotHeight;
          const value = max - ratio * scaledRange;
          return (
            <g key={ratio}>
              <line x1={PADDING.left} x2={CHART_WIDTH - PADDING.right} y1={y} y2={y} className="dashboard-trend-grid-line" />
              <text x={PADDING.left - 8} y={y + 4} textAnchor="end" className="dashboard-trend-axis-label">{`${value.toFixed(0)}${valueSuffix}`}</text>
            </g>
          );
        })}
        <polyline points={polyline} fill="none" stroke={color} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
        {points.map((point, index) => (
          <g key={`${point.label}-${index}`}>
            <circle
              cx={point.x}
              cy={point.y}
              r={activeIndex === index ? 7 : 5}
              fill="var(--popover)"
              stroke={color}
              strokeWidth="3"
              tabIndex={0}
              role="button"
              aria-label={`${point.label}: ${point.value}${valueSuffix}`}
              onMouseEnter={() => setActiveIndex(index)}
              onFocus={() => setActiveIndex(index)}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  setActiveIndex(index);
                }
              }}
              onMouseLeave={() => setActiveIndex(null)}
              onBlur={() => setActiveIndex(null)}
              className="cursor-pointer outline-none transition-all focus-visible:stroke-[#ffc30d]"
            />
            <text x={point.x} y={CHART_HEIGHT - 12} textAnchor="middle" className="dashboard-trend-axis-label">{point.label}</text>
          </g>
        ))}
        {activePoint && (
          <g pointerEvents="none">
            <rect x={tooltipX} y={tooltipY} width={tooltipWidth} height="34" rx="6" className="dashboard-trend-chart-tooltip" />
            <text x={tooltipX + tooltipWidth / 2} y={tooltipY + 14} textAnchor="middle" className="dashboard-trend-chart-tooltip-text">{activePoint.label}</text>
            <text x={tooltipX + tooltipWidth / 2} y={tooltipY + 27} textAnchor="middle" className="dashboard-trend-chart-tooltip-text dashboard-trend-chart-tooltip-value">{`${activePoint.value}${valueSuffix}`}</text>
          </g>
        )}
      </svg>
      <p className="sr-only">Passe o mouse ou use Tab nos pontos para consultar cada valor da série.</p>
    </div>
  );
}
