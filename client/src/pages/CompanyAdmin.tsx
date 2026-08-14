import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import AppLayout from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Building2, FolderKanban, Loader2, Plus, ShieldCheck, UserPlus, Users } from "lucide-react";
import { FormEvent, useState } from "react";

const roleLabels: Record<string, string> = {
  user: "Usuário",
  leader: "Líder",
  company_admin: "Admin da empresa",
};

export default function CompanyAdmin() {
  const { user } = useAuth();
  const canAccess = user?.role === "company_admin" || user?.role === "admin" || user?.role === "master_admin";
  const utils = trpc.useUtils();
  const dashboard = trpc.companyAdmin.dashboard.useQuery(undefined, { enabled: canAccess, staleTime: 30_000 });
  const createUser = trpc.companyAdmin.createUser.useMutation({
    onSuccess: async () => {
      await utils.companyAdmin.dashboard.invalidate();
      setForm({ name: "", email: "", password: "", role: "user" });
      toast.success("Usuário criado dentro da empresa.");
    },
    onError: (error) => toast.error(error.message),
  });
  const updateRole = trpc.companyAdmin.updateUserRole.useMutation({
    onSuccess: () => { void utils.companyAdmin.dashboard.invalidate(); toast.success("Permissão atualizada."); },
    onError: (error) => toast.error(error.message),
  });
  const archiveProject = trpc.companyAdmin.archiveProject.useMutation({
    onSuccess: () => { void utils.companyAdmin.dashboard.invalidate(); toast.success("Projeto arquivado."); },
    onError: (error) => toast.error(error.message),
  });
  const [form, setForm] = useState({ name: "", email: "", password: "", role: "user" as "user" | "leader" | "company_admin" });

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    createUser.mutate(form);
  };

  if (!canAccess) {
    return <AppLayout title="Admin da empresa"><div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-sm text-red-700">Você não possui permissão para acessar este painel.</div></AppLayout>;
  }

  const data = dashboard.data;
  return (
    <AppLayout title="Admin da empresa">
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="rounded-2xl border border-slate-200 bg-gradient-to-br from-slate-950 via-slate-900 to-emerald-950 p-6 text-white shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-emerald-300">Gestão por empresa</p>
              <h1 className="text-2xl font-black tracking-tight">{data?.company.name ?? "Carregando empresa..."}</h1>
              <p className="mt-2 max-w-2xl text-sm text-slate-300">Administre usuários, permissões e contratos sem acessar dados de outras empresas.</p>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/10 px-4 py-3 text-right backdrop-blur-sm"><p className="text-[10px] uppercase tracking-wide text-slate-400">Identificador</p><p className="font-mono text-sm text-emerald-200">{data?.company.slug ?? "—"}</p></div>
          </div>
        </header>

        {dashboard.isLoading ? <div className="flex items-center justify-center rounded-2xl border border-slate-200 bg-white py-20 text-sm text-slate-500"><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Carregando dados da empresa...</div> : dashboard.error ? <div className="rounded-2xl border border-red-200 bg-red-50 p-5 text-sm text-red-700">{dashboard.error.message}</div> : (
          <>
            <div className="grid gap-4 sm:grid-cols-3">
              <SummaryCard icon={<Users className="h-5 w-5" />} label="Usuários" value={data?.members.length ?? 0} />
              <SummaryCard icon={<FolderKanban className="h-5 w-5" />} label="Projetos ativos" value={data?.projects.filter((project: any) => project.status === "active").length ?? 0} />
              <SummaryCard icon={<ShieldCheck className="h-5 w-5" />} label="Administradores" value={data?.members.filter((member: any) => member.role === "company_admin").length ?? 0} />
            </div>

            <Tabs defaultValue="users" className="w-full">
              <TabsList className="grid h-auto w-full max-w-xl grid-cols-2 rounded-xl bg-slate-100 p-1">
                <TabsTrigger value="users" className="gap-2 rounded-lg py-2.5 data-[state=active]:bg-white data-[state=active]:shadow-sm"><Users className="h-4 w-4" /> Usuários</TabsTrigger>
                <TabsTrigger value="projects" className="gap-2 rounded-lg py-2.5 data-[state=active]:bg-white data-[state=active]:shadow-sm"><FolderKanban className="h-4 w-4" /> Projetos da empresa</TabsTrigger>
              </TabsList>

              <TabsContent value="users" className="mt-4">
                <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
                  <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
                    <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4"><div><h2 className="font-bold text-slate-900">Usuários da empresa</h2><p className="text-xs text-slate-500">As alterações ficam restritas ao companyId desta organização.</p></div><Users className="h-5 w-5 text-emerald-600" /></div>
                    <div className="divide-y divide-slate-100">
                      {data?.members.map((member: any) => <div key={member.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-4"><div className="min-w-0"><p className="truncate text-sm font-semibold text-slate-800">{member.name || "Sem nome"}</p><p className="truncate text-xs text-slate-500">{member.email || "Sem e-mail"}</p></div><div className="flex items-center gap-2"><select value={member.role} onChange={(event) => updateRole.mutate({ userId: member.id, role: event.target.value as "user" | "leader" | "company_admin" })} disabled={updateRole.isPending || member.id === user?.id} className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-700"><option value="user">{roleLabels.user}</option><option value="leader">{roleLabels.leader}</option><option value="company_admin">{roleLabels.company_admin}</option></select><Badge variant="outline" className="hidden sm:inline-flex">{member.lastSeenAt ? "Presença registrada" : "Sem presença"}</Badge></div></div>)}
                      {data?.members.length === 0 && <p className="px-5 py-8 text-center text-sm text-slate-500">Nenhum usuário vinculado à empresa.</p>}
                    </div>
                  </section>

                  <form onSubmit={handleSubmit} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className="mb-4 flex items-center gap-2"><div className="rounded-lg bg-emerald-50 p-2 text-emerald-700"><UserPlus className="h-4 w-4" /></div><div><h2 className="font-bold text-slate-900">Novo usuário</h2><p className="text-xs text-slate-500">Será vinculado automaticamente à empresa.</p></div></div><div className="space-y-3"><div><Label htmlFor="company-user-name">Nome</Label><Input id="company-user-name" value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} required /></div><div><Label htmlFor="company-user-email">E-mail</Label><Input id="company-user-email" type="email" value={form.email} onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))} required /></div><div><Label htmlFor="company-user-password">Senha inicial</Label><Input id="company-user-password" type="password" minLength={6} value={form.password} onChange={(event) => setForm((current) => ({ ...current, password: event.target.value }))} required /></div><div><Label htmlFor="company-user-role">Permissão</Label><select id="company-user-role" value={form.role} onChange={(event) => setForm((current) => ({ ...current, role: event.target.value as typeof current.role }))} className="mt-1 flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"><option value="user">{roleLabels.user}</option><option value="leader">{roleLabels.leader}</option><option value="company_admin">{roleLabels.company_admin}</option></select></div><Button type="submit" className="w-full bg-emerald-600 hover:bg-emerald-700" disabled={createUser.isPending}><Plus className="mr-2 h-4 w-4" />{createUser.isPending ? "Criando..." : "Criar usuário"}</Button></div></form>
                </div>
              </TabsContent>

              <TabsContent value="projects" className="mt-4">
                <section className="rounded-2xl border border-slate-200 bg-white shadow-sm"><div className="flex items-center justify-between border-b border-slate-100 px-5 py-4"><div><h2 className="font-bold text-slate-900">Projetos da empresa</h2><p className="text-xs text-slate-500">Somente contratos vinculados ao companyId atual são exibidos.</p></div><Building2 className="h-5 w-5 text-emerald-600" /></div><div className="grid gap-3 p-5 md:grid-cols-2">{data?.projects.map((project: any) => <div key={project.id} className="rounded-xl border border-slate-200 p-4"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="truncate text-sm font-bold text-slate-800">{project.name}</p><p className="mt-1 text-xs text-slate-500">{project.code || project.clientName || "Sem código"}</p></div><Badge className={project.status === "active" ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-600"}>{project.status === "active" ? "Ativo" : "Arquivado"}</Badge></div><div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-emerald-500" style={{ width: `${Math.max(0, Math.min(100, Number(project.progress) || 0))}%` }} /></div><div className="mt-3 flex items-center justify-between text-xs text-slate-500"><span>{Number(project.progress || 0).toLocaleString("pt-BR")}% concluído</span>{project.status === "active" && <Button type="button" variant="outline" size="sm" onClick={() => { if (window.confirm(`Arquivar o projeto ${project.name}?`)) archiveProject.mutate({ crsId: project.id }); }} disabled={archiveProject.isPending}>Arquivar</Button>}</div></div>)}{data?.projects.length === 0 && <p className="col-span-full py-8 text-center text-sm text-slate-500">Nenhum projeto vinculado à empresa.</p>}</div></section>
              </TabsContent>
            </Tabs>
          </>
        )}
      </div>
    </AppLayout>
  );
}

function SummaryCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className="mb-3 flex items-center justify-between"><span className="rounded-lg bg-emerald-50 p-2 text-emerald-700">{icon}</span><span className="text-2xl font-black text-slate-900">{value}</span></div><p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p></div>;
}
