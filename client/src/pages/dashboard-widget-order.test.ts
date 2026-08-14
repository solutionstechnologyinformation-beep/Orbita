import { describe, expect, it } from "vitest";
import {
  DEFAULT_DASHBOARD_WIDGET_ORDERS,
  getDashboardWidgetStorageKey,
  moveDashboardWidget,
  readDashboardWidgetOrders,
} from "./dashboard-widget-order";

function createMemoryStorage(initial: Record<string, string> = {}) {
  const values = new Map(Object.entries(initial));
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
  };
}

describe("dashboard widget order", () => {
  it("moves a widget before the target without mutating the original order", () => {
    const original = ["map", "stats", "deadlines"];
    const moved = moveDashboardWidget(original, "deadlines", "map");

    expect(moved).toEqual(["deadlines", "map", "stats"]);
    expect(original).toEqual(["map", "stats", "deadlines"]);
  });

  it("keeps the per-user storage key isolated", () => {
    expect(getDashboardWidgetStorageKey(12)).toBe("orbita.dashboard.widgets.12");
    expect(getDashboardWidgetStorageKey(13)).not.toBe(getDashboardWidgetStorageKey(12));
  });

  it("hydrates a saved order, ignores unknown widgets and appends new defaults", () => {
    const storage = createMemoryStorage({
      [getDashboardWidgetStorageKey(12)]: JSON.stringify({
        generalLeft: ["deadlines", "unknown", "map"],
      }),
    });

    const hydrated = readDashboardWidgetOrders(12, storage);
    expect(hydrated.generalLeft).toEqual(["deadlines", "map", "stats"]);
    expect(hydrated.generalRight).toEqual(DEFAULT_DASHBOARD_WIDGET_ORDERS.generalRight);
  });
});
