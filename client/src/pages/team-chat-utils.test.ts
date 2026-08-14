import { describe, expect, it } from "vitest";
import { formatTypingLabel, getChatPollInterval } from "./team-chat-utils";

describe("team chat helpers", () => {
  it("uses a faster interval while the page is visible", () => {
    expect(getChatPollInterval(true)).toBe(2000);
    expect(getChatPollInterval(false)).toBe(10000);
  });

  it("formats typing feedback for one or multiple members", () => {
    expect(formatTypingLabel([])).toBeNull();
    expect(formatTypingLabel([{ name: "Ana" }])).toBe("Ana está digitando...");
    expect(formatTypingLabel([{ name: "Ana" }, { name: "Bruno" }, { name: "Carla" }])).toBe("Ana e Bruno estão digitando...");
    expect(formatTypingLabel([{ name: " " }])).toBe("Alguém está digitando...");
  });
});
