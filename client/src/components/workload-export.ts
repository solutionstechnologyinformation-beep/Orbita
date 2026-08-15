export type WorkloadRecommendation = {
  taskId: number;
  taskTitle: string;
  suggestedAssignee: string;
  suggestedDueDate: string;
  rationale: string;
};

function escapeCsvCell(value: string | number) {
  return `"${String(value).replace(/"/g, '""')}"`;
}

function escapeHtml(value: string | number) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function buildWorkloadCsv(recommendations: WorkloadRecommendation[]) {
  const header = ["ID da Tarefa", "Título da Tarefa", "Responsável Sugerido", "Prazo Sugerido", "Justificativa"];
  const rows = recommendations.map((recommendation) => [
    recommendation.taskId,
    recommendation.taskTitle,
    recommendation.suggestedAssignee,
    recommendation.suggestedDueDate,
    recommendation.rationale,
  ]);
  return [header, ...rows].map((row) => row.map(escapeCsvCell).join(",")).join("\n");
}

export function buildWorkloadPdfHtml(recommendations: WorkloadRecommendation[]) {
  const rows = recommendations.map((recommendation) => `
    <tr>
      <td>#${escapeHtml(recommendation.taskId)}</td>
      <td>${escapeHtml(recommendation.taskTitle)}</td>
      <td>${escapeHtml(recommendation.suggestedAssignee)}</td>
      <td>${escapeHtml(recommendation.suggestedDueDate)}</td>
      <td>${escapeHtml(recommendation.rationale)}</td>
    </tr>`).join("");

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8">
  <title>Prévia — Distribuição de Equipe | Orbita</title>
  <style>
    @page { size: A4 landscape; margin: 16mm; }
    body { font-family: Arial, sans-serif; padding: 20px; color: #172033; }
    h1 { color: #111827; font-size: 22px; margin: 0 0 6px; }
    p.subtitle { color: #64748b; margin: 0 0 22px; }
    table { width: 100%; border-collapse: collapse; }
    th, td { border: 1px solid #cbd5e1; padding: 9px 10px; font-size: 12px; text-align: left; vertical-align: top; }
    th { background: #f1f5f9; font-weight: 700; }
    tr:nth-child(even) { background: #f8fafc; }
  </style>
</head>
<body>
  <h1>Relatório de Planejamento e Distribuição de Equipe</h1>
  <p class="subtitle">Orbita — recomendações geradas para revisão do planejamento</p>
  <table>
    <thead>
      <tr><th>ID</th><th>Tarefa</th><th>Responsável sugerido</th><th>Prazo sugerido</th><th>Justificativa</th></tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>
</body>
</html>`;
}
