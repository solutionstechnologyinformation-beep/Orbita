import { trpc } from "@/lib/trpc";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Bell, CheckCheck, Loader2 } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

export default function Notifications() {
  const { data: notifications, isLoading, refetch } = trpc.notifications.list.useQuery();
  const markRead = trpc.notifications.markRead.useMutation({ onSuccess: () => refetch() });
  const markAllRead = trpc.notifications.markAllRead.useMutation({ onSuccess: () => refetch() });

  const unreadCount = notifications?.filter((n: any) => !n.isRead).length ?? 0;

  return (
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
          {notifications.map((n: any) => (
            <Card key={n.id} className={n.isRead ? "opacity-60" : "border-primary/30 bg-primary/5"}>
              <CardContent className="flex items-start gap-3 p-4">
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm">{n.title}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{n.message}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {formatDistanceToNow(new Date(n.createdAt), { addSuffix: true, locale: ptBR })}
                  </p>
                </div>
                {!n.isRead && (
                  <Button variant="ghost" size="sm" onClick={() => markRead.mutate({ id: n.id })}>
                    <CheckCheck className="h-4 w-4" />
                  </Button>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
