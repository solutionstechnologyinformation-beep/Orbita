import AppLayout from "@/components/AppLayout";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Bell, BellOff, Settings2, CheckCheck, XCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";

const TYPE_META: Record<string, { label: string; description: string; color: string }> = {
  task_assigned: {
    label: "Tarefa atribuída",
    description: "Quando uma tarefa é atribuída a você.",
    color: "bg-blue-100 text-blue-700 border-blue-200",
  },
  task_status_changed: {
    label: "Mudança de status",
    description: "Quando o status de uma tarefa sua é alterado.",
    color: "bg-indigo-100 text-indigo-700 border-indigo-200",
  },
  task_created: {
    label: "Nova tarefa criada",
    description: "Quando uma nova tarefa é criada em um projeto que você participa.",
    color: "bg-violet-100 text-violet-700 border-violet-200",
  },
  task_deleted: {
    label: "Tarefa excluída",
    description: "Quando uma tarefa atribuída a você é excluída.",
    color: "bg-red-100 text-red-700 border-red-200",
  },
  task_comment: {
    label: "Novo comentário",
    description: "Quando alguém comenta em uma tarefa sua.",
    color: "bg-amber-100 text-amber-700 border-amber-200",
  },
  task_due: {
    label: "Prazo próximo",
    description: "Quando uma tarefa sua vence em menos de 24 horas.",
    color: "bg-orange-100 text-orange-700 border-orange-200",
  },
  project_invite: {
    label: "Convite para projeto",
    description: "Quando você é convidado para colaborar em um projeto.",
    color: "bg-emerald-100 text-emerald-700 border-emerald-200",
  },
  project_update: {
    label: "Atualização de projeto",
    description: "Quando um projeto que você participa é atualizado.",
    color: "bg-teal-100 text-teal-700 border-teal-200",
  },
  system: {
    label: "Mensagens do sistema",
    description: "Notificações gerais e avisos do sistema.",
    color: "bg-gray-100 text-gray-700 border-gray-200",
  },
};

export default function NotificationPreferences() {
  const utils = trpc.useUtils();
  const { data: prefs = [], isLoading } = trpc.notificationPreferences.list.useQuery();

  const updateMutation = trpc.notificationPreferences.update.useMutation({
    onSuccess: () => utils.notificationPreferences.list.invalidate(),
    onError: (e) => toast.error(e.message),
  });

  const updateAllMutation = trpc.notificationPreferences.updateAll.useMutation({
    onSuccess: (_, vars) => {
      utils.notificationPreferences.list.invalidate();
      toast.success(vars.inApp ? "Todas as notificações ativadas." : "Todas as notificações desativadas.");
    },
    onError: (e) => toast.error(e.message),
  });

  const handleToggle = (notificationType: string, inApp: boolean) => {
    updateMutation.mutate({ notificationType, inApp });
  };

  const allEnabled = prefs.every((p) => p.inApp);
  const allDisabled = prefs.every((p) => !p.inApp);

  return (
    <AppLayout title="Preferências de Notificação" backHref="/notifications">
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Header Card */}
        <Card className="border border-border shadow-sm">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Settings2 className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <CardTitle className="text-base">Preferências de Notificação</CardTitle>
                  <CardDescription className="text-xs mt-0.5">
                    Controle quais notificações você recebe dentro do sistema.
                  </CardDescription>
                </div>
              </div>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-1.5 text-xs h-8"
                  disabled={allEnabled || updateAllMutation.isPending}
                  onClick={() => updateAllMutation.mutate({ inApp: true })}
                >
                  <CheckCheck className="w-3.5 h-3.5" />
                  Ativar todas
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-1.5 text-xs h-8"
                  disabled={allDisabled || updateAllMutation.isPending}
                  onClick={() => updateAllMutation.mutate({ inApp: false })}
                >
                  <XCircle className="w-3.5 h-3.5" />
                  Desativar todas
                </Button>
              </div>
            </div>
          </CardHeader>
        </Card>

        {/* Preferences List */}
        <Card className="border border-border shadow-sm">
          <CardContent className="p-0 divide-y divide-border">
            {isLoading
              ? Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="flex items-center justify-between px-5 py-4">
                    <div className="space-y-1.5 flex-1">
                      <Skeleton className="h-4 w-40" />
                      <Skeleton className="h-3 w-64" />
                    </div>
                    <Skeleton className="h-6 w-11 rounded-full" />
                  </div>
                ))
              : prefs.map((pref) => {
                  const meta = TYPE_META[pref.notificationType] ?? {
                    label: pref.notificationType,
                    description: "",
                    color: "bg-gray-100 text-gray-700 border-gray-200",
                  };
                  return (
                    <div
                      key={pref.notificationType}
                      className="flex items-center justify-between px-5 py-4 hover:bg-muted/30 transition-colors"
                    >
                      <div className="flex items-start gap-3 flex-1 min-w-0">
                        <div className="mt-0.5">
                          {pref.inApp ? (
                            <Bell className="w-4 h-4 text-primary" />
                          ) : (
                            <BellOff className="w-4 h-4 text-muted-foreground" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm font-medium text-foreground">{meta.label}</span>
                            <Badge className={`text-[10px] px-1.5 py-0 h-4 border font-normal ${meta.color}`}>
                              {pref.inApp ? "Ativo" : "Inativo"}
                            </Badge>
                          </div>
                          <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                            {meta.description}
                          </p>
                        </div>
                      </div>
                      <Switch
                        checked={pref.inApp}
                        onCheckedChange={(checked) => handleToggle(pref.notificationType, checked)}
                        disabled={updateMutation.isPending}
                        className="ml-4 shrink-0"
                      />
                    </div>
                  );
                })}
          </CardContent>
        </Card>

        {/* Info note */}
        <p className="text-xs text-muted-foreground text-center pb-4">
          As preferências são salvas automaticamente ao alternar cada opção.
        </p>
      </div>
    </AppLayout>
  );
}
