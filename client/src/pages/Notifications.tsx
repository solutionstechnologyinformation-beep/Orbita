import { useState } from "react";
import { trpc } from "@/lib/trpc";
import AppLayout from "@/components/AppLayout";
import { SplitLayout, SplitPanelHeader, SplitPanelContent } from "@/components/SplitLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useLocation } from "wouter";
import {
  Bell, CheckCheck, Loader2, MessageSquare, CheckSquare,
  AlertTriangle, UserPlus, Calendar, Info, Plane,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

const NOTIF_CONFIG: Record<string, { icon: any; color: string; bg: string }> = {
  task_assigned:     { icon: UserPlus,      color: "text-blue-500",       bg: "bg-blue-500/10" },
  task_due:          { icon: Calendar,      color: "text-orange-500",     bg: "bg-orange-500/10" },
  task_overdue:      { icon: AlertTriangle, color: "text-red-500",        bg: "bg-red-500/10" },
  checklist_update:  { icon: CheckSquare,   color: "text-emerald-500",    bg: "bg-emerald-500/10" },
  comment:           { icon: MessageSquare, color: "text-violet-500",     bg: "bg-violet-500/10" },
  chat_message:      { icon: MessageSquare, color: "text-primary",        bg: "bg-primary/10" },
  vacation_conflict: { icon: Plane,         color: "text-orange-500",     bg: "bg-orange-500/10" },
  system:            { icon: Info,          color: "text-muted-foreground", bg: "bg-muted" },
};

function getConfig(type: string) {
  return NOTIF_CONFIG[type] ?? { icon: Bell, color: "text-primary", bg: "bg-primary/10" };
}

export default function Notifications() {
  const [, navigate] = useLocation();
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const { data: notifications, isLoading, refetch } = trpc.notifications.list.useQuery();
  const markRead = trpc.notifications.markRead.useMutation({ onSuccess: () => refetch() });
  const markAllRead = trpc.notifications.markAllRead.useMutation({ onSuccess: () => refetch() });

  const unreadCount = notifications?.filter((n: any) => !n.isRead).length ?? 0;
  const selected = notifications?.find((n: any) => n.id === selectedId) ?? null;

  function handleSelect(n: any) {
    setSelectedId(n.id);
    if (!n.isRead) markRead.mutate({ id: n.id });
  }

  return (
    <AppLayout fullHeight>
      <SplitLayout
        leftWidth="340px"
        left={
          <>
            <SplitPanelHeader
              title="Notificações"
              subtitle={unreadCount > 0 ? `${unreadCount} não lida${unreadCount !== 1 ? "s" : ""}` : "Tudo lido"}
              action={
                unreadCount > 0 ? (
                  <Button variant="outline" size="sm" onClick={() => markAllRead.mutate()} disabled={markAllRead.isPending} className="h-8 text-xs gap-1.5">
                    <CheckCheck className="h-3.5 w-3.5" />
                    Marcar todas
                  </Button>
                ) : undefined
              }
            />
            <SplitPanelContent noPadding>
              {isLoading ? (
                <div className="flex justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
              ) : !notifications?.length ? (
                <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                  <Bell className="h-12 w-12 mb-4 opacity-30" />
                  <p className="text-sm">Nenhuma notificação</p>
                </div>
              ) : (
                <div className="divide-y divide-border">
                  {notifications.map((n: any) => {
                    const cfg = getConfig(n.notificationType ?? "system");
                    const Icon = cfg.icon;
                    const isActive = n.id === selectedId;
                    return (
                      <div
                        key={n.id}
                        onClick={() => handleSelect(n)}
                        className={`flex items-start gap-3 px-4 py-3 cursor-pointer transition-colors ${
                          isActive
                            ? "bg-primary/10 border-l-2 border-primary"
                            : n.isRead
                            ? "hover:bg-muted/40 opacity-70"
                            : "hover:bg-primary/5 bg-primary/5"
                        }`}
                      >
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${cfg.bg}`}>
                          <Icon className={`w-3.5 h-3.5 ${cfg.color}`} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-1">
                            <p className="text-sm font-medium leading-snug truncate">{n.title}</p>
                            {!n.isRead && <span className="w-2 h-2 rounded-full bg-primary shrink-0 mt-1.5" />}
                          </div>
                          {n.message && (
                            <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{n.message}</p>
                          )}
                          <p className="text-xs text-muted-foreground mt-1">
                            {formatDistanceToNow(new Date(n.createdAt), { addSuffix: true, locale: ptBR })}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </SplitPanelContent>
          </>
        }
        right={
          <SplitPanelContent noPadding>
            {!selected ? (
              <div className="flex flex-col items-center justify-center h-full text-muted-foreground gap-3">
                <Bell className="h-12 w-12 opacity-20" />
                <p className="text-sm">Selecione uma notificação para ver os detalhes</p>
              </div>
            ) : (() => {
              const cfg = getConfig(selected.notificationType ?? "system");
              const Icon = cfg.icon;
              return (
                <div className="p-6 space-y-5">
                  <div className="flex items-start gap-4">
                    <div className={`w-12 h-12 rounded-full flex items-center justify-center shrink-0 ${cfg.bg}`}>
                      <Icon className={`w-6 h-6 ${cfg.color}`} />
                    </div>
                    <div className="flex-1">
                      <h2 className="text-lg font-semibold leading-snug">{selected.title}</h2>
                      <p className="text-xs text-muted-foreground mt-1">
                        {formatDistanceToNow(new Date(selected.createdAt), { addSuffix: true, locale: ptBR })}
                      </p>
                    </div>
                    <Badge variant={selected.isRead ? "secondary" : "default"} className="shrink-0">
                      {selected.isRead ? "Lida" : "Não lida"}
                    </Badge>
                  </div>

                  {selected.message && (
                    <Card>
                      <CardContent className="pt-4">
                        <p className="text-sm leading-relaxed">{selected.message}</p>
                      </CardContent>
                    </Card>
                  )}

                  <div className="flex gap-2">
                    {!selected.isRead && (
                      <Button size="sm" variant="outline" onClick={() => markRead.mutate({ id: selected.id })} disabled={markRead.isPending} className="gap-1.5">
                        <CheckCheck className="h-4 w-4" />
                        Marcar como lida
                      </Button>
                    )}
                    {selected.relatedTaskId && (
                      <Button size="sm" onClick={() => navigate(`/tasks/${selected.relatedTaskId}`)} className="gap-1.5">
                        Ver tarefa →
                      </Button>
                    )}
                  </div>
                </div>
              );
            })()}
          </SplitPanelContent>
        }
      />
    </AppLayout>
  );
}
