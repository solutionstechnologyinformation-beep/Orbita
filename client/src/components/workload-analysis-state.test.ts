import { describe, expect, it } from "vitest";
import { isWorkloadAnalysisRequest } from "./workload-analysis-state";

describe("workload analysis loading state", () => {
  it("identifies requests to evaluate open demands and team distribution", () => {
    expect(isWorkloadAnalysisRequest("Avaliar as demandas em aberto e sugerir a distribuição da equipe")).toBe(true);
    expect(isWorkloadAnalysisRequest("Analisar tarefas abertas e prazos")).toBe(true);
  });

  it("does not show the workload loader for ordinary navigation or conversation", () => {
    expect(isWorkloadAnalysisRequest("Boa tarde")).toBe(false);
    expect(isWorkloadAnalysisRequest("Abrir o Kanban")).toBe(false);
    expect(isWorkloadAnalysisRequest("Ir para os projetos")).toBe(false);
  });
});
