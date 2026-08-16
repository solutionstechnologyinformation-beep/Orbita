import { randomBytes, scryptSync, timingSafeEqual } from "crypto";

export function isLocalAuthEnabled() {
  const explicit = process.env.LOCAL_AUTH_ENABLED;
  return explicit ? explicit === "true" : process.env.NODE_ENV !== "production";
}

export function createScryptPasswordHash(password: string) {
  const salt = randomBytes(16).toString("hex");
  return `scrypt$${salt}$${scryptSync(password, salt, 64).toString("hex")}`;
}

export function verifyScryptPassword(password: string, storedHash: string | null | undefined) {
  if (!storedHash) return false;
  const [scheme, salt, expectedHex] = storedHash.split("$");
  if (scheme !== "scrypt" || !salt || !expectedHex) return false;
  const actual = Buffer.from(scryptSync(password, salt, 64).toString("hex"), "utf8");
  const expected = Buffer.from(expectedHex, "utf8");
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export function slugifyCompanyName(name: string) {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 100) || "empresa-orbita";
}
