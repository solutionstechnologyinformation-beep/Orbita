export const REPORT_PALETTE = {
  navy: "#0f172a",
  navyBlue: "#0f3b5f",
  yellow: "#ffbe00",
  yellowSoft: "#ffdc78",
  ink: "#111827",
  green: "#16a34a",
  red: "#dc2626",
  border: "#dbe3ea",
  surface: "#ffffff",
} as const;

export function getReportRateColor(rate: number): string {
  if (rate >= 80) return REPORT_PALETTE.green;
  if (rate >= 50) return REPORT_PALETTE.yellow;
  return REPORT_PALETTE.red;
}
