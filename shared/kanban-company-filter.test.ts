import { describe, expect, it } from "vitest";
import { getKanbanCompanyOptions, matchesKanbanCompanyFilter } from "./kanban-company-filter";

describe("kanban company filter", () => {
  it("returns unique non-empty companies in locale order", () => {
    expect(getKanbanCompanyOptions([
      { assigneeCompany: "Beta" },
      { assigneeCompany: null },
      { assigneeCompany: "Alfa" },
      { assigneeCompany: "Beta" },
      {},
    ])).toEqual(["Alfa", "Beta"]);
  });

  it("matches all or the selected company only", () => {
    expect(matchesKanbanCompanyFilter({ assigneeCompany: "Alfa" }, "all")).toBe(true);
    expect(matchesKanbanCompanyFilter({ assigneeCompany: "Alfa" }, "Alfa")).toBe(true);
    expect(matchesKanbanCompanyFilter({ assigneeCompany: "Beta" }, "Alfa")).toBe(false);
  });
});
