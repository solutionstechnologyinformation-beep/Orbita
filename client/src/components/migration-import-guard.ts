export type PendingMigrationImport = {
  fileName: string;
  content: string;
  version: string;
  recordGroups: number;
};

export function prepareMigrationImport(fileName: string, content: string): PendingMigrationImport {
  if (!content.trim()) throw new Error("O arquivo está vazio.");
  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch {
    throw new Error("O arquivo não contém um JSON válido.");
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("O JSON precisa conter um objeto de migração.");
  const payload = parsed as { data?: unknown; version?: unknown };
  if (!payload.data || typeof payload.data !== "object" || Array.isArray(payload.data)) throw new Error("O arquivo não possui a estrutura de migração esperada.");
  const recordGroups = Object.values(payload.data as Record<string, unknown>).filter(Array.isArray).length;
  return { fileName, content, version: typeof payload.version === "string" ? payload.version : "desconhecida", recordGroups };
}

export function getMigrationImportWarning(pending: PendingMigrationImport): string {
  return `A importação de ${pending.fileName} (versão ${pending.version}) gravará dados no ambiente atual. Revise a origem do arquivo antes de continuar.`;
}
