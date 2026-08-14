import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const sparklineSource = readFileSync(new URL("./DashboardSparkline.tsx", import.meta.url), "utf8");
const indicatorSource = readFileSync(new URL("./DashboardTrendIndicator.tsx", import.meta.url), "utf8");

describe("dashboard sparkline", () => {
  it("uses an SVG polyline with a highlighted last point", () => {
    expect(sparklineSource).toContain("<svg");
    expect(sparklineSource).toContain("<polyline");
    expect(sparklineSource).toContain("<circle");
    expect(sparklineSource).toContain("data.length < 2");
  });

  it("renders the historical series inside the trend tooltip", () => {
    expect(indicatorSource).toContain("series.length >= 2");
    expect(indicatorSource).toContain("<DashboardTrendDetailDialog");
    expect(indicatorSource).toContain("data={series}");
    expect(indicatorSource).toContain("Série histórica insuficiente.");
  });

  it("keeps the visualization decorative while exposing context through the tooltip", () => {
    expect(sparklineSource).toContain('aria-hidden="true"');
    expect(indicatorSource).toContain('aria-label={`${label}: ${description}`}');
  });
});
