import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Loader2, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

const ROLE_LABELS: Record<string, string> = {
  admin: "Administrador",
  leader: "Líder",
  user: "Usuário",
};
const ROLE_COLORS: Record<string, string> = {
  admin: "bg-red-100 text-red-700",
  leader: "bg-blue-100 text-blue-700",
  user: "bg-gray-100 text-gray-700",
};

export default function Roles() {
  const { user: me } = useAuth();
  const utils = trpc.useUtils();
  const { data: users, isLoading } = trpc.users.list.useQuery();
  const updateRole = trpc.users.updateRole.useMutation({
    onSuccess: () => {
      toast.success("Função atualizada com sucesso!");
      utils.users.list.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  if (me?.role !== "admin") {
    return (
      <div className="container py-8">
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-muted-foreground">
            <ShieldCheck className="h-12 w-12 mb-4 opacity-30" />
            <p>Acesso restrito a administradores</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container max-w-3xl py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <ShieldCheck className="h-6 w-6 text-primary" />
          Gerenciar Funções
        </h1>
        <p className="text-muted-foreground mt-1">Atribua funções aos membros da equipe</p>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Membros ({users?.length ?? 0})</CardTitle>
          </CardHeader>
          <CardContent className="divide-y">
            {users?.map((u: any) => (
              <div key={u.id} className="flex items-center justify-between py-3">
                <div className="flex items-center gap-3">
                  <Avatar className="h-9 w-9">
                    <AvatarImage src={u.avatarUrl ?? ""} />
                    <AvatarFallback className="bg-primary text-primary-foreground text-xs">
                      {(u.name ?? u.email ?? "U").slice(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="text-sm font-medium">{u.name ?? "Sem nome"}</p>
                    <p className="text-xs text-muted-foreground">{u.email ?? "—"}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge className={ROLE_COLORS[u.role] ?? ""} variant="outline">
                    {ROLE_LABELS[u.role] ?? u.role}
                  </Badge>
                  {u.id !== me?.id && (
                    <Select
                      value={u.role}
                      onValueChange={(role) => updateRole.mutate({ userId: u.id, role: role as any })}
                    >
                      <SelectTrigger className="w-36 h-8 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="user">Usuário</SelectItem>
                        <SelectItem value="leader">Líder</SelectItem>
                        <SelectItem value="admin">Administrador</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
