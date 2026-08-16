import { describe, expect, it } from "vitest";
import { IMPORT_STEPS } from "./migration-progress";

describe("migration progress", () => {
  it("provides ordered progress steps from validation to completion", () => {
    expect(IMPORT_STEPS[0].percent).toBe(10);
    expect(IMPORT_STEPS.at(-1)?.percent).toBe(100);
    expect(IMPORT_STEPS.map((step) => step.percent)).toEqual([10, 35, 65, 90, 100]);
  });

  it("communicates that the import is complete at the final step", () => {
    expect(IMPORT_STEPS.at(-1)?.label).toContain("concluída");
  });
});
