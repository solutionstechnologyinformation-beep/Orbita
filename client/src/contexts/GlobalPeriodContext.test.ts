import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const componentSource = readFileSync(new URL("./GlobalPeriodContext.tsx", import.meta.url), "utf8");
const stylesheet = readFileSync(new URL("../index.css", import.meta.url), "utf8");

describe("contraste do seletor global de período", () => {
  it("identifica o select global com uma classe específica de tema", () => {
    expect(componentSource).toContain('id="global-period-filter"');
    expect(componentSource).toContain("global-period-select");
  });

  it("mantém opções pretas sobre fundo branco e claras no tema escuro", () => {
    expect(stylesheet).toContain(".global-period-select option {");
    expect(stylesheet).toContain("color: #000000;");
    expect(stylesheet).toContain("background-color: #ffffff;");
    expect(stylesheet).toContain(".dark .global-period-select option {");
    expect(stylesheet).toContain("color: #f8fafc;");
    expect(stylesheet).toContain("background-color: #0f172a;");
  });
});
