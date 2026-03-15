import { useAuth } from "@/_core/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Bell, BellOff } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

export default function NotificationPreferences() {
  const { user } = useAuth();
  const [prefs, setPrefs] = useState({
    taskAssigned: true,
    taskDue: true,
    phaseChange: true,
    vacationConflict: true,
    systemAlerts: true,
  });

  const handleToggle = (key: keyof typeof prefs) => {
    setPrefs(prev => {
      const updated = { ...prev, [key]: !prev[key] };
      toast.success("Preferência atualizada");
      return updated;
    });
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
        <p className="text-muted-foreground mt-1">Configure quais notificações deseja receber</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Tipos de Notificação</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {items.map(item => (
            <div key={item.key} className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label className="text-sm font-medium">{item.label}</Label>
                <p className="text-xs text-muted-foreground">{item.description}</p>
              </div>
              <Switch
                checked={prefs[item.key]}
                onCheckedChange={() => handleToggle(item.key)}
              />
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
