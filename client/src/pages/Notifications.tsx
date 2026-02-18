import AppLayout from "@/components/AppLayout";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Bell, CheckCheck, Trash2, FolderKanban, ListTodo, MessageSquare, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "wouter";
import { cn } from "@/lib/utils";

const TYPE_ICONS: Record<string, any> = {
  task_assigned: ListTodo,
  task_comment: MessageSquare,
  project_update: FolderKanban,
  system: Info,
};
const TYPE_COLORS: Record<string, string> = {
  task_assigned: "text-blue-400 bg-blue-500/10",
  task_comment: "text-violet-400 bg-violet-500/10",
  project_update: "text-emerald-400 bg-emerald-500/10",
  system: "text-amber-400 bg-amber-500/10",
};

export default function Notifications() {
  const utils = trpc.useUtils();
  const { data: notifications, isLoading } = trpc.notifications.list.useQuery();

  const markReadMutation = trpc.notifications.markRead.useMutation({
    onSuccess: () => utils.notifications.list.invalidate(),
  });
  const markAllReadMutation = trpc.notifications.markAllRead.useMutation({
    onSuccess: () => {
      utils.notifications.list.invalidate();
      utils.notifications.unreadCount.invalidate();
      toast.success("Todas marcadas como lidas!");
    },
  });
  const deleteMutation = trpc.notifications.delete.useMutation({
    onSuccess: () => {
      utils.notifications.list.invalidate();
      utils.notifications.unreadCount.invalidate();
    },
  });

  const unread = notifications?.filter((n) => !n.isRead) ?? [];

  return (
    <AppLayout title="Notificações">
      <div className="max-w-2xl mx-auto space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold">Notificações</h2>
            {unread.length > 0 && (
              <p className="text-muted-foreground mt-1">
                {unread.length} não lida{unread.length !== 1 ? "s" : ""}
              </p>
            )}
          </div>
          {unread.length > 0 && (
            <Button
              variant="outline"
              size="sm"
              className="gap-2 border-border"
              onClick={() => markAllReadMutation.mutate()}
              disabled={markAllReadMutation.isPending}
            >
              <CheckCheck className="w-4 h-4" />
              Marcar todas como lidas
            </Button>
          )}
        </div>

        {/* List */}
        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-20 w-full rounded-xl" />
            ))}
          </div>
        ) : !notifications?.length ? (
          <div className="flex flex-col items-center py-20 text-center">
            <Bell className="w-16 h-16 text-muted-foreground/20 mb-4" />
            <h3 className="text-lg font-semibold mb-2">Nenhuma notificação</h3>
            <p className="text-muted-foreground">Você está em dia com tudo!</p>
          </div>
        ) : (
          <div className="space-y-2">
            {notifications.map((n) => {
              const Icon = TYPE_ICONS[n.notificationType ?? "system"] ?? Info;
              const colorClass = TYPE_COLORS[n.notificationType ?? "system"] ?? TYPE_COLORS.system;
              return (
                <div
                  key={n.id}
                  className={cn(
                    "flex items-start gap-4 p-4 rounded-xl border transition-all duration-150 group",
                    n.isRead
                      ? "bg-card border-border"
                      : "bg-card border-primary/30 shadow-sm shadow-primary/5"
                  )}
                  onClick={() => !n.isRead && markReadMutation.mutate({ id: n.id })}
                >
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${colorClass}`}>
                    <Icon className="w-5 h-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <p className={cn("text-sm font-medium", !n.isRead && "text-foreground")}>
                          {n.title}
                          {!n.isRead && (
                            <span className="inline-block w-2 h-2 rounded-full bg-primary ml-2 align-middle" />
                          )}
                        </p>
                        <p className="text-sm text-muted-foreground mt-0.5 leading-relaxed">{n.message}</p>
                        <p className="text-xs text-muted-foreground/60 mt-1">
                          {new Date(n.createdAt).toLocaleDateString("pt-BR", {
                            day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit",
                          })}
                        </p>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity hover:text-destructive flex-shrink-0"
                        onClick={(e) => { e.stopPropagation(); deleteMutation.mutate({ id: n.id }); }}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                    {n.relatedTaskId && (
                      <Link href={`/tasks/${n.relatedTaskId}`}>
                        <a className="text-xs text-primary hover:underline mt-1 inline-block" onClick={(e) => e.stopPropagation()}>
                          Ver tarefa →
                        </a>
                      </Link>
                    )}
                    {n.relatedProjectId && !n.relatedTaskId && (
                      <Link href={`/projects/${n.relatedProjectId}/kanban`}>
                        <a className="text-xs text-primary hover:underline mt-1 inline-block" onClick={(e) => e.stopPropagation()}>
                          Ver projeto →
                        </a>
                      </Link>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
