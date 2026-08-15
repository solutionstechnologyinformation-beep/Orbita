import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const componentSource = readFileSync(new URL("./DashboardOkrBox.tsx", import.meta.url), "utf8");
const dashboardSource = readFileSync(new URL("./Dashboard.tsx", import.meta.url), "utf8");

describe("DashboardOkrBox", () => {
  it("organiza saúde, resultados-chave, tendência e riscos em uma caixa acessível", () => {
    expect(componentSource).toContain('data-okr-box="true"');
    expect(componentSource).toContain('aria-labelledby="dashboard-okr-title"');
    expect(componentSource).toContain("Saúde");
    expect(componentSource).toContain("Resultados-chave");
    expect(componentSource).toContain("Tendência");
    expect(componentSource).toContain("Riscos e capacidade");
  });

  it("usa dados reais e não cria valores aleatórios para os gráficos", () => {
    expect(componentSource).toContain("stats?.avgProgress");
    expect(componentSource).toContain("stats?.checklistProgress");
    expect(componentSource).toContain("sla?.history");
    expect(componentSource).toContain("contracts");
    expect(componentSource).toContain("members");
    expect(componentSource).not.toContain("Math.random");
  });

  it("mantém skeleton acessível enquanto as consultas principais carregam", () => {
    expect(componentSource).toContain('role="status"');
    expect(componentSource).toContain('aria-label="Carregando indicadores de OKR"');
    expect(componentSource).toContain("<Skeleton");
    expect(dashboardSource).toContain("memberPerformanceQ");
    expect(dashboardSource).toContain("<DashboardOkrBox");
  });

  it("oferece atalhos contextuais para contratos, Kanban e mapa", () => {
    expect(componentSource).toContain('onNavigate("/projects")');
    expect(componentSource).toContain('onNavigate("/kanban")');
    expect(componentSource).toContain('onNavigate("/dashboard#mapa")');
  });
});
