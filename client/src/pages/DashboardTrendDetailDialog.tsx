import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { DashboardSparkline } from "./DashboardSparkline";
import { DashboardTrendDetailChart } from "./DashboardTrendDetailChart";

type DashboardTrendDetailDialogProps = {
  data: number[];
  labels?: string[];
  label: string;
  period: string;
  color: string;
  valueSuffix: string;
};

export function DashboardTrendDetailDialog({
  data,
  labels = [],
  label,
  period,
  color,
  valueSuffix,
}: DashboardTrendDetailDialogProps) {
  if (data.length < 2) return null;

  const latest = data[data.length - 1];
  const previous = data[data.length - 2];
  const minimum = Math.min(...data);
  const maximum = Math.max(...data);

  return (
    <Dialog>
      <DialogTrigger asChild>
        <button
          type="button"
          className="dashboard-trend-sparkline-trigger mt-2 block w-full rounded-md text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ffc30d] focus-visible:ring-offset-2"
          aria-label={`Abrir gráfico detalhado de ${label}`}
        >
          <span className="sr-only">Abrir gráfico detalhado de {label}</span>
          <DashboardSparkline data={data} color={color} className="mx-auto" />
        </button>
      </DialogTrigger>
      <DialogContent className="max-w-3xl border-[var(--border)] bg-[var(--background)] text-[var(--foreground)]">
        <DialogHeader>
          <DialogTitle>Histórico de {label}</DialogTitle>
          <DialogDescription>
            Evolução da série no período selecionado: {period}. Passe o mouse ou use Tab nos pontos para consultar os valores.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-5">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4" aria-label={`Resumo da série histórica de ${label}`}>
            <div className="rounded-lg border border-[var(--border)] bg-[var(--card)] p-3">
              <span className="block text-[11px] text-[var(--muted-foreground)]">Atual</span>
              <strong className="mt-1 block text-lg">{latest}{valueSuffix}</strong>
            </div>
            <div className="rounded-lg border border-[var(--border)] bg-[var(--card)] p-3">
              <span className="block text-[11px] text-[var(--muted-foreground)]">Anterior</span>
              <strong className="mt-1 block text-lg">{previous}{valueSuffix}</strong>
            </div>
            <div className="rounded-lg border border-[var(--border)] bg-[var(--card)] p-3">
              <span className="block text-[11px] text-[var(--muted-foreground)]">Mínimo</span>
              <strong className="mt-1 block text-lg">{minimum}{valueSuffix}</strong>
            </div>
            <div className="rounded-lg border border-[var(--border)] bg-[var(--card)] p-3">
              <span className="block text-[11px] text-[var(--muted-foreground)]">Máximo</span>
              <strong className="mt-1 block text-lg">{maximum}{valueSuffix}</strong>
            </div>
          </div>
          <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-3 sm:p-5">
            <DashboardTrendDetailChart data={data} labels={labels} color={color} valueSuffix={valueSuffix} label={label} />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
