import { describe, expect, it } from "vitest";
import { buildTaskSuggestionFallback } from "./task-ai-suggestions";

describe("task AI contextual suggestions", () => {
  it("builds three contextual fallback comments with task data", () => {
    const suggestions = buildTaskSuggestionFallback({ title: "Vistoria BH Shopping", priority: "high" });

    expect(suggestions).toHaveLength(3);
    expect(suggestions[0]).toContain("Vistoria BH Shopping");
    expect(suggestions[1]).toContain("high");
    expect(suggestions.every((item) => item.length > 20)).toBe(true);
  });
});
