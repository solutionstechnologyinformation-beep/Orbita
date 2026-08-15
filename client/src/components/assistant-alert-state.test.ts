import { describe, expect, it } from "vitest";
import { getAssistantAlertLabel, getAssistantAlertState } from "./assistant-alert-state";

describe("assistant alert state", () => {
  it("keeps the assistant idle when there are no overdue tasks", () => {
    expect(getAssistantAlertState(0)).toBe("idle");
    expect(getAssistantAlertState(-1)).toBe("idle");
    expect(getAssistantAlertLabel(0)).toBe("Nenhuma tarefa atrasada");
  });

  it("activates the overdue reaction and singular label", () => {
    expect(getAssistantAlertState(1)).toBe("overdue");
    expect(getAssistantAlertLabel(1)).toBe("Atenção: 1 tarefa atrasada");
  });

  it("uses a plural accessible label and accepts large counts", () => {
    expect(getAssistantAlertState(12)).toBe("overdue");
    expect(getAssistantAlertLabel(12)).toBe("Atenção: 12 tarefas atrasadas");
  });
});
