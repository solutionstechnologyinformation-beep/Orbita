import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Bell, Clock3 } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";

const DEFAULT_PREFS = {
  taskAssigned: true,
  taskDue: true,
  phaseChange: true,
  vacationConflict: true,
  systemAlerts: true,
};

const ALERT_DAY_OPTIONS = [1, 3, 7] as const;

type PreferenceKey = keyof typeof DEFAULT_PREFS;

export default function NotificationPreferences() {
  const [prefs, setPrefs] = useState(DEFAULT_PREFS);
  const [deadlineAlertDays, setDeadlineAlertDays] = useState<number>(3);
  const deadlineQ = trpc.notificationPreferences.deadlineAlertDays.useQuery();
  const updateDeadlineMut = trpc.notificationPreferences.updateDeadlineAlertDays.useMutation({
    onSuccess: (data) => {
      setDeadlineAlertDays(data.days);
      toast.success(`Alertas de prazo configurados para ${data.days} dia${data.days === 1 ? "" : "s"}.`);
    },
    onError: (error) => toast.error(error.message),
  });

  useEffect(() => {
    if (deadlineQ.data?.days) setDeadlineAlertDays(deadlineQ.data.days);
  }, [deadlineQ.data?.days]);

  const handleToggle = (key: PreferenceKey) => {
    setPrefs((prev) => ({ ...prev, [key]: !prev[key] }));
    toast.success("Preferência atualizada");
  };

  const items = [
    { key: "taskAssigned" as const, label: "Tarefa atribuída a mim", description: "Notificar quando uma tarefa for atribuída a você" },
    { key: "taskDue" as const, label: "Prazo de tarefa", description: "Notificar quando uma tarefa estiver próxima do prazo" },
    { key: "phaseChange" as const, label: "Mudança de fase", description: "Notificar quando uma tarefa mudar de fase" },
    { key: "vacationConflict" as const, label: "Conflito de férias", description: "Notificar quando houver conflito com período de férias" },
    { key: "systemAlerts" as const, label: "Alertas do sistema", description: "Notificações gerais do sistema" },
  ];

  return (
    <div className="container max-w-2xl py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Bell className="h-6 w-6 text-primary" />
          Preferências de Notificação
        </h1>
        <p className="text-muted-foreground mt-1">Configure quais notificações deseja receber e quando deseja ser avisado sobre prazos.</p>
      </div>

      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Tipos de Notificação</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {items.map((item) => (
              <div key={item.key} className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label className="text-sm font-medium">{item.label}</Label>
                  <p className="text-xs text-muted-foreground">{item.description}</p>
                </div>
                <Switch checked={prefs[item.key]} onCheckedChange={() => handleToggle(item.key)} />
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base"><Clock3 className="h-4 w-4 text-primary" />Antecedência dos alertas de prazo</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="mb-3 text-sm text-muted-foreground">Escolha com quantos dias de antecedência o Orbita deve procurar tarefas próximas do vencimento e emitir alertas.</p>
            <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Antecedência dos alertas de prazo">
              {ALERT_DAY_OPTIONS.map((days) => (
                <button
                  key={days}
                  type="button"
                  role="radio"
                  aria-checked={deadlineAlertDays === days}
                  disabled={deadlineQ.isLoading || updateDeadlineMut.isPending}
                  onClick={() => updateDeadlineMut.mutate({ days })}
                  className={`rounded-lg border px-3 py-2 text-sm font-semibold transition-colors ${deadlineAlertDays === days ? "border-primary bg-primary text-primary-foreground" : "border-border bg-background text-foreground hover:bg-muted"}`}
                >
                  {days} dia{days === 1 ? "" : "s"}
                </button>
              ))}
            </div>
            <p className="mt-3 text-xs text-muted-foreground">A configuração é aplicada ao próximo ciclo automático de verificação do Dashboard.</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
