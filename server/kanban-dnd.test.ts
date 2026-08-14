import { describe, expect, it } from "vitest";
import { getKanbanPhaseDropId, parseKanbanPhaseDropId } from "../shared/kanban-dnd";

describe("kanban dnd helpers", () => {
  it("creates and parses a phase drop target", () => {
    const dropId = getKanbanPhaseDropId(42);
    expect(dropId).toBe("phase-42");
    expect(parseKanbanPhaseDropId(dropId)).toBe(42);
  });

  it("rejects task IDs and malformed phase IDs", () => {
    expect(parseKanbanPhaseDropId("task-42")).toBeNull();
    expect(parseKanbanPhaseDropId("phase-0")).toBeNull();
    expect(parseKanbanPhaseDropId("phase-not-a-number")).toBeNull();
    expect(parseKanbanPhaseDropId(42)).toBeNull();
  });
});
