import { describe, expect, it } from "vitest";
import { buildChatActivityChartData, formatUnreadBadgeLabel, normalizeChatActivitySnapshot } from "../shared/chat-activity";

describe("chat activity snapshot", () => {
  it("normalizes discipline rows and aggregates totals", () => {
    const generatedAt = new Date("2026-08-14T15:00:00.000Z");
    const snapshot = normalizeChatActivitySnapshot([
      { discipline: " Obras ", memberCount: 4, onlineCount: 2, typingCount: 1, messagesLast24h: 8, messagesLast7d: 18, activeConversationsLast24h: 3, unreadCount: 4, lastActivityAt: generatedAt },
      { discipline: "Projetos", memberCount: 3, onlineCount: 1, typingCount: 0, messagesLast24h: 4, messagesLast7d: 11, activeConversationsLast24h: 2, unreadCount: 1, lastActivityAt: null },
    ], generatedAt);

    expect(snapshot.disciplines[0].discipline).toBe("Obras");
    expect(snapshot.totals).toEqual({
      memberCount: 7,
      onlineCount: 3,
      typingCount: 1,
      messagesLast24h: 12,
      messagesLast7d: 29,
      activeConversationsLast24h: 5,
      unreadCount: 5,
    });
  });

  it("uses the explicit empty-discipline label and zero totals for empty data", () => {
    const snapshot = normalizeChatActivitySnapshot([{ discipline: " ", memberCount: undefined }], new Date("2026-08-14T15:00:00.000Z"));
    expect(snapshot.disciplines[0]).toMatchObject({ discipline: "Sem disciplina", memberCount: 0, onlineCount: 0 });
    expect(snapshot.totals.messagesLast24h).toBe(0);
  });

  it("sorts chart data by the selected metric and breaks ties alphabetically", () => {
    const snapshot = normalizeChatActivitySnapshot([
      { discipline: "Projetos", messagesLast24h: 5, unreadCount: 2 },
      { discipline: "Obras", messagesLast24h: 9, unreadCount: 0 },
      { discipline: "Administração", messagesLast24h: 5, unreadCount: 4 },
    ], new Date("2026-08-14T15:00:00.000Z"));

    expect(buildChatActivityChartData(snapshot.disciplines, "messagesLast24h")).toEqual([
      { discipline: "Obras", value: 9, unreadCount: 0 },
      { discipline: "Administração", value: 5, unreadCount: 4 },
      { discipline: "Projetos", value: 5, unreadCount: 2 },
    ]);
    expect(buildChatActivityChartData([], "onlineCount")).toEqual([]);
    expect(formatUnreadBadgeLabel(3)).toBe("● 3");
    expect(formatUnreadBadgeLabel(0)).toBe("");
  });
});
