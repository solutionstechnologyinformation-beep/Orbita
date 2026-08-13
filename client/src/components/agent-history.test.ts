import { describe, expect, it } from "vitest";
import { createInitialAgentHistory, HISTORY_CLEAR_DURATION_MS, INITIAL_AGENT_MESSAGE } from "./agent-history";

describe("Orbita AI agent history", () => {
  it("uses a short, consistent fade-out duration", () => {
    expect(HISTORY_CLEAR_DURATION_MS).toBe(220);
  });

  it("creates the initial assistant message", () => {
    expect(createInitialAgentHistory()).toEqual([INITIAL_AGENT_MESSAGE]);
  });

  it("returns an independent history array on every reset", () => {
    const firstHistory = createInitialAgentHistory();
    firstHistory.push({ role: "user", content: "Pesquisar contrato" });
    firstHistory[0].content = "Mensagem alterada";

    expect(createInitialAgentHistory()).toEqual([INITIAL_AGENT_MESSAGE]);
    expect(createInitialAgentHistory()).not.toBe(firstHistory);
    expect(createInitialAgentHistory()[0]).not.toBe(firstHistory[0]);
  });
});
