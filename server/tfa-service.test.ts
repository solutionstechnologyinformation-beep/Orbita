import { describe, expect, it } from "vitest";
import { hashTfaCode, isValidTfaCode, maskEmail, tfaLimits } from "./tfa-service";

describe("Email 2FA service", () => {
  it("masks the administrator email before displaying it", () => {
    expect(maskEmail("admin@orbita.com.br")).toBe("ad•••@orbita.com.br");
    expect(maskEmail("a@orbita.com.br")).toBe("a•@orbita.com.br");
  });

  it("accepts only six numeric digits", () => {
    expect(isValidTfaCode("123456")).toBe(true);
    expect(isValidTfaCode("12345")).toBe(false);
    expect(isValidTfaCode("12345a")).toBe(false);
  });

  it("hashes codes deterministically without storing the plaintext", () => {
    const hash = hashTfaCode("123456");
    expect(hash).toHaveLength(64);
    expect(hash).toBe(hashTfaCode("123456"));
    expect(hash).not.toBe("123456");
    expect(hashTfaCode("123457")).not.toBe(hash);
  });

  it("exposes conservative expiration and abuse limits", () => {
    expect(tfaLimits.codeTtlMs).toBe(10 * 60 * 1000);
    expect(tfaLimits.resendCooldownMs).toBe(60 * 1000);
    expect(tfaLimits.maxVerifyAttempts).toBe(5);
  });
});
