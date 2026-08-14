import { describe, expect, it } from "vitest";
import { filterKanbanCrsByClient, getKanbanClientOptions } from "../shared/kanban-client-filter";

describe("kanban client filter", () => {
  const crs = [
    { id: 1, clientId: 20, clientName: "Zeta", clientColor: "#111111" },
    { id: 2, clientId: 10, clientName: "Alfa", clientColor: "#222222" },
    { id: 3, clientId: 20, clientName: "Zeta", clientColor: "#111111" },
    { id: 4, clientId: null, clientName: null, clientColor: null },
  ];

  it("returns unique clients ordered by name", () => {
    expect(getKanbanClientOptions(crs)).toEqual([
      { id: 10, name: "Alfa", color: "#222222" },
      { id: 20, name: "Zeta", color: "#111111" },
    ]);
  });

  it("filters contracts by client and preserves all contracts for all", () => {
    expect(filterKanbanCrsByClient(crs, "20").map((item) => item.id)).toEqual([1, 3]);
    expect(filterKanbanCrsByClient(crs, "all")).toEqual(crs);
  });
});
