import { Resend } from "resend";
import { formatDateOnly } from "../shared/date-only";
import { getGanttHistoryOperationLabel } from "../shared/gantt-history";

export type GanttDigestEntry = {
  operation: string;
  taskTitle: string | null;
  relatedTaskTitle: string | null;
  changedByName: string | null;
  changedByEmail: string | null;
  beforeData: string | null;
  afterData: string | null;
  createdAt: Date | string;
};

function escapeHtml(value: unknown) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function parseSnapshot(value: string | null) {
  if (!value) return {} as Record<string, unknown>;
  try {
    return JSON.parse(value) as Record<string, unknown>;
  } catch {
    return {} as Record<string, unknown>;
  }
}

export function describeGanttDigestEntry(entry: GanttDigestEntry) {
  const task = entry.taskTitle || "Tarefa sem título";
  const before = parseSnapshot(entry.beforeData);
  const after = parseSnapshot(entry.afterData);
  if (entry.operation === "dates_updated") {
    return `${task}: ${formatDateOnly(before.startDate as Date | string | null)}–${formatDateOnly(before.endDate as Date | string | null)} → ${formatDateOnly(after.startDate as Date | string | null)}–${formatDateOnly(after.endDate as Date | string | null)}`;
  }
  const related = entry.relatedTaskTitle || "tarefa relacionada";
  return `${getGanttHistoryOperationLabel(entry.operation)}: ${task} e ${related}`;
}

export function buildGanttDigestEmailHtml(options: {
  companyName: string;
  windowLabel: string;
  entries: GanttDigestEntry[];
}) {
  const rows = options.entries.map((entry) => `
    <tr>
      <td style="padding:12px 10px;border-bottom:1px solid #e2e8f0;color:#475569;font-size:13px;">${escapeHtml(new Date(entry.createdAt).toLocaleString("pt-BR"))}</td>
      <td style="padding:12px 10px;border-bottom:1px solid #e2e8f0;color:#0f172a;font-size:13px;font-weight:600;">${escapeHtml(getGanttHistoryOperationLabel(entry.operation))}</td>
      <td style="padding:12px 10px;border-bottom:1px solid #e2e8f0;color:#475569;font-size:13px;">${escapeHtml(describeGanttDigestEntry(entry))}</td>
      <td style="padding:12px 10px;border-bottom:1px solid #e2e8f0;color:#64748b;font-size:13px;">${escapeHtml(entry.changedByName || entry.changedByEmail || "Usuário")}</td>
    </tr>`).join("");
  return `<!DOCTYPE html>
<html lang="pt-BR"><head><meta charset="utf-8"><title>Resumo semanal do Gantt</title></head>
<body style="margin:0;padding:32px;background:#f8fafc;color:#0f172a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <main style="max-width:760px;margin:0 auto;background:#fff;border:1px solid #e2e8f0;border-radius:14px;overflow:hidden;">
    <header style="background:#0f172a;padding:24px 28px;color:#fff;"><div style="color:#ffc30d;font-weight:800;letter-spacing:.5px;">ÓRBITA · RESUMO DE CRONOGRAMA</div><h1 style="margin:10px 0 0;font-size:22px;">${escapeHtml(options.companyName)}</h1></header>
    <section style="padding:28px;"><p style="margin:0 0 18px;color:#475569;font-size:14px;">Alterações registradas no período <strong>${escapeHtml(options.windowLabel)}</strong>.</p><div style="display:inline-block;background:#eff6ff;color:#1d4ed8;border-radius:999px;padding:7px 12px;font-size:12px;font-weight:700;margin-bottom:20px;">${options.entries.length} alteração(ões)</div>
      <table style="width:100%;border-collapse:collapse;"><thead><tr><th align="left" style="padding:10px;background:#f8fafc;color:#64748b;font-size:11px;text-transform:uppercase;">Data</th><th align="left" style="padding:10px;background:#f8fafc;color:#64748b;font-size:11px;text-transform:uppercase;">Operação</th><th align="left" style="padding:10px;background:#f8fafc;color:#64748b;font-size:11px;text-transform:uppercase;">Detalhe</th><th align="left" style="padding:10px;background:#f8fafc;color:#64748b;font-size:11px;text-transform:uppercase;">Autor</th></tr></thead><tbody>${rows || '<tr><td colspan="4" style="padding:20px;color:#64748b;text-align:center;">Nenhuma alteração registrada.</td></tr>'}</tbody></table>
    </section>
    <footer style="padding:16px 28px;background:#f1f5f9;border-top:1px solid #e2e8f0;color:#64748b;font-size:12px;text-align:center;">Órbita Platform · Gerenciamento de Projetos e Engenharia Multi-Tenant</footer>
  </main>
</body></html>`;
}

export async function sendGanttDigestEmail(options: {
  recipients: string[];
  companyName: string;
  windowLabel: string;
  entries: GanttDigestEntry[];
}) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return { sent: 0, skipped: options.recipients.length, error: "RESEND_API_KEY missing" };
  const from = process.env.RESEND_FROM_EMAIL || "alerts@lssolutions.com.br";
  const resend = new Resend(apiKey);
  const html = buildGanttDigestEmailHtml(options);
  const results = await Promise.allSettled(options.recipients.map((recipient) => resend.emails.send({
    from,
    to: [recipient],
    subject: `[Órbita] Resumo semanal do Gantt — ${options.companyName}`,
    html,
  })));
  const sent = results.filter((result) => result.status === "fulfilled").length;
  return { sent, skipped: options.recipients.length - sent };
}
