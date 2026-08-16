import { describe, expect, it } from "vitest";
import { sendOperationalAlert } from "./operational-alerts";

describe("OperationalAlerts", () => {
  it("retorna erro graciosamente quando a chave do Resend não está presente", async () => {
    const originalKey = process.env.RESEND_API_KEY;
    delete process.env.RESEND_API_KEY;

    const result = await sendOperationalAlert({
      to: "test@example.com",
      subject: "Teste de Alerta",
      title: "Alerta Crítico",
      message: "Verificação de segurança do sistema.",
      severity: "critical",
    });

    expect(result.success).toBe(false);
    expect(result.error).toBe("RESEND_API_KEY missing");

    if (originalKey) {
      process.env.RESEND_API_KEY = originalKey;
    }
  });
});
