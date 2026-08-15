import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const sourcePath = path.resolve(process.cwd(), "client/src/pages/CompanyAdmin.tsx");

describe("Feedback de salvamento do branding", () => {
  const source = fs.readFileSync(sourcePath, "utf8");

  it("mantém estados explícitos de salvando, sucesso e erro", () => {
    expect(source).toContain('"idle" | "saving" | "success" | "error"');
    expect(source).toContain('setBrandingSaveState("saving")');
    expect(source).toContain('setBrandingSaveState("success")');
    expect(source).toContain('setBrandingSaveState("error")');
  });

  it("expõe mensagens de feedback para tecnologias assistivas", () => {
    expect(source).toContain('aria-live="polite"');
    expect(source).toContain('aria-atomic="true"');
    expect(source).toContain("Branding salvo");
    expect(source).toContain("Não foi possível");
  });

  it("respeita redução de movimento nas transições e no spinner", () => {
    expect(source).toContain("motion-reduce:transition-none");
    expect(source).toContain("motion-reduce:animate-none");
    expect(source).toContain("motion-reduce:transform-none");
  });
});
