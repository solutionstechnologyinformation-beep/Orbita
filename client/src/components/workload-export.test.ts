import { describe, expect, it } from "vitest";
import { buildWorkloadCsv, buildWorkloadPdfHtml, type WorkloadRecommendation } from "./workload-export";

const recommendations: WorkloadRecommendation[] = [
  {
    taskId: 12,
    taskTitle: 'Revisar "ponte"',
    suggestedAssignee: "Ana",
    suggestedDueDate: "2026-08-20",
    rationale: "Prioridade alta e experiência na disciplina.",
  },
];

describe("workload export utilities", () => {
  it("builds a CSV with Orbita visual header, headers and escaped cells", () => {
    const csv = buildWorkloadCsv(recommendations);
    expect(csv).toContain("ÓRBITA · PLANEJAMENTO VISUAL");
    expect(csv).toContain('"ID da Tarefa","Título da Tarefa","Responsável Sugerido","Prazo Sugerido","Justificativa"');
    expect(csv).toContain('"Revisar ""ponte"""');
    expect(csv).toContain('"Prioridade alta e experiência na disciplina."');
  });

  it("builds printable PDF HTML with recommendation data", () => {
    const html = buildWorkloadPdfHtml(recommendations);
    expect(html).toContain("Relatório de Planejamento e Distribuição de Equipe");
    expect(html).toContain("ÓRBITA · PLANEJAMENTO VISUAL");
    expect(html).toContain("orbita-report-header");
    expect(html).toContain("2026-08-20");
    expect(html).toContain("Revisar &quot;ponte&quot;");
  });

  it("escapes HTML content before placing it in the printable report", () => {
    const html = buildWorkloadPdfHtml([{ ...recommendations[0], rationale: "<script>alert('x')</script>" }]);
    expect(html).not.toContain("<script>alert('x')</script>");
    expect(html).toContain("&lt;script&gt;alert(&#39;x&#39;)&lt;/script&gt;");
  });
});
