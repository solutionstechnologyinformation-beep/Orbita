export type KanbanReturnContext = {
  crsId?: number | null;
  disciplines?: string[];
  search?: string;
  priority?: string;
  assignee?: string;
  company?: string;
  client?: string;
  scrollTop?: number;
  scrollLeft?: number;
};

const ALL_FILTER_VALUE = "all";

export function buildKanbanUrl(context: KanbanReturnContext = {}): string {
  const params = new URLSearchParams();
  if (context.crsId != null) params.set("crs", String(context.crsId));
  for (const discipline of context.disciplines ?? []) {
    const normalized = discipline.trim();
    if (normalized) params.append("discipline", normalized);
  }
  if (context.search) params.set("search", context.search);
  if (context.priority && context.priority !== ALL_FILTER_VALUE) params.set("priority", context.priority);
  if (context.assignee && context.assignee !== ALL_FILTER_VALUE) params.set("assignee", context.assignee);
  if (context.company && context.company !== ALL_FILTER_VALUE) params.set("company", context.company);
  if (context.client && context.client !== ALL_FILTER_VALUE) params.set("client", context.client);
  if (context.scrollTop != null && Number.isFinite(context.scrollTop) && context.scrollTop > 0) params.set("scrollTop", String(Math.round(context.scrollTop)));
  if (context.scrollLeft != null && Number.isFinite(context.scrollLeft) && context.scrollLeft > 0) params.set("scrollLeft", String(Math.round(context.scrollLeft)));
  const query = params.toString();
  return query ? `/kanban?${query}` : "/kanban";
}

export function buildTaskDetailUrl(taskId: number, returnContext: KanbanReturnContext = {}): string {
  const params = new URLSearchParams({ returnTo: buildKanbanUrl(returnContext) });
  return `/tasks/${taskId}?${params.toString()}`;
}

export function getKanbanReturnUrl(search: string, fallbackCrsId?: number | null): string {
  const params = new URLSearchParams(search);
  const returnTo = params.get("returnTo");
  if (returnTo?.startsWith("/kanban")) return returnTo;
  return buildKanbanUrl({ crsId: fallbackCrsId });
}

function parseScrollParam(value: string | null): number {
  if (!value) return 0;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
}

export function parseKanbanUrlState(search: string) {
  const params = new URLSearchParams(search);
  const rawCrs = params.get("crs");
  const parsedCrs = rawCrs ? Number.parseInt(rawCrs, 10) : null;
  return {
    crsId: parsedCrs != null && Number.isFinite(parsedCrs) ? parsedCrs : null,
    disciplines: params.getAll("discipline").filter(Boolean).slice(0, 2),
    search: params.get("search") ?? "",
    priority: params.get("priority") ?? ALL_FILTER_VALUE,
    assignee: params.get("assignee") ?? ALL_FILTER_VALUE,
    company: params.get("company") ?? ALL_FILTER_VALUE,
    client: params.get("client") ?? ALL_FILTER_VALUE,
    scrollTop: parseScrollParam(params.get("scrollTop")),
    scrollLeft: parseScrollParam(params.get("scrollLeft")),
  };
}
