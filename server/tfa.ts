import { createHmac, randomBytes } from "crypto";

export function generateTfaSecret(): string {
  const buffer = randomBytes(20);
  const base32Chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  let secret = "";
  let bits = 0;
  let value = 0;
  for (let i = 0; i < buffer.length; i++) {
    value = (value << 8) | buffer[i];
    bits += 8;
    while (bits >= 5) {
      bits -= 5;
      secret += base32Chars[(value >> bits) & 0x1f];
    }
  }
  if (bits > 0) {
    secret += base32Chars[(value << (5 - bits)) & 0x1f];
  }
  return secret;
}

function base32ToBuffer(base32: string): Buffer {
  const base32Chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  const cleaned = base32.replace(/=+$/, "").toUpperCase();
  let bits = 0;
  let value = 0;
  const output: number[] = [];
  for (let i = 0; i < cleaned.length; i++) {
    const idx = base32Chars.indexOf(cleaned[i]);
    if (idx === -1) continue;
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      bits -= 8;
      output.push((value >> bits) & 0xff);
    }
  }
  return Buffer.from(output);
}

export function verifyTotpToken(secret: string, token: string, window = 1): boolean {
  if (!secret || !token || token.length !== 6) return false;
  const epoch = Math.floor(Date.now() / 1000);
  const step = 30;
  const counter = Math.floor(epoch / step);

  try {
    const key = base32ToBuffer(secret);
    for (let i = -window; i <= window; i++) {
      const c = counter + i;
      const buffer = Buffer.alloc(8);
      let temp = c;
      for (let j = 7; j >= 0; j--) {
        buffer[j] = temp & 0xff;
        temp = Math.floor(temp / 256);
      }
      const hmac = createHmac("sha1", key).update(buffer).digest();
      const offset = hmac[hmac.length - 1] & 0xf;
      const binary =
        ((hmac[offset] & 0x7f) << 24) |
        ((hmac[offset + 1] & 0xff) << 16) |
        ((hmac[offset + 2] & 0xff) << 8) |
        (hmac[offset + 3] & 0xff);
      const otp = String(binary % 1000000).padStart(6, "0");
      if (otp === token) return true;
    }
  } catch {
    return false;
  }
  return false;
}

export function generateBackupCodes(count = 8): string[] {
  const codes: string[] = [];
  for (let i = 0; i < count; i++) {
    const part1 = randomBytes(2).toString("hex").toUpperCase();
    const part2 = randomBytes(2).toString("hex").toUpperCase();
    codes.push(`${part1}-${part2}`);
  }
  return codes;
}

export function getTotpOtpAuthUrl(secret: string, email: string, issuer = "Orbita"): string {
  const encodedIssuer = encodeURIComponent(issuer);
  const encodedEmail = encodeURIComponent(email || "admin@orbita.com.br");
  return `otpauth://totp/${encodedIssuer}:${encodedEmail}?secret=${secret}&issuer=${encodedIssuer}&algorithm=SHA1&digits=6&period=30`;
}
