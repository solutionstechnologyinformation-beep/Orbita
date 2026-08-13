export type AgentHistoryEntry = {
  role: "user" | "assistant";
  content: string;
};

export const INITIAL_AGENT_MESSAGE: AgentHistoryEntry = {
  role: "assistant",
  content: "Olá! Posso te levar até tarefas, pesquisar projetos ou consultar sua agenda.",
};

export function createInitialAgentHistory(): AgentHistoryEntry[] {
  return [{ ...INITIAL_AGENT_MESSAGE }];
}
