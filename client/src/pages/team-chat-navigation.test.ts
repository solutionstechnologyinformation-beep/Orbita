import { describe, expect, it } from "vitest";
import {
  buildTeamChatDisciplineUrl,
  filterDirectConversationsByDiscipline,
  filterUsersByDiscipline,
  userBelongsToDiscipline,
} from "./team-chat-navigation";

describe("team chat discipline navigation", () => {
  const users = [
    { id: 1, disciplines: ["Pavimentação", "Drenagem"] },
    { id: 2, disciplines: ["Topografia"] },
    { id: 3, disciplines: [] },
  ];

  it("builds an encoded TeamChat URL from the selected discipline", () => {
    expect(buildTeamChatDisciplineUrl(" Projeto Geométrico ")).toBe("/team-chat?discipline=Projeto%20Geom%C3%A9trico");
    expect(buildTeamChatDisciplineUrl(" ")).toBe("/team-chat");
  });

  it("matches disciplines without case or surrounding whitespace differences", () => {
    expect(userBelongsToDiscipline(users[0], " pavimentação ")).toBe(true);
    expect(userBelongsToDiscipline(users[1], "Pavimentação")).toBe(false);
    expect(filterUsersByDiscipline(users, "Topografia").map((user) => user.id)).toEqual([2]);
    expect(filterUsersByDiscipline(users, "")).toEqual(users);
  });

  it("filters direct conversations using the other participant's discipline", () => {
    const conversations = [{ id: 101, otherUserId: 1 }, { id: 102, otherUserId: 2 }, { id: 103, otherUserId: 999 }];
    expect(filterDirectConversationsByDiscipline(conversations, users, "Drenagem").map((conversation) => conversation.id)).toEqual([101]);
    expect(filterDirectConversationsByDiscipline(conversations, users, "")).toEqual(conversations);
  });
});
