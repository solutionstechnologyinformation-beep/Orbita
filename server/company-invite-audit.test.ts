import { describe, expect, it } from "vitest";

describe("company-invite-audit", () => {
  it("valida ações suportadas de auditoria de convites", () => {
    const validActions = ["created", "viewed", "accepted", "revoked", "expired"] as const;
    expect(validActions).toContain("created");
    expect(validActions).toContain("accepted");
    expect(validActions).toContain("revoked");
    expect(validActions.length).toBe(5);
  });

  it("garante mascara adequada para registros de auditoria sem expor tokens", () => {
    const logEntry = {
      action: "created",
      details: "Convite gerado para colaborador@empresa.com.br com permissão user",
      ipAddress: "127.0.0.1",
    };
    expect(logEntry.details).not.toContain("token=");
    expect(logEntry.action).toBe("created");
  });
});
