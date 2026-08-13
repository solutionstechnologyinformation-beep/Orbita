export function isBlockedPhaseName(name: string | null | undefined): boolean {
  return /bloquead/i.test(name ?? "");
}

export function normalizeBlockReason(reason: string | null | undefined): string | null {
  const normalized = reason?.trim() ?? "";
  return normalized.length > 0 ? normalized : null;
}
