import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { getDb, getGoogleCalendarToken, saveGoogleCalendarToken, deleteGoogleCalendarToken } from "./db";
import { extractMeetingCode } from "./google-calendar";

describe("Google Calendar", () => {
  const testUserId = 999;
  const testToken = {
    accessToken: "test_access_token_123",
    refreshToken: "test_refresh_token_456",
    expiresAt: new Date(Date.now() + 3600000),
  };

  beforeAll(async () => {
    // Clean up any existing test data
    try {
      await deleteGoogleCalendarToken(testUserId);
    } catch (e) {
      // Ignore if doesn't exist
    }
  });

  afterAll(async () => {
    // Clean up test data
    try {
      await deleteGoogleCalendarToken(testUserId);
    } catch (e) {
      // Ignore
    }
  });

  it("should save Google Calendar token", async () => {
    await saveGoogleCalendarToken(testUserId, testToken);
    const saved = await getGoogleCalendarToken(testUserId);
    expect(saved).toBeDefined();
    expect(saved?.accessToken).toBe(testToken.accessToken);
    expect(saved?.refreshToken).toBe(testToken.refreshToken);
  });

  it("should update existing Google Calendar token", async () => {
    const newToken = {
      accessToken: "new_access_token_789",
      refreshToken: "new_refresh_token_012",
      expiresAt: new Date(Date.now() + 7200000),
    };
    await saveGoogleCalendarToken(testUserId, newToken);
    const updated = await getGoogleCalendarToken(testUserId);
    expect(updated?.accessToken).toBe(newToken.accessToken);
  });

  it("should delete Google Calendar token", async () => {
    await deleteGoogleCalendarToken(testUserId);
    const deleted = await getGoogleCalendarToken(testUserId);
    expect(deleted).toBeUndefined();
  });

  it("should return undefined for non-existent token", async () => {
    const nonExistent = await getGoogleCalendarToken(99999);
    expect(nonExistent).toBeUndefined();
  });

  it("should extract the Google Meet code from a meeting URL", () => {
    expect(extractMeetingCode("https://meet.google.com/abc-mnop-xyz")).toBe("abc-mnop-xyz");
  });

  it("should return undefined for an invalid Meet URL", () => {
    expect(extractMeetingCode("https://example.com/reuniao")).toBeUndefined();
  });
});
