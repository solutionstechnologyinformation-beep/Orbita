import { describe, expect, it } from "vitest";
import { normalizeHost } from "./tenant-resolver";

describe("Tenant resolver", () => {
  it("normaliza host, porta, ponto final e lista encaminhada", () => {
    expect(normalizeHost("App.Empresa.com.br:443")).toBe("app.empresa.com.br");
    expect(normalizeHost("app.empresa.com.br.")).toBe("app.empresa.com.br");
    expect(normalizeHost("app.empresa.com.br, proxy.internal")).toBe("app.empresa.com.br");
  });

  it("não transforma host vazio em tenant", () => {
    expect(normalizeHost(undefined)).toBe("");
    expect(normalizeHost(" ")).toBe("");
  });
});
