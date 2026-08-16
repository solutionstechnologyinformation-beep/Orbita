import { Resend } from "resend";
import { ENV } from "./_core/env";

export interface OperationalAlertOptions {
  to: string;
  subject: string;
  title: string;
  message: string;
  severity?: "info" | "warning" | "critical";
  actionUrl?: string;
  actionLabel?: string;
}

export async function sendOperationalAlert(options: OperationalAlertOptions): Promise<{ success: boolean; error?: string }> {
  try {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
      console.warn("[OperationalAlerts] RESEND_API_KEY not configured. Skipping email dispatch.");
      return { success: false, error: "RESEND_API_KEY missing" };
    }

    const resend = new Resend(apiKey);
    const fromEmail = process.env.RESEND_FROM_EMAIL || "alerts@lssolutions.com.br";
    const severityColor = options.severity === "critical" ? "#ef4444" : options.severity === "warning" ? "#f59e0b" : "#3b82f6";

    const htmlContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <title>${options.subject}</title>
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f8fafc; color: #0f172a; margin: 0; padding: 32px;">
          <div style="max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 12px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 4px 12px rgba(15, 23, 42, 0.05);">
            <div style="background-color: #0f172a; padding: 24px; text-align: center;">
              <h1 style="color: #ffc30d; margin: 0; font-size: 20px; font-weight: 800; letter-spacing: 0.5px;">ÓRBITA · ALERTA OPERACIONAL</h1>
            </div>
            <div style="padding: 32px;">
              <div style="display: inline-block; background-color: ${severityColor}; color: #ffffff; font-size: 11px; font-weight: 700; text-transform: uppercase; padding: 4px 10px; border-radius: 9999px; margin-bottom: 16px;">
                ${options.severity || "info"}
              </div>
              <h2 style="margin-top: 0; color: #0f172a; font-size: 18px; font-weight: 700;">${options.title}</h2>
              <p style="color: #475569; font-size: 14px; line-height: 1.6; margin-bottom: 24px;">${options.message}</p>
              ${options.actionUrl && options.actionLabel ? `
                <div style="margin-top: 32px; text-align: center;">
                  <a href="${options.actionUrl}" style="background-color: #3b82f6; color: #ffffff; padding: 12px 24px; border-radius: 8px; font-size: 14px; font-weight: 600; text-decoration: none; display: inline-block;">
                    ${options.actionLabel}
                  </a>
                </div>
              ` : ""}
            </div>
            <div style="background-color: #f1f5f9; padding: 16px 24px; text-align: center; font-size: 12px; color: #64748b; border-top: 1px solid #e2e8f0;">
              Órbita Platform · Gerenciamento de Projetos e Engenharia Multi-Tenant
            </div>
          </div>
        </body>
      </html>
    `;

    const data = await resend.emails.send({
      from: fromEmail,
      to: [options.to],
      subject: `[Órbita Alerta] ${options.subject}`,
      html: htmlContent,
    });

    return { success: true };
  } catch (error: any) {
    console.error("[OperationalAlerts] Failed to send email:", error);
    return { success: false, error: error?.message || "Unknown error" };
  }
}
