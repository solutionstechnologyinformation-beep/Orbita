export type KanbanTaskStatus = "pending" | "in_progress" | "shared" | "published" | "archived" | "blocked";

export function getKanbanStatusForPhase(phaseName: string | null | undefined, currentStatus?: KanbanTaskStatus): KanbanTaskStatus | undefined {
  const normalized = phaseName?.trim().toLocaleLowerCase("pt-BR") ?? "";
  if (/bloquead/.test(normalized)) return "blocked";
  if (/concluíd|concluid|arquivad/.test(normalized)) return "archived";
  if (/publicad/.test(normalized)) return "published";
  if (/compartilhad/.test(normalized)) return "shared";
  if (/andament/.test(normalized)) return "in_progress";
  if (/iniciar|pendente|a fazer|fazer/.test(normalized)) return "pending";
  return currentStatus === "blocked" ? "in_progress" : currentStatus;
}
