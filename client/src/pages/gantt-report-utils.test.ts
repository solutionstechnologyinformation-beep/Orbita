import { describe, expect, it } from "vitest";
import { buildVisualGanttReportHtml, type GanttReportRow } from "./gantt-report-utils";

const rows: GanttReportRow[] = [
  { kind: "group", key: "execucao", label: "Execução" },
  { kind: "task", key: "task-1", label: "Planejar <trecho>", index: 1, task: {
    id: 1,
    title: "Planejar <trecho>",
    startDate: "2026-08-01",
    endDate: "2026-08-10",
    assigneeName: "Ana",
    color: "#2f80ed",
    progress: 60,
  } },
  { kind: "task", key: "task-2", label: "Validar entrega", index: 2, task: {
    id: 2,
    title: "Validar entrega",
    startDate: "2026-08-12",
    endDate: "2026-08-12",
    assigneeName: "Bruno",
    color: "#35b779",
    predecessorId: 1,
    milestone: true,
  } },
];

describe("visual Gantt report", () => {
  it("renders temporal headers, task bars, legend and milestone", () => {
    const html = buildVisualGanttReportHtml({
      title: "Gantt de Agosto",
      generatedAt: new Date("2026-08-16T12:00:00Z"),
      rows,
      rangeStart: new Date("2026-08-01"),
      rangeEnd: new Date("2026-10-01"),
    });

    expect(html).toContain("Gantt de Agosto");
    expect(html).toContain("class=\"periods\"");
    expect(html).toContain("class=\"months\"");
    expect(html).toContain("class=\"task-bar\"");
    expect(html).toContain("class=\"milestone\"");
    expect(html).toContain("class=\"legend-item\"");
    expect(html).toContain("P01");
  });

  it("renders dependencies as dashed SVG paths and escapes task content", () => {
    const html = buildVisualGanttReportHtml({ rows, title: "Relatório" });

    expect(html).toContain("stroke-dasharray");
    expect(html).toContain("marker-end=\"url(#arrow)\"");
    expect(html).toContain("Planejar &lt;trecho&gt;");
    expect(html).not.toContain("<trecho>");
  });
});
