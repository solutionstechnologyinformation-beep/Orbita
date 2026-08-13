import crypto from "crypto";

const STATE_TTL_MS = 10 * 60 * 1000;

type GoogleOAuthState = {
  userId: number;
  issuedAt: number;
  nonce: string;
};

function getStateSecret() {
  return process.env.JWT_SECRET || "orbita-google-oauth-state";
}

function sign(payload: string) {
  return crypto.createHmac("sha256", getStateSecret()).update(payload).digest("base64url");
}

export function createGoogleOAuthState(userId: number) {
  const state: GoogleOAuthState = { userId, issuedAt: Date.now(), nonce: crypto.randomBytes(16).toString("hex") };
  const payload = Buffer.from(JSON.stringify(state)).toString("base64url");
  return `${payload}.${sign(payload)}`;
}

export function verifyGoogleOAuthState(value: string | undefined) {
  if (!value) throw new Error("Parâmetro state OAuth ausente.");
  const [payload, signature] = value.split(".");
  if (!payload || !signature) throw new Error("Parâmetro state OAuth inválido.");
  const expected = sign(payload);
  const providedBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);
  if (providedBuffer.length !== expectedBuffer.length || !crypto.timingSafeEqual(providedBuffer, expectedBuffer)) {
    throw new Error("Assinatura do state OAuth inválida.");
  }
  const state = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as GoogleOAuthState;
  if (!Number.isInteger(state.userId) || Date.now() - state.issuedAt > STATE_TTL_MS) {
    throw new Error("State OAuth expirado.");
  }
  return state;
}
