import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { buildOrbitaReportHeaderHtml, ORBITA_REPORT_HEADER_CSS } from "./report-header";

const dashboardSource = readFileSync(new URL("../pages/Dashboard.tsx", import.meta.url), "utf8");
const aiChatSource = readFileSync(new URL("../pages/AIChat.tsx", import.meta.url), "utf8");
const ganttReportSource = readFileSync(new URL("../pages/gantt-report-utils.ts", import.meta.url), "utf8");
const workloadSource = readFileSync(new URL("../components/workload-export.ts", import.meta.url), "utf8");

describe("Orbita report header", () => {
  it("renders the visual hierarchy from the reference", () => {
    const html = buildOrbitaReportHeaderHtml({
      title: "Gantt Chart — Linha do tempo de atividades",
      subtitle: "Relatório operacional",
      meta: "Gerado em 16/08/2026",
    });

    expect(html).toContain("ÓRBITA · PLANEJAMENTO VISUAL");
    expect(html).toContain("Gantt Chart — Linha do tempo de atividades");
    expect(html).toContain("orbita-report-logo");
    expect(html).toContain("orbita-report-meta");
  });

  it("is wired into the main report exporters", () => {
    expect(dashboardSource).toContain("buildOrbitaReportHeaderHtml");
    expect(aiChatSource).toContain("ÓRBITA · PLANEJAMENTO VISUAL");
    expect(ganttReportSource).toContain("buildOrbitaReportHeaderHtml");
    expect(workloadSource).toContain("buildOrbitaReportHeaderHtml");
  });

  it("escapes dynamic values and provides print/mobile rules", () => {
    const html = buildOrbitaReportHeaderHtml({
      title: "Relatório <seguro>",
      subtitle: "A & B",
      meta: "Linha 1\nLinha 2",
      logoUrl: 'https://example.test/logo"x.png',
    });

    expect(html).toContain("Relatório &lt;seguro&gt;");
    expect(html).toContain("A &amp; B");
    expect(html).toContain("logo&quot;x.png");
    expect(ORBITA_REPORT_HEADER_CSS).toContain("@media print");
    expect(ORBITA_REPORT_HEADER_CSS).toContain("@media (max-width:720px)");
  });
});
