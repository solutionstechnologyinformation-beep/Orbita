import { describe, expect, it } from "vitest";
import { summarizeProjectReportByName } from "./project-report-summary";

describe("Project Report Summary by Voice", () => {
  it("generates a structured report summary or falls back safely when project is not found", async () => {
    const summary = await summarizeProjectReportByName("Projeto Inexistente 9999");
    expect(typeof summary).toBe("string");
    expect(summary.length).toBeGreaterThan(10);
  }, 30000);
});
