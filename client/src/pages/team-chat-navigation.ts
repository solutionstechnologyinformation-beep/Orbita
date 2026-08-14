export type DisciplineAwareUser = {
  id: number;
  disciplines?: string[] | null;
};

export type DirectConversation = {
  otherUserId?: number | null;
};

function normalizeDiscipline(value: string): string {
  return value.trim().toLocaleLowerCase("pt-BR");
}

export function buildTeamChatDisciplineUrl(discipline: string): string {
  const normalized = discipline.trim();
  return normalized ? `/team-chat?discipline=${encodeURIComponent(normalized)}` : "/team-chat";
}

export function userBelongsToDiscipline(user: DisciplineAwareUser | null | undefined, discipline: string): boolean {
  const target = normalizeDiscipline(discipline);
  if (!target) return true;
  return (user?.disciplines ?? []).some((name) => normalizeDiscipline(name) === target);
}

export function filterUsersByDiscipline<T extends DisciplineAwareUser>(users: T[], discipline: string): T[] {
  if (!discipline.trim()) return users;
  return users.filter((user) => userBelongsToDiscipline(user, discipline));
}

export function filterDirectConversationsByDiscipline<T extends DirectConversation>(
  conversations: T[],
  users: DisciplineAwareUser[],
  discipline: string,
): T[] {
  if (!discipline.trim()) return conversations;
  const usersById = new Map(users.map((user) => [user.id, user]));
  return conversations.filter((conversation) => userBelongsToDiscipline(usersById.get(Number(conversation.otherUserId)), discipline));
}
