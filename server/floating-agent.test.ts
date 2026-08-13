import { describe, expect, it } from "vitest";
import { fallbackFloatingAgentResponse, normalizeFloatingAgentResponse } from "./floating-agent";

describe("floating agent command fallback", () => {
  it("opens a specific task", () => {
    const response = fallbackFloatingAgentResponse("ir para a tarefa 42");
    expect(response.action).toMatchObject({ type: "navigate", targetUrl: "/tasks/42" });
  });

  it("routes agenda and Kanban requests safely", () => {
    expect(fallbackFloatingAgentResponse("ver minha agenda").action.targetUrl).toBe("/calendar");
    expect(fallbackFloatingAgentResponse("abrir o kanban").action.targetUrl).toBe("/kanban");
  });

  it("rejects external navigation returned by an untrusted model response", () => {
    const response = normalizeFloatingAgentResponse({
      reply: "ok",
      action: { type: "navigate", targetUrl: "https://example.com", searchTerm: "" },
    });
    expect(response.action.type).toBe("none");
    expect(response.action.targetUrl).toBe("");
  });

  it("provides a helpful response for unsupported commands", () => {
    const response = fallbackFloatingAgentResponse("olá assistente");
    expect(response.action.type).toBe("none");
    expect(response.reply).toContain("assistente flutuante");
  });
});
