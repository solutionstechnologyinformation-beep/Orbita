const WORKLOAD_ANALYSIS_PATTERN = /(demandas?|tarefas?).*(aberta|equipe|prazo|distribui|analis)|avaliar.*demandas?|analisar.*demandas?|distribuir.*(equipe|tarefas?)/i;

export function isWorkloadAnalysisRequest(message: string) {
  return WORKLOAD_ANALYSIS_PATTERN.test(message.trim());
}
