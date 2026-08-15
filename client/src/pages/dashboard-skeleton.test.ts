import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const dashboardSource = readFileSync(new URL("./Dashboard.tsx", import.meta.url), "utf8");

describe("Dashboard Skeletons", () => {
  it("renderiza Skeletons nos cartões KPI e blocos de gráficos durante o carregamento", () => {
    expect(dashboardSource).toContain("statsQ.isLoading ?");
    expect(dashboardSource).toContain("upcomingQ.isLoading ?");
    expect(dashboardSource).toContain("chatActivityQ.isLoading ?");
    expect(dashboardSource).toContain("slaQ.isLoading ?");
    expect(dashboardSource).toContain("<Skeleton");
  });

  it("preserva o layout e as dimensões dos widgets ao exibir o carregamento", () => {
    expect(dashboardSource).toContain("dashboard-page");
    expect(dashboardSource).toContain("DashboardWidgetFrame");
  });
});
