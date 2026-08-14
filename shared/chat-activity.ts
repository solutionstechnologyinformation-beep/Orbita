export type ChatActivityDiscipline = {
  discipline: string;
  memberCount: number;
  onlineCount: number;
  typingCount: number;
  messagesLast24h: number;
  messagesLast7d: number;
  activeConversationsLast24h: number;
  unreadCount: number;
  lastActivityAt: Date | string | null;
};

export type ChatActivityMetric = "onlineCount" | "messagesLast24h" | "typingCount";

export const CHAT_ACTIVITY_METRICS: Array<{ key: ChatActivityMetric; label: string }> = [
  { key: "onlineCount", label: "Online agora" },
  { key: "messagesLast24h", label: "Mensagens em 24h" },
  { key: "typingCount", label: "Digitando agora" },
];

export type ChatActivityChartDatum = {
  discipline: string;
  value: number;
  unreadCount: number;
};

export function formatUnreadBadgeLabel(unreadCount: number): string {
  const count = Number(unreadCount ?? 0);
  return count > 0 ? `● ${count}` : "";
}

export function buildChatActivityChartData(rows: ChatActivityDiscipline[], metric: ChatActivityMetric): ChatActivityChartDatum[] {
  return rows
    .map((row) => ({ discipline: row.discipline, value: Number(row[metric] ?? 0), unreadCount: Number(row.unreadCount ?? 0) }))
    .sort((a, b) => b.value - a.value || a.discipline.localeCompare(b.discipline, "pt-BR"));
}

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
    unreadCount: Number(row.unreadCount ?? 0),
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
      unreadCount: acc.unreadCount + row.unreadCount,
    }), { memberCount: 0, onlineCount: 0, typingCount: 0, messagesLast24h: 0, messagesLast7d: 0, activeConversationsLast24h: 0, unreadCount: 0 }),
  };
}
