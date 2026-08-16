export type OrbitaReportHeaderOptions = {
  title: string;
  subtitle?: string;
  meta?: string;
  logoUrl?: string;
};

export const ORBITA_REPORT_HEADER_COLORS = {
  gold: "#e0b946",
  ink: "#4b5563",
  navy: "#172c45",
  muted: "#64748b",
  border: "#dce4ee",
} as const;

export const ORBITA_REPORT_HEADER_CSS = `
  .orbita-report-header{display:flex;align-items:center;justify-content:space-between;gap:22px;margin-bottom:24px;padding:18px 18px 20px;border:1px solid #dce4ee;border-radius:16px;background:linear-gradient(135deg,#fff 0%,#fbfcfe 100%);box-shadow:0 8px 22px rgba(15,23,42,.06)}
  .orbita-report-brand{display:flex;align-items:center;gap:16px;min-width:0}
  .orbita-report-logo{width:58px;height:58px;flex:0 0 58px;object-fit:contain}
  .orbita-report-eyebrow{margin:0 0 6px;color:#e0b946;font-size:11px;font-weight:800;letter-spacing:.18em;line-height:1.2;text-transform:uppercase}
  .orbita-report-title{margin:0;color:#4b5563;font-size:28px;font-weight:800;letter-spacing:-.025em;line-height:1.12}
  .orbita-report-meta{color:#64748b;font-size:11px;line-height:1.55;text-align:right;white-space:pre-line}
  .orbita-report-meta strong{color:#172c45;font-size:12px}
  @media print{.orbita-report-header{box-shadow:none;break-inside:avoid}}
  @media (max-width:720px){.orbita-report-header{align-items:flex-start;flex-direction:column;gap:12px}.orbita-report-meta{text-align:left}.orbita-report-title{font-size:23px}}
`;

function escapeReportHtml(value: string | number) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function buildOrbitaReportHeaderHtml(options: OrbitaReportHeaderOptions) {
  const logoUrl = options.logoUrl ?? "/manus-storage/orbita-logo-transparent-clean_79119bcb.png";
  const meta = options.meta ? `<div class="orbita-report-meta">${escapeReportHtml(options.meta)}</div>` : "";
  const subtitle = options.subtitle ? `<div>${escapeReportHtml(options.subtitle)}</div>` : "";

  return `<header class="orbita-report-header">
    <div class="orbita-report-brand">
      <img class="orbita-report-logo" src="${escapeReportHtml(logoUrl)}" alt="Logo Órbita" />
      <div>
        <p class="orbita-report-eyebrow">ÓRBITA · PLANEJAMENTO VISUAL</p>
        <h1 class="orbita-report-title">${escapeReportHtml(options.title)}</h1>
        ${subtitle}
      </div>
    </div>
    ${meta}
  </header>`;
}
