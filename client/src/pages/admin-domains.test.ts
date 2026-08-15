import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const adminSource = readFileSync(new URL("./Admin.tsx", import.meta.url), "utf8");

describe("Administração de domínios personalizados", () => {
  it("exibe a tela de cadastro e os controles de verificação DNS", () => {
    expect(adminSource).toContain("Domínios personalizados");
    expect(adminSource).toContain("Cadastrar");
    expect(adminSource).toContain("Verificar DNS");
    expect(adminSource).toContain("_orbita-verification.");
  });

  it("oferece gerenciamento de domínio primário e remoção", () => {
    expect(adminSource).toContain("Definir como primário");
    expect(adminSource).toContain("removeDomainM.mutate");
    expect(adminSource).toContain("companyId");
  });
});
