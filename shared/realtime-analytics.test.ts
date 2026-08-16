import { describe, expect, it } from "vitest";
import { computeRealtimeAnalytics } from "./realtime-analytics";

describe("RealtimeAnalytics", () => {
  it("calcula corretamente as métricas e taxas de conclusão", () => {
    const tasks = [
      { id: 1, status: "done" },
      { id: 2, status: "in_progress" },
      { id: 3, status: "blocked" },
    ];
    const users = [{ id: 1 }, { id: 2 }];
    const projects = [{ id: 1 }, { id: 2 }];

    const summary = computeRealtimeAnalytics(tasks, users, projects);

    expect(summary.totalProjects).toBe(2);
    expect(summary.activeTasks).toBe(2);
    expect(summary.completedTasks).toBe(1);
    expect(summary.globalCompletionRate).toBe(33);
    expect(summary.activeUsers).toBe(2);
    expect(summary.openAlerts).toBe(1);
    expect(summary.systemHealthScore).toBeGreaterThanOrEqual(70);
  });
});
