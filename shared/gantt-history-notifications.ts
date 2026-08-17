export type GanttNotificationMember = { id: number; role?: string | null };

export function selectGanttManagerIds(members: GanttNotificationMember[], changedById: number) {
  const managerRoles = new Set(["admin", "master_admin", "company_admin", "leader"]);
  return Array.from(new Set(
    members
      .filter((member) => member.id !== changedById && managerRoles.has(String(member.role)))
      .map((member) => member.id),
  ));
}
