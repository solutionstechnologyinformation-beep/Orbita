import { createHash, randomInt, timingSafeEqual } from "node:crypto";
import { eq } from "drizzle-orm";
import { getDb } from "./db";
import { users } from "../drizzle/schema";

const CODE_TTL_MS = 10 * 60 * 1000;
const RESEND_COOLDOWN_MS = 60 * 1000;
const MAX_VERIFY_ATTEMPTS = 5;

export function hashTfaCode(code: string) {
  return createHash("sha256").update(code).digest("hex");
}

function codesMatch(expectedHash: string, receivedCode: string) {
  const receivedHash = Buffer.from(hashTfaCode(receivedCode), "hex");
  const expected = Buffer.from(expectedHash, "hex");
  return receivedHash.length === expected.length && timingSafeEqual(receivedHash, expected);
}

export function isValidTfaCode(code: string) {
  return /^\d{6}$/.test(code.trim());
}

function escapeHtml(value: string) {
  return value.replace(/[&<>\"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#039;" })[character] ?? character);
}

export function maskEmail(email: string) {
  const [local, domain] = email.split("@");
  if (!local || !domain) return "e-mail cadastrado";
  const visible = local.length <= 2 ? local.slice(0, 1) : local.slice(0, 2);
  return `${visible}${"•".repeat(Math.max(1, local.length - visible.length))}@${domain}`;
}

export async function generateAndSendEmailTfaCode(userId: number) {
  const db = await getDb();
  const [user] = await db.select({
    id: users.id,
    name: users.name,
    email: users.email,
    tfaCodeLastSentAt: users.tfaCodeLastSentAt,
  }).from(users).where(eq(users.id, userId));

  if (!user) throw new Error("Usuário não encontrado.");
  if (!user.email) throw new Error("O administrador não possui e-mail cadastrado.");

  const now = Date.now();
  if (user.tfaCodeLastSentAt && now - new Date(user.tfaCodeLastSentAt).getTime() < RESEND_COOLDOWN_MS) {
    throw new Error("Aguarde 60 segundos antes de solicitar outro código.");
  }

  const code = randomInt(100000, 1000000).toString();
  const expiresAt = new Date(now + CODE_TTL_MS);
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM_EMAIL;

  if (!apiKey || !from) {
    throw new Error("O envio de e-mail 2FA ainda não está configurado no ambiente.");
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      from,
      to: [user.email],
      subject: "Código de verificação 2FA — Orbita",
      html: `<div style="font-family:Arial,sans-serif;max-width:520px;margin:auto;color:#172033"><h2>Segurança do Orbita</h2><p>Olá ${escapeHtml(user.name ?? "administrador")},</p><p>Use o código abaixo para concluir a configuração da autenticação em dois fatores:</p><p style="font-size:32px;font-weight:700;letter-spacing:8px;color:#2563eb">${code}</p><p>O código expira em 10 minutos e pode ser usado uma única vez.</p><p>Se você não solicitou este código, ignore esta mensagem e revise os acessos da conta.</p></div>`,
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    console.error(`[2FA email] Resend respondeu ${response.status}: ${errorBody.slice(0, 300)}`);
    throw new Error("Não foi possível enviar o código por e-mail. Verifique a configuração do remetente.");
  }

  await db.update(users).set({
    tfaMethod: "email",
    tfaCodeHash: hashTfaCode(code),
    tfaCodeExpiresAt: expiresAt,
    tfaCodeAttempts: 0,
    tfaCodeLastSentAt: new Date(now),
    tfaTempCode: null,
  }).where(eq(users.id, userId));

  return { success: true, expiresAt, maskedEmail: maskEmail(user.email) };
}

export async function verifyEmailTfaCode(userId: number, code: string) {
  const db = await getDb();
  const normalizedCode = code.trim();
  if (!isValidTfaCode(normalizedCode)) return { valid: false, reason: "invalid_format" as const };

  const [user] = await db.select({
    tfaCodeHash: users.tfaCodeHash,
    tfaCodeExpiresAt: users.tfaCodeExpiresAt,
    tfaCodeAttempts: users.tfaCodeAttempts,
  }).from(users).where(eq(users.id, userId));

  if (!user?.tfaCodeHash || !user.tfaCodeExpiresAt) return { valid: false, reason: "missing" as const };

  if (new Date() > new Date(user.tfaCodeExpiresAt)) {
    await db.update(users).set({ tfaCodeHash: null, tfaCodeExpiresAt: null, tfaCodeAttempts: 0 }).where(eq(users.id, userId));
    return { valid: false, reason: "expired" as const };
  }

  if ((user.tfaCodeAttempts ?? 0) >= MAX_VERIFY_ATTEMPTS) {
    await db.update(users).set({ tfaCodeHash: null, tfaCodeExpiresAt: null, tfaCodeAttempts: 0 }).where(eq(users.id, userId));
    return { valid: false, reason: "locked" as const };
  }

  if (!codesMatch(user.tfaCodeHash, normalizedCode)) {
    const nextAttempts = (user.tfaCodeAttempts ?? 0) + 1;
    await db.update(users).set({
      tfaCodeAttempts: nextAttempts,
      ...(nextAttempts >= MAX_VERIFY_ATTEMPTS ? { tfaCodeHash: null, tfaCodeExpiresAt: null } : {}),
    }).where(eq(users.id, userId));
    return { valid: false, reason: nextAttempts >= MAX_VERIFY_ATTEMPTS ? "locked" as const : "incorrect" as const };
  }

  await db.update(users).set({
    tfaEnabled: true,
    tfaMethod: "email",
    tfaCodeHash: null,
    tfaCodeExpiresAt: null,
    tfaCodeAttempts: 0,
    tfaCodeLastSentAt: null,
  }).where(eq(users.id, userId));

  return { valid: true as const };
}

export const tfaLimits = {
  codeTtlMs: CODE_TTL_MS,
  resendCooldownMs: RESEND_COOLDOWN_MS,
  maxVerifyAttempts: MAX_VERIFY_ATTEMPTS,
};
