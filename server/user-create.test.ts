import { describe, expect, it } from "vitest";
import { scryptSync, randomBytes, timingSafeEqual } from "crypto";

describe("secure local user password hashing with scrypt", () => {
  it("derives scrypt key and verifies password match securely", () => {
    const password = "secureCorporatePassword2026!";
    const salt = randomBytes(16).toString("hex");
    const derivedKey = scryptSync(password, salt, 64).toString("hex");
    const passwordHash = `scrypt$${salt}$${derivedKey}`;

    expect(passwordHash.startsWith("scrypt$")).toBe(true);

    const [algo, storedSalt, storedKey] = passwordHash.split("$");
    expect(algo).toEqual("scrypt");

    const testKey = scryptSync(password, storedSalt, 64);
    const storedBuffer = Buffer.from(storedKey, "hex");
    const match = timingSafeEqual(testKey, storedBuffer);
    expect(match).toBe(true);
  });
});
