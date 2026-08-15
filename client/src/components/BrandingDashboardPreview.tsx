import { BarChart3, CalendarDays, CheckCircle2, CircleGauge, FolderKanban, Moon, Sun, Users } from "lucide-react";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";

export type BrandingPreviewValues = {
  name: string;
  color: string;
  logoUrl: string;
  logoDarkUrl: string;
};

type BrandingDashboardPreviewProps = {
  values: BrandingPreviewValues;
  onReset: () => void;
};

function readableForeground(hex: string) {
  const normalized = hex.replace("#", "");
  if (!/^[0-9a-fA-F]{6}$/.test(normalized)) return "#ffffff";
  const [red, green, blue] = [0, 2, 4].map((offset) => Number.parseInt(normalized.slice(offset, offset + 2), 16));
  const luminance = (0.299 * red + 0.587 * green + 0.114 * blue) / 255;
  return luminance > 0.62 ? "#111827" : "#ffffff";
}

export function BrandingDashboardPreview({ values, onReset }: BrandingDashboardPreviewProps) {
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const primary = /^#[0-9a-fA-F]{6}$/.test(values.color) ? values.color : "#2563eb";
  const foreground = readableForeground(primary);
  const logo = theme === "dark" ? values.logoDarkUrl || values.logoUrl : values.logoUrl || values.logoDarkUrl;
  const palette = useMemo(() => theme === "dark" ? {
    canvas: "#0f172a",
    panel: "#111c31",
    border: "#26354f",
    muted: "#9aa9c1",
    text: "#f8fafc",
    soft: "#17243b",
  } : {
    canvas: "#f8fafc",
    panel: "#ffffff",
    border: "#e2e8f0",
    muted: "#64748b",
    text: "#0f172a",
    soft: "#f1f5f9",
  }, [theme]);

  return (
    <section aria-labelledby="branding-preview-title" className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-950 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 px-5 py-4 text-white">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-emerald-300">Pré-visualização</p>
          <h2 id="branding-preview-title" className="text-lg font-bold">Como o dashboard ficará</h2>
          <p className="mt-1 text-xs text-slate-300">As alterações são temporárias até você salvar o branding.</p>
        </div>
        <div className="flex items-center gap-2" role="group" aria-label="Tema da pré-visualização">
          <Button type="button" size="sm" variant={theme === "light" ? "secondary" : "ghost"} className={theme === "light" ? "text-slate-900" : "text-white hover:bg-white/10 hover:text-white"} aria-pressed={theme === "light"} onClick={() => setTheme("light")}>
            <Sun className="mr-1.5 h-4 w-4" /> Claro
          </Button>
          <Button type="button" size="sm" variant={theme === "dark" ? "secondary" : "ghost"} className={theme === "dark" ? "text-slate-900" : "text-white hover:bg-white/10 hover:text-white"} aria-pressed={theme === "dark"} onClick={() => setTheme("dark")}>
            <Moon className="mr-1.5 h-4 w-4" /> Escuro
          </Button>
        </div>
      </div>

      <div className="p-3 sm:p-5">
        <div className="overflow-hidden rounded-xl border" style={{ backgroundColor: palette.canvas, borderColor: palette.border }}>
          <div className="flex min-h-12 items-center justify-between gap-3 px-4 py-3" style={{ backgroundColor: primary, color: foreground }}>
            <div className="flex min-w-0 items-center gap-2.5">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-white/90 p-1">
                {logo ? <img src={logo} alt={`Logo de pré-visualização de ${values.name || "sua empresa"}`} className="h-full w-full object-contain" /> : <CircleGauge className="h-5 w-5" aria-hidden="true" />}
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-bold">{values.name.trim() || "Nome da empresa"}</p>
                <p className="truncate text-[10px] opacity-75">Espaço de trabalho empresarial</p>
              </div>
            </div>
            <span className="hidden rounded-full bg-black/10 px-2.5 py-1 text-[10px] font-semibold sm:inline-flex">Dashboard</span>
          </div>

          <div className="grid gap-3 p-3 sm:grid-cols-[150px_minmax(0,1fr)] sm:p-4">
            <aside className="hidden space-y-1 rounded-lg p-2 sm:block" style={{ backgroundColor: palette.panel, border: `1px solid ${palette.border}` }} aria-label="Prévia da navegação">
              {[{ icon: CircleGauge, label: "Dashboard", active: true }, { icon: FolderKanban, label: "Projetos" }, { icon: CalendarDays, label: "Agenda" }, { icon: BarChart3, label: "Relatórios" }].map(({ icon: Icon, label, active }) => (
                <div key={label} className="flex items-center gap-2 rounded-md px-2.5 py-2 text-[11px] font-medium" style={{ backgroundColor: active ? `${primary}22` : "transparent", color: active ? primary : palette.muted }}>
                  <Icon className="h-3.5 w-3.5" aria-hidden="true" /> {label}
                </div>
              ))}
            </aside>

            <main className="min-w-0 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-base font-bold" style={{ color: palette.text }}>Visão Geral</p>
                  <p className="text-[10px]" style={{ color: palette.muted }}>Indicadores do período ativo</p>
                </div>
                <span className="rounded-full px-2.5 py-1 text-[10px] font-semibold" style={{ backgroundColor: `${primary}1a`, color: primary }}>Todos os períodos</span>
              </div>

              <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
                {[{ label: "Projetos", value: "24", icon: FolderKanban }, { label: "Tarefas", value: "186", icon: CheckCircle2 }, { label: "No prazo", value: "92%", icon: CircleGauge }, { label: "Equipe", value: "18", icon: Users }].map(({ label, value, icon: Icon }) => (
                  <div key={label} className="rounded-lg border p-3" style={{ backgroundColor: palette.panel, borderColor: palette.border }}>
                    <div className="mb-2 flex items-center justify-between"><Icon className="h-3.5 w-3.5" style={{ color: primary }} aria-hidden="true" /><span className="text-sm font-black" style={{ color: palette.text }}>{value}</span></div>
                    <p className="text-[10px]" style={{ color: palette.muted }}>{label}</p>
                  </div>
                ))}
              </div>

              <div className="grid gap-3 md:grid-cols-[1.35fr_1fr]">
                <div className="rounded-lg border p-3" style={{ backgroundColor: palette.panel, borderColor: palette.border }}>
                  <div className="mb-3 flex items-center justify-between"><p className="text-xs font-bold" style={{ color: palette.text }}>Progresso dos OKRs</p><BarChart3 className="h-3.5 w-3.5" style={{ color: primary }} aria-hidden="true" /></div>
                  <div className="flex h-20 items-end gap-2">
                    {[54, 72, 61, 84, 68, 91, 77].map((height, index) => <div key={index} className="flex-1 rounded-t-sm transition-all" style={{ height: `${height}%`, backgroundColor: primary, opacity: 0.45 + index * 0.07 }} />)}
                  </div>
                </div>
                <div className="rounded-lg border p-3" style={{ backgroundColor: palette.panel, borderColor: palette.border }}>
                  <div className="mb-3 flex items-center justify-between"><p className="text-xs font-bold" style={{ color: palette.text }}>Saúde da operação</p><CircleGauge className="h-3.5 w-3.5" style={{ color: primary }} aria-hidden="true" /></div>
                  <div className="flex items-center gap-3"><div className="h-14 w-14 rounded-full p-1" style={{ background: `conic-gradient(${primary} 0 78%, ${palette.soft} 78% 100%)` }}><div className="flex h-full w-full items-center justify-center rounded-full" style={{ backgroundColor: palette.panel }}><span className="text-xs font-black" style={{ color: palette.text }}>78%</span></div></div><p className="text-[10px] leading-relaxed" style={{ color: palette.muted }}>Objetivos no caminho da meta.</p></div>
                </div>
              </div>
            </main>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-white/10 px-5 py-3 text-xs text-slate-300">
        <span>Preview local: nada foi salvo ainda.</span>
        <Button type="button" size="sm" variant="ghost" className="text-white hover:bg-white/10 hover:text-white" onClick={onReset}>Restaurar valores salvos</Button>
      </div>
    </section>
  );
}

export default BrandingDashboardPreview;
