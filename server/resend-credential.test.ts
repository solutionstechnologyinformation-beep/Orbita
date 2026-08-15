import { describe, expect, it } from "vitest";

const hasResendKey = Boolean(process.env.RESEND_API_KEY);

describe("Resend Email Provider Verification", () => {
  it.skipIf(!hasResendKey)("verifies Resend API key status via the official domains endpoint", async () => {
    const response = await fetch("https://api.resend.com/domains?limit=1", {
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY as string}`,
        "User-Agent": "orbita-2fa/1.0",
      },
    });

    expect(response.status).toBe(200);
  });
});
