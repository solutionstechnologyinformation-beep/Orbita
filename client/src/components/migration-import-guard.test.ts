import { describe, expect, it } from "vitest";
import { getMigrationImportWarning, prepareMigrationImport } from "./migration-import-guard";

describe("migration import guard", () => {
  it("prepares a valid migration file without importing it", () => {
    const pending = prepareMigrationImport("backup.json", JSON.stringify({ version: "1.1.0", data: { tasks: [{ id: 1 }], clients: [] } }));
    expect(pending.fileName).toBe("backup.json");
    expect(pending.version).toBe("1.1.0");
    expect(pending.recordGroups).toBe(2);
  });

  it("rejects empty, malformed and unexpected JSON files", () => {
    expect(() => prepareMigrationImport("empty.json", " ")).toThrow("arquivo está vazio");
    expect(() => prepareMigrationImport("bad.json", "{bad")).toThrow("JSON válido");
    expect(() => prepareMigrationImport("other.json", JSON.stringify({ data: [] }))).toThrow("estrutura de migração");
  });

  it("explains that confirmation is required before changing the current environment", () => {
    const pending = prepareMigrationImport("orbita.json", JSON.stringify({ version: "1.1.0", data: { tasks: [] } }));
    expect(getMigrationImportWarning(pending)).toContain("orbita.json");
    expect(getMigrationImportWarning(pending)).toContain("ambiente atual");
  });
});
