export type AgentHistoryEntry = {
  role: "user" | "assistant";
  content: string;
  actionUrl?: string;
  actionLabel?: string;
};

export const HISTORY_CLEAR_DURATION_MS = 220;
export const INITIAL_SCREEN_ENTRY_DURATION_MS = 300;

export const INITIAL_AGENT_MESSAGE: AgentHistoryEntry = {
  role: "assistant",
  content: "Olá! Posso te levar até tarefas, pesquisar projetos ou consultar sua agenda.",
};

export function createInitialAgentHistory(): AgentHistoryEntry[] {
  return [{ ...INITIAL_AGENT_MESSAGE }];
}
