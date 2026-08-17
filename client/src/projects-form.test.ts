import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("formulário técnico de contratos", () => {
  const source = readFileSync(resolve(process.cwd(), "client/src/pages/Projects.tsx"), "utf8");

  it("monta os blocos técnicos diretamente para preservar o foco dos inputs", () => {
    expect(source).toContain("{TechnicalFields()}");
    expect(source).not.toContain("<TechnicalFields />");
    expect(source).toContain("{TipoObraCheckboxes()}");
    expect(source).not.toContain("<TipoObraCheckboxes />");
  });

  it("exibe a área total em metros quadrados no cadastro", () => {
    expect(source).toContain("Área total (m²)");
    expect(source).not.toContain("<Label>Área (ha)</Label>");
  });
});
