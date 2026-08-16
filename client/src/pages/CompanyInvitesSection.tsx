import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Mail, Plus, Trash2, Copy, Check, Link as LinkIcon, Loader2, UserCheck, History, ShieldAlert, Filter, Search } from "lucide-react";
import { toast } from "sonner";

export function CompanyInvitesSection() {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"user" | "leader" | "company_admin">("user");
  const [copiedToken, setCopiedToken] = useState<string | null>(null);
  const [auditSearch, setAuditSearch] = useState("");
  const [actionFilter, setActionFilter] = useState<string>("all");

  const utils = trpc.useUtils();
  const { data: invites = [], isLoading } = trpc.companyAdmin.invites.list.useQuery();
  const { data: auditLogs = [], isLoading: auditLoading } = trpc.companyAdmin.invites.auditLogs.useQuery();

  const createInvite = trpc.companyAdmin.invites.create.useMutation({
    onSuccess: (res) => {
      toast.success("Convite gerado com sucesso!");
      setEmail("");
      utils.companyAdmin.invites.list.invalidate();
      utils.companyAdmin.invites.auditLogs.invalidate();
      if (res.inviteUrl) {
        navigator.clipboard.writeText(res.inviteUrl);
        toast.info("Link de convite copiado para a área de transferência!");
      }
    },
    onError: (err) => {
      toast.error(err.message || "Erro ao gerar convite.");
    },
  });

  const revokeInvite = trpc.companyAdmin.invites.revoke.useMutation({
    onSuccess: () => {
      toast.success("Convite revogado.");
      utils.companyAdmin.invites.list.invalidate();
      utils.companyAdmin.invites.auditLogs.invalidate();
    },
    onError: (err) => {
      toast.error(err.message || "Erro ao revogar convite.");
    },
  });

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    createInvite.mutate({ email: email.trim(), role });
  };

  const copyLink = (url: string, token: string) => {
    navigator.clipboard.writeText(url);
    setCopiedToken(token);
    toast.success("Link copiado!");
    setTimeout(() => setCopiedToken(null), 2500);
  };

  const filteredLogs = auditLogs.filter((log: any) => {
    const matchesSearch = !auditSearch || (log.details && log.details.toLowerCase().includes(auditSearch.toLowerCase())) || (log.ipAddress && log.ipAddress.includes(auditSearch));
    const matchesAction = actionFilter === "all" || log.action === actionFilter;
    return matchesSearch && matchesAction;
  });

  return (
    <div className="space-y-6">
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
        <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
            <div>
              <h2 className="font-bold text-slate-900">Convites de Equipe</h2>
              <p className="text-xs text-slate-500">Envie links de convite com validade de 7 dias para novos membros da empresa.</p>
            </div>
            <Mail className="h-5 w-5 text-blue-600" />
          </div>
          <div className="divide-y divide-slate-100">
            {isLoading ? (
              <div className="py-12 text-center text-xs text-slate-400">Carregando convites...</div>
            ) : invites.length === 0 ? (
              <div className="py-12 text-center text-xs text-slate-400">Nenhum convite gerado recentemente.</div>
            ) : (
              invites.map((inv: any) => {
                const inviteUrl = `${window.location.protocol}//${window.location.host}/invite?token=${inv.token}`;
                const isPending = inv.status === "pending" && new Date() <= new Date(inv.expiresAt);
                return (
                  <div key={inv.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
                    <div className="min-w-0 space-y-1">
                      <div className="flex items-center gap-2">
                        <p className="truncate text-sm font-semibold text-slate-800">{inv.email}</p>
                        <Badge className={inv.status === "accepted" ? "bg-emerald-100 text-emerald-700" : inv.status === "revoked" ? "bg-rose-100 text-rose-700" : isPending ? "bg-blue-100 text-blue-700" : "bg-amber-100 text-amber-700"}>
                          {inv.status === "accepted" ? "Aceito" : inv.status === "revoked" ? "Revogado" : isPending ? "Pendente" : "Expirado"}
                        </Badge>
                        <Badge variant="outline" className="text-[10px] uppercase">{inv.role}</Badge>
                      </div>
                      <p className="text-[11px] text-slate-400">Expira em: {new Date(inv.expiresAt).toLocaleDateString("pt-BR")}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      {isPending && (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => copyLink(inviteUrl, inv.token)}
                          className="gap-1.5 text-xs"
                        >
                          {copiedToken === inv.token ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
                          {copiedToken === inv.token ? "Copiado" : "Copiar Link"}
                        </Button>
                      )}
                      {isPending && (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => revokeInvite.mutate({ inviteId: inv.id })}
                          disabled={revokeInvite.isPending}
                          className="text-rose-600 hover:bg-rose-50 hover:text-rose-700 text-xs"
                        >
                          Revogar
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </section>

        <form onSubmit={handleCreate} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
            <div className="rounded-lg bg-blue-50 p-2 text-blue-700"><LinkIcon className="h-4 w-4" /></div>
            <div>
              <h2 className="font-bold text-slate-900">Novo Convite</h2>
              <p className="text-xs text-slate-500">Crie um link exclusivo para ingresso.</p>
            </div>
          </div>
          <div className="space-y-3">
            <div>
              <Label htmlFor="invite-email" className="text-xs font-semibold">E-mail do Convidado</Label>
              <Input
                id="invite-email"
                type="email"
                placeholder="colaborador@empresa.com.br"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-1 text-xs"
                required
              />
            </div>
            <div>
              <Label htmlFor="invite-role" className="text-xs font-semibold">Permissão no Workspace</Label>
              <select
                id="invite-role"
                value={role}
                onChange={(e) => setRole(e.target.value as any)}
                className="mt-1 flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-xs"
              >
                <option value="user">Colaborador / Usuário</option>
                <option value="leader">Líder de Equipe</option>
                <option value="company_admin">Administrador da Empresa</option>
              </select>
            </div>
            <Button type="submit" className="w-full bg-blue-600 hover:bg-blue-500 text-xs font-semibold text-white" disabled={createInvite.isPending}>
              {createInvite.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
              {createInvite.isPending ? "Gerando link..." : "Gerar e Copiar Link de Convite"}
            </Button>
          </div>
        </form>
      </div>

      <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 px-5 py-4">
          <div className="flex items-center gap-2">
            <div className="rounded-lg bg-slate-100 p-2 text-slate-700"><History className="h-5 w-5" /></div>
            <div>
              <h2 className="font-bold text-slate-900">Histórico de Auditoria de Convites</h2>
              <p className="text-xs text-slate-500">Registro cronológico de geração, visualização, aceite, revogação e expiração.</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
              <Input
                placeholder="Buscar detalhes ou IP..."
                value={auditSearch}
                onChange={(e) => setAuditSearch(e.target.value)}
                className="h-9 pl-9 text-xs w-60"
              />
            </div>
            <select
              value={actionFilter}
              onChange={(e) => setActionFilter(e.target.value)}
              className="h-9 rounded-md border border-input bg-background px-3 text-xs"
            >
              <option value="all">Todas as Ações</option>
              <option value="created">Gerado (Created)</option>
              <option value="viewed">Visualizado (Viewed)</option>
              <option value="accepted">Aceito (Accepted)</option>
              <option value="revoked">Revogado (Revoked)</option>
              <option value="expired">Expirado (Expired)</option>
            </select>
          </div>
        </div>

        <div className="divide-y divide-slate-100">
          {auditLoading ? (
            <div className="py-10 text-center text-xs text-slate-400">Carregando registros de auditoria...</div>
          ) : filteredLogs.length === 0 ? (
            <div className="py-10 text-center text-xs text-slate-400">Nenhum evento de auditoria encontrado para os filtros selecionados.</div>
          ) : (
            filteredLogs.map((log: any) => {
              const badgeColor =
                log.action === "accepted" ? "bg-emerald-100 text-emerald-700" :
                log.action === "created" ? "bg-blue-100 text-blue-700" :
                log.action === "revoked" ? "bg-rose-100 text-rose-700" :
                log.action === "expired" ? "bg-amber-100 text-amber-700" : "bg-purple-100 text-purple-700";

              return (
                <div key={log.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5 text-xs">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <Badge className={badgeColor}>{log.action.toUpperCase()}</Badge>
                      <span className="font-medium text-slate-800">{log.details || "Ação de convite"}</span>
                    </div>
                    <p className="text-[11px] text-slate-400">IP: {log.ipAddress || "N/D"} · ID do Convite: #{log.inviteId || "—"}</p>
                  </div>
                  <div className="text-right text-[11px] text-slate-500 font-mono">
                    {new Date(log.createdAt).toLocaleString("pt-BR")}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </section>
    </div>
  );
}
