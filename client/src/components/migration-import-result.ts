export type ImportResultKind = "success" | "partial" | "failure";

export type ImportResultSummary = {
  kind: ImportResultKind;
  title: string;
  message: string;
};

export function summarizeImportResult(imported: number, ignored: number, errors: number): ImportResultSummary {
  if (errors === 0 && ignored === 0 && imported > 0) {
    return { kind: "success", title: "Importação concluída com sucesso", message: `${imported} registro(s) foram inseridos sem ocorrências.` };
  }
  if (imported > 0 && (ignored > 0 || errors > 0)) {
    return { kind: "partial", title: "Importação concluída parcialmente", message: `${imported} registro(s) inseridos; ${ignored} ignorado(s) e ${errors} com erro.` };
  }
  return { kind: "failure", title: "Importação finalizada com alerta", message: `Nenhum registro foi inserido. ${ignored} ignorado(s) e ${errors} com erro.` };
}
