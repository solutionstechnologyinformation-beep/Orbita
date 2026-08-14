import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const detailChartSource = readFileSync(new URL("./DashboardTrendDetailChart.tsx", import.meta.url), "utf8");
const detailDialogSource = readFileSync(new URL("./DashboardTrendDetailDialog.tsx", import.meta.url), "utf8");
const indicatorSource = readFileSync(new URL("./DashboardTrendIndicator.tsx", import.meta.url), "utf8");


describe("dashboard trend detail modal", () => {
  it("opens the detail dialog from an accessible sparkline trigger", () => {
    expect(detailDialogSource).toContain("<Dialog>");
    expect(detailDialogSource).toContain("<DialogTrigger asChild>");
    expect(detailDialogSource).toContain("aria-label={`Abrir gráfico detalhado de ${label}`}");
    expect(detailDialogSource).toContain("<DashboardSparkline data={data}");
    expect(indicatorSource).toContain("<DashboardTrendDetailDialog");
  });

  it("renders the selected period and historical summary values", () => {
    expect(detailDialogSource).toContain("Evolução da série no período selecionado: {period}");
    expect(detailDialogSource).toContain("Histórico de {label}");
    expect(detailDialogSource).toContain("const latest = data[data.length - 1]");
    expect(detailDialogSource).toContain("const minimum = Math.min(...data)");
    expect(detailDialogSource).toContain("const maximum = Math.max(...data)");
  });

  it("provides interactive, keyboard-reachable points in the detailed SVG", () => {
    expect(detailChartSource).toContain("tabIndex={0}");
    expect(detailChartSource).toContain('role="button"');
    expect(detailChartSource).toContain("onMouseEnter={() => setActiveIndex(index)}");
    expect(detailChartSource).toContain("onFocus={() => setActiveIndex(index)}");
    expect(detailChartSource).toContain("aria-label={`${point.label}: ${point.value}${valueSuffix}`}");
  });

  it("keeps the dialog and chart theme-aware and supports reduced motion", () => {
    expect(detailDialogSource).toContain("bg-[var(--background)]");
    expect(detailDialogSource).toContain("bg-[var(--card)]");
    expect(detailChartSource).toContain("var(--popover)");
    expect(readFileSync(new URL("../index.css", import.meta.url), "utf8")).toContain(".dashboard-trend-sparkline-trigger");
    expect(readFileSync(new URL("../index.css", import.meta.url), "utf8")).toContain("prefers-reduced-motion: reduce");
  });
});
