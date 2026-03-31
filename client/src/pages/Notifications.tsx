import { trpc } from "@/lib/trpc";
import AppLayout from "@/components/AppLayout";
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

// ── Notification type config ──────────────────────────────────────────────────
const NOTIF_CONFIG: Record<string, { icon: any; color: string; bg: string }> = {
  task_assigned: { icon: UserPlus, color: "text-blue-500", bg: "bg-blue-500/10" },
  task_due:      { icon: Calendar, color: "text-orange-500", bg: "bg-orange-500/10" },
  task_overdue:  { icon: AlertTriangle, color: "text-red-500", bg: "bg-red-500/10" },
  checklist_update: { icon: CheckSquare, color: "text-emerald-500", bg: "bg-emerald-500/10" },
  comment:       { icon: MessageSquare, color: "text-violet-500", bg: "bg-violet-500/10" },
  chat_message:  { icon: MessageSquare, color: "text-primary", bg: "bg-primary/10" },
  vacation_conflict: { icon: Plane, color: "text-orange-500", bg: "bg-orange-500/10" },
  system:        { icon: Info, color: "text-muted-foreground", bg: "bg-muted" },
};

function getConfig(type: string) {
  return NOTIF_CONFIG[type] ?? { icon: Bell, color: "text-primary", bg: "bg-primary/10" };
}

export default function Notifications() {
  const [, navigate] = useLocation();
  const { data: notifications, isLoading, refetch } = trpc.notifications.list.useQuery();
  const markRead = trpc.notifications.markRead.useMutation({ onSuccess: () => refetch() });
  const markAllRead = trpc.notifications.markAllRead.useMutation({ onSuccess: () => refetch() });

  const unreadCount = notifications?.filter((n: any) => !n.isRead).length ?? 0;

  function handleClick(n: any) {
    if (!n.isRead) markRead.mutate({ id: n.id });
    if (n.relatedTaskId) navigate(`/tasks/${n.relatedTaskId}`);
  }

  return (
    <AppLayout>
      <div className="container max-w-2xl py-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Bell className="h-6 w-6 text-primary" />
              Notificações
              {unreadCount > 0 && (
                <Badge variant="destructive" className="ml-2">{unreadCount}</Badge>
              )}
            </h1>
            <p className="text-muted-foreground mt-1">Suas notificações recentes</p>
          </div>
          {unreadCount > 0 && (
            <Button variant="outline" size="sm" onClick={() => markAllRead.mutate()} disabled={markAllRead.isPending}>
              <CheckCheck className="h-4 w-4 mr-2" />
              Marcar todas como lidas
            </Button>
          )}
        </div>

        {isLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : !notifications?.length ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <Bell className="h-12 w-12 mb-4 opacity-30" />
              <p>Nenhuma notificação</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {notifications.map((n: any) => {
              const cfg = getConfig(n.notificationType ?? "system");
              const Icon = cfg.icon;
              const isClickable = !!n.relatedTaskId;
              return (
                <div
                  key={n.id}
                  onClick={() => handleClick(n)}
                  className={`flex items-start gap-3 p-4 rounded-xl border transition-all ${
                    n.isRead
                      ? "bg-card border-border opacity-60"
                      : "bg-primary/5 border-primary/30 shadow-sm"
                  } ${isClickable ? "cursor-pointer hover:bg-muted/50" : ""}`}
                >
                  {/* Icon */}
                  <div className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${cfg.bg}`}>
                    <Icon className={`w-4 h-4 ${cfg.color}`} />
                  </div>
                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <p className="font-medium text-sm text-foreground leading-snug">{n.title}</p>
                      {!n.isRead && (
                        <span className="w-2 h-2 rounded-full bg-primary shrink-0 mt-1.5" />
                      )}
                    </div>
                    {n.message && (
                      <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{n.message}</p>
                    )}
                    <div className="flex items-center gap-3 mt-1.5">
                      <p className="text-xs text-muted-foreground">
                        {formatDistanceToNow(new Date(n.createdAt), { addSuffix: true, locale: ptBR })}
                      </p>
                      {n.relatedTaskId && (
                        <span className="text-xs text-primary hover:underline">Ver tarefa →</span>
                      )}
                    </div>
                  </div>
                  {/* Mark read button */}
                  {!n.isRead && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="shrink-0 h-7 w-7 p-0"
                      onClick={(e) => { e.stopPropagation(); markRead.mutate({ id: n.id }); }}
                    >
                      <CheckCheck className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
