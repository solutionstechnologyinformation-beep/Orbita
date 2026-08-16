import { describe, expect, it } from "vitest";
import { summarizeImportResult } from "./migration-import-result";

describe("migration import result", () => {
  it("classifies a clean import as success", () => {
    expect(summarizeImportResult(4, 0, 0).kind).toBe("success");
  });

  it("classifies ignored or failed records alongside inserted records as partial", () => {
    const result = summarizeImportResult(3, 1, 2);
    expect(result.kind).toBe("partial");
    expect(result.message).toContain("3 registro(s) inseridos");
  });

  it("classifies an import with no inserted records as failure alert", () => {
    const result = summarizeImportResult(0, 2, 1);
    expect(result.kind).toBe("failure");
    expect(result.title).toContain("alerta");
  });
});
