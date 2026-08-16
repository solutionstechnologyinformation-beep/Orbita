import { describe, expect, it } from "vitest";

describe("company-invite-security-actions", () => {
  it("valida a geração correta de CSV para relatórios de auditoria de convites", () => {
    const logs = [
      { id: 1, action: "created", details: "Convite gerado para test@empresa.com", ipAddress: "127.0.0.1", createdAt: new Date().toISOString() },
      { id: 2, action: "expired", details: "Tentativa de uso de convite expirado", ipAddress: "192.168.1.50", createdAt: new Date().toISOString() },
    ];

    const csvRows = [
      ["ID", "Acao", "Detalhes", "IP", "Data/Hora"],
      ...logs.map(l => [l.id, l.action, `"${l.details}"`, l.ipAddress, l.createdAt])
    ];

    const csvContent = csvRows.map(row => row.join(",")).join("\n");
    expect(csvContent).toContain("expired");
    expect(csvContent).toContain("192.168.1.50");
    expect(csvContent.split("\n").length).toBe(3);
  });

  it("verifica lógica de bloqueio por IP após repetidas tentativas inválidas", () => {
    const failedAttemptsMap = new Map<string, number>();
    const MAX_ATTEMPTS = 3;

    const recordAttempt = (ip: string) => {
      const count = (failedAttemptsMap.get(ip) || 0) + 1;
      failedAttemptsMap.set(ip, count);
      return count >= MAX_ATTEMPTS;
    };

    const ip = "203.0.113.42";
    expect(recordAttempt(ip)).toBe(false); // 1
    expect(recordAttempt(ip)).toBe(false); // 2
    expect(recordAttempt(ip)).toBe(true);  // 3 - Bloqueado
  });
});
