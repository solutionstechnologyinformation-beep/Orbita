import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const stylesheet = readFileSync(new URL("./index.css", import.meta.url), "utf8");

describe("contraste do tema escuro", () => {
  it("mantém textos primary legíveis com o amarelo institucional", () => {
    expect(stylesheet).toContain('.dark [class~="text-primary"]');
    expect(stylesheet).toContain('.dark [class~="text-primary/80"]');
    expect(stylesheet).toContain("color: var(--brand-highlight) !important");
  });
});
