import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CalendarDays, LogIn, LogOut } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";

export function GoogleCalendarCard() {
  const isConnectedQ = trpc.googleCalendar.isConnected.useQuery();
  const getAuthUrlQ = trpc.googleCalendar.getAuthUrl.useQuery();
  const disconnectMut = trpc.googleCalendar.disconnect.useMutation({
    onSuccess: () => {
      isConnectedQ.refetch();
      toast.success("Google Calendar desconectado!");
    },
    onError: (e) => toast.error(e.message),
  });

  const handleConnect = () => {
    if (getAuthUrlQ.data?.authUrl) {
      window.open(getAuthUrlQ.data.authUrl, "_blank");
    }
  };

  const handleDisconnect = () => {
    disconnectMut.mutate();
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <CalendarDays className="h-4 w-4" />
          Google Calendar
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isConnectedQ.isLoading ? (
          <p className="text-xs text-gray-400">Verificando...</p>
        ) : isConnectedQ.data?.connected ? (
          <Button
            size="sm"
            variant="destructive"
            className="w-full gap-2 h-8 text-xs"
            onClick={handleDisconnect}
            disabled={disconnectMut.isPending}
          >
            <LogOut className="w-3.5 h-3.5" /> Desconectar
          </Button>
        ) : (
          <Button
            size="sm"
            className="w-full gap-2 h-8 text-xs"
            onClick={handleConnect}
          >
            <LogIn className="w-3.5 h-3.5" /> Conectar
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
