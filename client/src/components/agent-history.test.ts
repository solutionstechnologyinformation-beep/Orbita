import { describe, expect, it } from "vitest";
import { createInitialAgentHistory, INITIAL_AGENT_MESSAGE } from "./agent-history";

describe("Orbita AI agent history", () => {
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
