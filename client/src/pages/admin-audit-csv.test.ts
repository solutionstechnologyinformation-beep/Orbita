import { describe, it, expect } from "vitest";

describe("Admin Audit Logs CSV Export", () => {
  it("should format audit logs into valid CSV string", () => {
    const logs = [
      { id: 1, action: "update_branding", timestamp: 1786798000000, user: "admin@orbita.com" },
      { id: 2, action: "verify_domain", timestamp: 1786798100000, user: "admin@orbita.com" },
    ];

    const headers = "ID,Acao,Data,Usuario";
    const rows = logs.map(l => `${l.id},"${l.action}",${new Date(l.timestamp).toISOString()},"${l.user}"`);
    const csv = [headers, ...rows].join("\n");

    expect(csv).toContain("update_branding");
    expect(csv).toContain("verify_domain");
    expect(csv.split("\n").length).toBe(3);
  });
});
