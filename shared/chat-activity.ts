export type ChatActivityDiscipline = {
  discipline: string;
  memberCount: number;
  onlineCount: number;
  typingCount: number;
  messagesLast24h: number;
  messagesLast7d: number;
  activeConversationsLast24h: number;
  lastActivityAt: Date | string | null;
};

export type ChatActivitySnapshot = {
  generatedAt: Date;
  disciplines: ChatActivityDiscipline[];
  totals: Omit<ChatActivityDiscipline, "discipline" | "lastActivityAt">;
};

export function normalizeChatActivitySnapshot(rows: Array<Partial<ChatActivityDiscipline>>, generatedAt: Date): ChatActivitySnapshot {
  const disciplines = rows.map((row) => ({
    discipline: row.discipline?.trim() || "Sem disciplina",
    memberCount: Number(row.memberCount ?? 0),
    onlineCount: Number(row.onlineCount ?? 0),
    typingCount: Number(row.typingCount ?? 0),
    messagesLast24h: Number(row.messagesLast24h ?? 0),
    messagesLast7d: Number(row.messagesLast7d ?? 0),
    activeConversationsLast24h: Number(row.activeConversationsLast24h ?? 0),
    lastActivityAt: row.lastActivityAt ?? null,
  }));

  return {
    generatedAt,
    disciplines,
    totals: disciplines.reduce((acc, row) => ({
      memberCount: acc.memberCount + row.memberCount,
      onlineCount: acc.onlineCount + row.onlineCount,
      typingCount: acc.typingCount + row.typingCount,
      messagesLast24h: acc.messagesLast24h + row.messagesLast24h,
      messagesLast7d: acc.messagesLast7d + row.messagesLast7d,
      activeConversationsLast24h: acc.activeConversationsLast24h + row.activeConversationsLast24h,
    }), { memberCount: 0, onlineCount: 0, typingCount: 0, messagesLast24h: 0, messagesLast7d: 0, activeConversationsLast24h: 0 }),
  };
}
