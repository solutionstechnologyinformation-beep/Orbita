export type AssistantAlertState = "idle" | "overdue";

export function getAssistantAlertState(overdueTaskCount: number): AssistantAlertState {
  return Number.isFinite(overdueTaskCount) && overdueTaskCount > 0 ? "overdue" : "idle";
}

export function getAssistantAlertLabel(overdueTaskCount: number): string {
  if (overdueTaskCount <= 0) return "Nenhuma tarefa atrasada";
  return overdueTaskCount === 1
    ? "Atenção: 1 tarefa atrasada"
    : `Atenção: ${overdueTaskCount} tarefas atrasadas`;
}
