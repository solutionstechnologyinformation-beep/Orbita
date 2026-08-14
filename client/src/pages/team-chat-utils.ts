export function getChatPollInterval(isPageVisible: boolean): number {
  return isPageVisible ? 2000 : 10000;
}

export function formatTypingLabel(users: Array<{ name?: string | null }>): string | null {
  if (users.length === 0) return null;
  const names = users.slice(0, 2).map((user) => user.name?.trim() || "Alguém");
  if (names.length === 1) return `${names[0]} está digitando...`;
  return `${names.join(" e ")} estão digitando...`;
}
