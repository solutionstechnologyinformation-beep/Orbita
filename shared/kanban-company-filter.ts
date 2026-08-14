export function getKanbanCompanyOptions(tasks: Array<{ assigneeCompany?: string | null }>) {
  return Array.from(new Set(tasks.map((task) => task.assigneeCompany).filter((company): company is string => Boolean(company))))
    .sort((a, b) => a.localeCompare(b, "pt-BR"));
}

export function matchesKanbanCompanyFilter(task: { assigneeCompany?: string | null }, company: string) {
  return company === "all" || task.assigneeCompany === company;
}
