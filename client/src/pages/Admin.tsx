import AppLayout from "@/components/AppLayout";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { useLocation } from "wouter";
import { useEffect } from "react";
import {
  Shield, Users, FolderKanban, Activity, Crown, User,
  CheckCircle2, Clock, ListTodo, Briefcase, Plus, Pencil, Trash2, X, Check,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useState } from "react";
import { toast } from "sonner";

const ACTION_LABELS: Record<string, string> = {
  created_project: "Criou projeto",
  updated_project: "Atualizou projeto",
  deleted_project: "Excluiu projeto",
  created_task: "Criou tarefa",
  updated_task: "Atualizou tarefa",
  deleted_task: "Excluiu tarefa",
  uploaded_attachment: "Fez upload de anexo",
  added_comment: "Adicionou comentário",
};

export default function Admin() {
  const { user, isAuthenticated, loading } = useAuth();
  const [, navigate] = useLocation();

  useEffect(() => {
    if (!loading && isAuthenticated && user?.role !== "admin") {
      navigate("/dashboard");
    }
  }, [loading, isAuthenticated, user]);

  const { data: allUsers, isLoading: usersLoading } = trpc.admin.users.useQuery();
  const { data: allProjects, isLoading: projectsLoading } = trpc.admin.allProjects.useQuery();
  const { data: logs, isLoading: logsLoading } = trpc.admin.activityLogs.useQuery({ limit: 50, offset: 0 });
  const utils = trpc.useUtils();

  // Users state
  const [userDialog, setUserDialog] = useState<{ open: boolean; editing?: any }>({ open: false });
  const [userForm, setUserForm] = useState({ name: "", email: "", role: "user" as "user" | "admin" });

  const createUserMut = trpc.admin.createUser.useMutation({
    onSuccess: () => { utils.admin.users.invalidate(); setUserDialog({ open: false }); toast.success("Usuário criado!"); },
    onError: (e) => toast.error(e.message),
  });
  const updateUserRoleMut = trpc.admin.updateUserRole.useMutation({
    onSuccess: () => { utils.admin.users.invalidate(); toast.success("Papel atualizado!"); },
    onError: (e) => toast.error(e.message),
  });
  const deleteUserMut = trpc.admin.deleteUser.useMutation({
    onSuccess: () => { utils.admin.users.invalidate(); toast.success("Usuário removido!"); },
    onError: (e) => toast.error(e.message),
  });

  function openCreateUser() {
    setUserForm({ name: "", email: "", role: "user" });
    setUserDialog({ open: true });
  }
  function saveUser() {
    if (!userForm.name.trim()) { toast.error("Nome é obrigatório"); return; }
    createUserMut.mutate({ name: userForm.name, email: userForm.email || undefined, role: userForm.role });
  }

  // Clients state
  const { data: clientsList, isLoading: clientsLoading } = trpc.clients.list.useQuery();
  const [clientDialog, setClientDialog] = useState<{ open: boolean; editing?: any }>({
    open: false,
  });
  const [clientForm, setClientForm] = useState({ name: "", email: "", phone: "", company: "", notes: "" });

  const createClientMut = trpc.clients.create.useMutation({
    onSuccess: () => { utils.clients.list.invalidate(); setClientDialog({ open: false }); toast.success("Cliente criado!"); },
    onError: (e) => toast.error(e.message),
  });
  const updateClientMut = trpc.clients.update.useMutation({
    onSuccess: () => { utils.clients.list.invalidate(); setClientDialog({ open: false }); toast.success("Cliente atualizado!"); },
    onError: (e) => toast.error(e.message),
  });
  const deleteClientMut = trpc.clients.delete.useMutation({
    onSuccess: () => { utils.clients.list.invalidate(); toast.success("Cliente removido!"); },
    onError: (e) => toast.error(e.message),
  });

  function openCreate() {
    setClientForm({ name: "", email: "", phone: "", company: "", notes: "" });
    setClientDialog({ open: true });
  }
  function openEdit(c: any) {
    setClientForm({ name: c.name ?? "", email: c.email ?? "", phone: c.phone ?? "", company: c.company ?? "", notes: c.notes ?? "" });
    setClientDialog({ open: true, editing: c });
  }
  function saveClient() {
    if (!clientForm.name.trim()) { toast.error("Nome é obrigatório"); return; }
    if (clientDialog.editing) {
      updateClientMut.mutate({ id: clientDialog.editing.id, ...clientForm });
    } else {
      createClientMut.mutate(clientForm);
    }
  }

  if (loading || !isAuthenticated) return null;
  if (user?.role !== "admin") return null;

  return (
    <AppLayout title="Painel Administrativo">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-500/15 flex items-center justify-center">
            <Shield className="w-5 h-5 text-amber-400" />
          </div>
          <div>
            <h2 className="text-2xl font-bold">Painel Administrativo</h2>
            <p className="text-muted-foreground">Gerencie usuários, projetos e monitore atividades.</p>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { icon: Users, label: "Usuários", value: allUsers?.length ?? 0, color: "text-blue-400", bg: "bg-blue-500/10" },
            { icon: FolderKanban, label: "Projetos", value: allProjects?.length ?? 0, color: "text-violet-400", bg: "bg-violet-500/10" },
            { icon: Activity, label: "Atividades", value: logs?.length ?? 0, color: "text-emerald-400", bg: "bg-emerald-500/10" },
            { icon: Crown, label: "Admins", value: allUsers?.filter((u: any) => u.role === "admin").length ?? 0, color: "text-amber-400", bg: "bg-amber-500/10" },
          ].map(({ icon: Icon, label, value, color, bg }) => (
            <Card key={label} className="bg-card border-border">
              <CardContent className="p-5">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">{label}</p>
                    <p className="text-3xl font-bold">{value}</p>
                  </div>
                  <div className={`w-10 h-10 rounded-xl ${bg} flex items-center justify-center`}>
                    <Icon className={`w-5 h-5 ${color}`} />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <Tabs defaultValue="users">
          <TabsList className="bg-secondary border border-border">
            <TabsTrigger value="users" className="gap-2">
              <Users className="w-4 h-4" />
              Usuários
            </TabsTrigger>
            <TabsTrigger value="projects" className="gap-2">
              <FolderKanban className="w-4 h-4" />
              Projetos
            </TabsTrigger>
            <TabsTrigger value="logs" className="gap-2">
              <Activity className="w-4 h-4" />
              Logs
            </TabsTrigger>
            <TabsTrigger value="clients" className="gap-2">
              <Briefcase className="w-4 h-4" />
              Clientes
            </TabsTrigger>
          </TabsList>

          {/* Users Tab */}
          <TabsContent value="users" className="mt-4">
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm text-muted-foreground">{allUsers?.length ?? 0} usuário(s) cadastrado(s)</p>
              <Button size="sm" className="gap-2" onClick={openCreateUser}>
                <Plus className="w-4 h-4" /> Novo Usuário
              </Button>
            </div>
            <Card className="bg-card border-border">
              <CardContent className="p-0">
                {usersLoading ? (
                  <div className="p-4 space-y-3">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Skeleton key={i} className="h-14 w-full" />
                    ))}
                  </div>
                ) : (
                  <div className="divide-y divide-border">
                    {allUsers?.map((u: any) => {
                      const initials = u.name
                        ? u.name.split(" ").map((n: string) => n[0]).join("").toUpperCase().slice(0, 2)
                        : "U";
                      return (
                        <div key={u.id} className="flex items-center gap-4 p-4 hover:bg-secondary/30 transition-colors">
                          <Avatar className="w-10 h-10">
                            <AvatarFallback className={`text-sm font-semibold ${u.role === "admin" ? "bg-amber-500/20 text-amber-400" : "bg-primary/20 text-primary"}`}>
                              {initials}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium truncate">{u.name ?? "Usuário"}</p>
                            <p className="text-sm text-muted-foreground truncate">{u.email ?? u.openId}</p>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge className={u.role === "admin"
                              ? "bg-amber-500/15 text-amber-400 border border-amber-500/30"
                              : "bg-secondary text-muted-foreground border border-border"
                            }>
                              {u.role === "admin" ? <Crown className="w-3 h-3 mr-1" /> : <User className="w-3 h-3 mr-1" />}
                              {u.role === "admin" ? "Admin" : "Usuário"}
                            </Badge>
                            <span className="text-xs text-muted-foreground hidden md:block">
                              {new Date(u.createdAt).toLocaleDateString("pt-BR")}
                            </span>
                            {/* Toggle role */}
                            <Button
                              variant="ghost" size="icon" className="h-8 w-8"
                              title={u.role === "admin" ? "Rebaixar para Usuário" : "Promover para Admin"}
                              onClick={() => updateUserRoleMut.mutate({ userId: u.id, role: u.role === "admin" ? "user" : "admin" })}
                            >
                              {u.role === "admin" ? <User className="w-4 h-4" /> : <Crown className="w-4 h-4" />}
                            </Button>
                            {/* Delete */}
                            <Button
                              variant="ghost" size="icon" className="h-8 w-8 text-red-500 hover:text-red-700"
                              title="Remover usuário"
                              onClick={() => { if (confirm(`Remover ${u.name ?? "usuário"}?`)) deleteUserMut.mutate({ userId: u.id }); }}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Projects Tab */}
          <TabsContent value="projects" className="mt-4">
            <Card className="bg-card border-border">
              <CardContent className="p-0">
                {projectsLoading ? (
                  <div className="p-4 space-y-3">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Skeleton key={i} className="h-14 w-full" />
                    ))}
                  </div>
                ) : (
                  <div className="divide-y divide-border">
                    {allProjects?.map((p: any) => (
                      <div key={p.id} className="flex items-center gap-4 p-4 hover:bg-secondary/30 transition-colors">
                        <div
                          className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                          style={{ backgroundColor: `${p.color}20` }}
                        >
                          <FolderKanban className="w-5 h-5" style={{ color: p.color }} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate">{p.name}</p>
                          <p className="text-sm text-muted-foreground">
                            Dono ID: {p.ownerId} · {new Date(p.createdAt).toLocaleDateString("pt-BR")}
                          </p>
                        </div>
                        <Badge className={
                          p.status === "active"
                            ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30"
                            : "bg-secondary text-muted-foreground border border-border"
                        }>
                          {p.status === "active" ? "Ativo" : p.status}
                        </Badge>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Logs Tab */}
          <TabsContent value="logs" className="mt-4">
            <Card className="bg-card border-border">
              <CardContent className="p-0">
                {logsLoading ? (
                  <div className="p-4 space-y-3">
                    {Array.from({ length: 8 }).map((_, i) => (
                      <Skeleton key={i} className="h-12 w-full" />
                    ))}
                  </div>
                ) : !logs?.length ? (
                  <div className="flex flex-col items-center py-12 text-center">
                    <Activity className="w-10 h-10 text-muted-foreground/20 mb-3" />
                    <p className="text-muted-foreground">Nenhuma atividade registrada.</p>
                  </div>
                ) : (
                  <div className="divide-y divide-border">
                    {logs.map((log: any) => (
                      <div key={log.id} className="flex items-center gap-3 px-4 py-3 hover:bg-secondary/30 transition-colors">
                        <div className="w-2 h-2 rounded-full bg-primary/60 flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm">
                            <span className="font-medium">{log.userName ?? `Usuário #${log.userId}`}</span>
                            {" "}
                            <span className="text-muted-foreground">{ACTION_LABELS[log.action] ?? log.action}</span>
                          </p>
                        </div>
                        <span className="text-xs text-muted-foreground flex-shrink-0">
                          {new Date(log.createdAt).toLocaleDateString("pt-BR", {
                            day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit",
                          })}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
          {/* Clients Tab */}
          <TabsContent value="clients" className="mt-4">
            <div className="flex justify-between items-center mb-4">
              <p className="text-sm text-muted-foreground">{clientsList?.length ?? 0} cliente(s) cadastrado(s)</p>
              <Button size="sm" onClick={openCreate} className="gap-2">
                <Plus className="w-4 h-4" /> Novo Cliente
              </Button>
            </div>
            <Card className="bg-card border-border">
              <CardContent className="p-0">
                {clientsLoading ? (
                  <div className="p-4 space-y-3">
                    {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-14 w-full" />)}
                  </div>
                ) : !clientsList?.length ? (
                  <div className="flex flex-col items-center py-12 text-center">
                    <Briefcase className="w-10 h-10 text-muted-foreground/20 mb-3" />
                    <p className="text-muted-foreground">Nenhum cliente cadastrado.</p>
                    <Button variant="outline" size="sm" className="mt-4" onClick={openCreate}>Adicionar primeiro cliente</Button>
                  </div>
                ) : (
                  <div className="divide-y divide-border">
                    {clientsList.map((c: any) => (
                      <div key={c.id} className="flex items-center gap-4 p-4 hover:bg-secondary/30 transition-colors">
                        <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center flex-shrink-0">
                          <Briefcase className="w-5 h-5 text-blue-400" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate">{c.name}</p>
                          <p className="text-sm text-muted-foreground truncate">
                            {[c.email, c.phone, c.company].filter(Boolean).join(" · ") || "Sem detalhes"}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(c)}>
                            <Pencil className="w-3.5 h-3.5" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive"
                            onClick={() => { if (confirm(`Remover cliente "${c.name}"?`)) deleteClientMut.mutate({ id: c.id }); }}>
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* User Dialog */}
      <Dialog open={userDialog.open} onOpenChange={open => setUserDialog(s => ({ ...s, open }))}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Novo Usuário</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Nome <span className="text-destructive">*</span></Label>
              <Input placeholder="Nome completo" value={userForm.name} onChange={e => setUserForm(s => ({ ...s, name: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>E-mail</Label>
              <Input type="email" placeholder="email@exemplo.com" value={userForm.email} onChange={e => setUserForm(s => ({ ...s, email: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>Papel</Label>
              <select
                className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
                value={userForm.role}
                onChange={e => setUserForm(s => ({ ...s, role: e.target.value as "user" | "admin" }))}
              >
                <option value="user">Usuário</option>
                <option value="admin">Administrador</option>
              </select>
            </div>
            <p className="text-xs text-muted-foreground">
              O usuário será criado com acesso manual. Para acesso via login OAuth, o usuário deve fazer login pela primeira vez.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setUserDialog({ open: false })}>Cancelar</Button>
            <Button onClick={saveUser} disabled={createUserMut.isPending}>
              {createUserMut.isPending ? "Criando..." : "Criar Usuário"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Client Dialog */}
      <Dialog open={clientDialog.open} onOpenChange={open => setClientDialog(s => ({ ...s, open }))}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{clientDialog.editing ? "Editar Cliente" : "Novo Cliente"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Nome <span className="text-destructive">*</span></Label>
              <Input placeholder="Nome do cliente" value={clientForm.name} onChange={e => setClientForm(s => ({ ...s, name: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>E-mail</Label>
                <Input type="email" placeholder="email@exemplo.com" value={clientForm.email} onChange={e => setClientForm(s => ({ ...s, email: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Telefone</Label>
                <Input placeholder="(11) 99999-9999" value={clientForm.phone} onChange={e => setClientForm(s => ({ ...s, phone: e.target.value }))} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Empresa</Label>
              <Input placeholder="Nome da empresa" value={clientForm.company} onChange={e => setClientForm(s => ({ ...s, company: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>Observações</Label>
              <Textarea placeholder="Notas sobre o cliente..." rows={3} value={clientForm.notes} onChange={e => setClientForm(s => ({ ...s, notes: e.target.value }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setClientDialog({ open: false })}>Cancelar</Button>
            <Button onClick={saveClient} disabled={createClientMut.isPending || updateClientMut.isPending}>
              {createClientMut.isPending || updateClientMut.isPending ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
