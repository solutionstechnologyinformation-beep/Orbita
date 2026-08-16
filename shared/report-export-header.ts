export const ORBITA_CSV_BRAND_LINE = "# ÓRBITA · PLANEJAMENTO VISUAL";

export function buildOrbitaCsvPreamble(reportTitle: string, generatedAt: Date = new Date()) {
  return [
    ORBITA_CSV_BRAND_LINE,
    `# ${reportTitle}`,
    `# Gerado em: ${generatedAt.toLocaleString("pt-BR")}`,
    "",
  ].join("\r\n");
}
