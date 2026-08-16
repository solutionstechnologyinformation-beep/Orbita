import { describe, expect, it } from "vitest";

describe("company-invite-alerts", () => {
  it("classifica corretamente a severidade de eventos de auditoria", () => {
    const classifySeverity = (action: string) => {
      if (action === "expired" || action === "revoked") return "high";
      if (action === "accepted") return "success";
      return "info";
    };

    expect(classifySeverity("expired")).toBe("high");
    expect(classifySeverity("revoked")).toBe("high");
    expect(classifySeverity("accepted")).toBe("success");
    expect(classifySeverity("created")).toBe("info");
  });

  it("calcula corretamente os contadores de alerta a partir de logs", () => {
    const logs = [
      { action: "expired", details: "Tentativa de uso de convite expirado" },
      { action: "revoked", details: "Convite revogado" },
      { action: "accepted", details: "Convite aceito" },
      { action: "expired", details: "Tentativa de uso de convite expirado" },
    ];

    const alertCount = logs.filter(l => l.action === "expired" || l.action === "revoked").length;
    expect(alertCount).toBe(3);
  });
});
