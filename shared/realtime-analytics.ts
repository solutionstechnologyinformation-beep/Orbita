export interface RealtimeAnalyticsSummary {
  totalProjects: number;
  activeTasks: number;
  completedTasks: number;
  globalCompletionRate: number;
  activeUsers: number;
  openAlerts: number;
  systemHealthScore: number;
}

export function computeRealtimeAnalytics(tasks: any[], users: any[], projects: any[]): RealtimeAnalyticsSummary {
  const totalProjects = projects.length;
  const activeTasks = tasks.filter((t: any) => t.status !== "done" && t.status !== "archived").length;
  const completedTasks = tasks.filter((t: any) => t.status === "done" || t.status === "published").length;
  const totalTasks = tasks.length;
  const globalCompletionRate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
  const activeUsers = users.length;
  const openAlerts = tasks.filter((t: any) => t.status === "blocked" || (t.dueDate && new Date(t.dueDate).getTime() < Date.now() && t.status !== "done")).length;
  const systemHealthScore = Math.max(70, Math.min(100, 100 - openAlerts * 3 + Math.round(globalCompletionRate * 0.1)));

  return {
    totalProjects,
    activeTasks,
    completedTasks,
    globalCompletionRate,
    activeUsers,
    openAlerts,
    systemHealthScore,
  };
}
