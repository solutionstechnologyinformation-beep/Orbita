export type DashboardWidgetGroup = "generalLeft" | "generalRight" | "detailTop" | "detailBottom";
export type DashboardWidgetId = string;
export type DashboardWidgetOrders = Record<DashboardWidgetGroup, DashboardWidgetId[]>;

export const DEFAULT_DASHBOARD_WIDGET_ORDERS: DashboardWidgetOrders = {
  generalLeft: ["map", "stats", "deadlines"],
  generalRight: ["primary-kpis", "secondary-kpis", "distribution", "chat", "burndown", "contracts-state", "sla"],
  detailTop: ["activity-status", "work-type", "client-progress"],
  detailBottom: ["chat-detail", "my-tasks", "active-projects"],
};

export function getDashboardWidgetStorageKey(userId: number | string | undefined) {
  return `orbita.dashboard.widgets.${userId ?? "guest"}`;
}

export function readDashboardWidgetOrders(userId: number | string | undefined, storage?: Pick<Storage, "getItem">): DashboardWidgetOrders {
  const activeStorage = storage ?? (typeof window !== "undefined" ? window.localStorage : undefined);
  if (!activeStorage) return DEFAULT_DASHBOARD_WIDGET_ORDERS;
  try {
    const parsed = JSON.parse(activeStorage.getItem(getDashboardWidgetStorageKey(userId)) ?? "null");
    if (!parsed || typeof parsed !== "object") return DEFAULT_DASHBOARD_WIDGET_ORDERS;
    return Object.fromEntries(Object.entries(DEFAULT_DASHBOARD_WIDGET_ORDERS).map(([group, defaults]) => {
      const saved = Array.isArray(parsed[group]) ? parsed[group].filter((id: unknown) => defaults.includes(String(id))) : [];
      return [group, [...saved, ...defaults.filter((id) => !saved.includes(id))]];
    })) as DashboardWidgetOrders;
  } catch {
    return DEFAULT_DASHBOARD_WIDGET_ORDERS;
  }
}

export function moveDashboardWidget(order: DashboardWidgetId[], sourceId: DashboardWidgetId, targetId: DashboardWidgetId) {
  const sourceIndex = order.indexOf(sourceId);
  const targetIndex = order.indexOf(targetId);
  if (sourceIndex < 0 || targetIndex < 0 || sourceIndex === targetIndex) return order;
  const next = [...order];
  const [moved] = next.splice(sourceIndex, 1);
  next.splice(targetIndex, 0, moved);
  return next;
}
