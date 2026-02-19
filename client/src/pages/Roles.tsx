import { useState } from "react";
import { useParams, Link } from "wouter";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import AppLayout from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import {
  ArrowLeft, Plus, Pencil, Trash2, Shield, Users, Crown, CheckCircle2, AlertCircle
} from "lucide-react";

export default function Roles() {
  const { projectId } = useParams<{ projectId: string }>();
  const pid = Number(projectId);
  const { user } = useAuth();
  const utils = trpc.useUtils();

  const { data: project } = trpc.projects.get.useQuery({ id: pid });
  const { data: roles = [], isLoading: rolesLoading } = trpc.roles.list.useQuery({ projectId: pid });
  const { data: members = [] } = trpc.projects.members.useQuery({ projectId: pid });
  const { data: memberRoles = [] } = trpc.roles.memberRoles.useQuery({ projectId: pid });

  const [showRoleDialog, setShowRoleDialog] = useState(false);
  const [editingRole, setEditingRole] = useState<null | { id: number; name: string; isLeader: boolean; canApprove: boolean; color: string }>(null);
  const [roleForm, setRoleForm] = useState({ name: "", isLeader: false, canApprove: false, color: "#6366f1" });

  const createRole = trpc.roles.create.useMutation({
    onSuccess: () => {
      utils.roles.list.invalidate({ projectId: pid });
      setShowRoleDialog(false);
      setRoleForm({ name: "", isLeader: false, canApprove: false, color: "#6366f1" });
      toast.success("Função criada com sucesso!");
    },
    onError: (e) => toast.error(e.message),
  });

  const updateRole = trpc.roles.update.useMutation({
    onSuccess: () => {
      utils.roles.list.invalidate({ projectId: pid });
      setShowRoleDialog(false);
      setEditingRole(null);
      toast.success("Função atualizada!");
    },
    onError: (e) => toast.error(e.message),
  });

  const deleteRole = trpc.roles.delete.useMutation({
    onSuccess: () => {
      utils.roles.list.invalidate({ projectId: pid });
      utils.roles.memberRoles.invalidate({ projectId: pid });
      toast.success("Função removida.");
    },
    onError: (e) => toast.error(e.message),
  });

  const assignRole = trpc.roles.assign.useMutation({
    onSuccess: () => {
      utils.roles.memberRoles.invalidate({ projectId: pid });
      toast.success("Função atribuída!");
    },
    onError: (e) => toast.error(e.message),
  });

  const unassignRole = trpc.roles.unassign.useMutation({
    onSuccess: () => {
      utils.roles.memberRoles.invalidate({ projectId: pid });
      toast.success("Função removida do membro.");
    },
    onError: (e) => toast.error(e.message),
  });

  const openCreate = () => {
    setEditingRole(null);
    setRoleForm({ name: "", isLeader: false, canApprove: false, color: "#6366f1" });
    setShowRoleDialog(true);
  };

  const openEdit = (role: typeof roles[0]) => {
    setEditingRole({ id: role.id, name: role.name, isLeader: role.isLeader, canApprove: role.canApprove, color: role.color ?? "#6366f1" });
    setRoleForm({ name: role.name, isLeader: role.isLeader, canApprove: role.canApprove, color: role.color ?? "#6366f1" });
    setShowRoleDialog(true);
  };

  const handleSaveRole = () => {
    if (!roleForm.name.trim()) { toast.error("Nome da função é obrigatório"); return; }
    if (editingRole) {
      updateRole.mutate({ id: editingRole.id, projectId: pid, ...roleForm });
    } else {
      createRole.mutate({ projectId: pid, ...roleForm });
    }
  };

  const getMemberRole = (userId: number) => memberRoles.find(mr => mr.userId === userId);

  const PRESET_COLORS = ["#6366f1", "#8b5cf6", "#ec4899", "#f59e0b", "#10b981", "#3b82f6", "#ef4444", "#64748b"];

  return (
    <AppLayout>
      <div className="max-w-5xl mx-auto px-4 py-8 space-y-8">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Link href={`/projects/${pid}`}>
            <Button variant="ghost" size="sm" className="gap-2 text-slate-500 hover:text-slate-800">
              <ArrowLeft className="w-4 h-4" /> Voltar ao Projeto
            </Button>
          </Link>
        </div>

        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
              <Shield className="w-6 h-6 text-indigo-600" />
              Funções e Papéis
            </h1>
            <p className="text-slate-500 mt-1">
              Gerencie as funções personalizadas do projeto <span className="font-medium text-slate-700">{project?.name}</span>
            </p>
          </div>
          <Button onClick={openCreate} className="gap-2 bg-indigo-600 hover:bg-indigo-700 text-white">
            <Plus className="w-4 h-4" /> Nova Função
          </Button>
        </div>

        {/* Info card about approval flow */}
        <Card className="border-amber-200 bg-amber-50">
          <CardContent className="pt-4 pb-4">
            <div className="flex gap-3">
              <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-amber-800">
                <p className="font-semibold mb-1">Como funciona o fluxo de aprovação</p>
                <p>Membros com a função de <strong>Líder</strong> (ou com permissão de aprovação) podem mover tarefas do status <em>Compartilhado</em> para <em>Publicado</em> ou <em>Arquivado</em>. Apenas eles têm autoridade para aprovar entregas.</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Roles list */}
          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
              <Crown className="w-5 h-5 text-amber-500" /> Funções Definidas
            </h2>
            {rolesLoading ? (
              <div className="space-y-3">
                {[1, 2, 3].map(i => <div key={i} className="h-20 bg-slate-100 rounded-xl animate-pulse" />)}
              </div>
            ) : roles.length === 0 ? (
              <Card className="border-dashed border-2 border-slate-200">
                <CardContent className="py-10 text-center text-slate-400">
                  <Shield className="w-10 h-10 mx-auto mb-3 opacity-30" />
                  <p className="font-medium">Nenhuma função criada</p>
                  <p className="text-sm mt-1">Crie funções como "Líder", "Designer", "Desenvolvedor" etc.</p>
                  <Button onClick={openCreate} variant="outline" size="sm" className="mt-4 gap-2">
                    <Plus className="w-4 h-4" /> Criar primeira função
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3">
                {roles.map(role => (
                  <Card key={role.id} className="border border-slate-200 hover:border-slate-300 transition-colors">
                    <CardContent className="py-4 px-5">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: role.color ?? "#6366f1" }} />
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-semibold text-slate-800">{role.name}</span>
                              {role.isLeader && (
                                <Badge className="text-xs bg-amber-100 text-amber-700 border-amber-200 gap-1">
                                  <Crown className="w-3 h-3" /> Líder
                                </Badge>
                              )}
                              {role.canApprove && !role.isLeader && (
                                <Badge className="text-xs bg-green-100 text-green-700 border-green-200 gap-1">
                                  <CheckCircle2 className="w-3 h-3" /> Pode Aprovar
                                </Badge>
                              )}
                            </div>
                            <p className="text-xs text-slate-400 mt-0.5">
                              {role.isLeader ? "Pode aprovar e mover tarefas compartilhadas" : role.canApprove ? "Pode aprovar tarefas" : "Membro padrão"}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-1">
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-indigo-600" onClick={() => openEdit(role)}>
                            <Pencil className="w-3.5 h-3.5" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-red-500"
                            onClick={() => deleteRole.mutate({ id: role.id, projectId: pid })}>
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>

          {/* Member role assignment */}
          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
              <Users className="w-5 h-5 text-indigo-500" /> Atribuição por Membro
            </h2>
            {members.length === 0 ? (
              <Card className="border-dashed border-2 border-slate-200">
                <CardContent className="py-10 text-center text-slate-400">
                  <Users className="w-10 h-10 mx-auto mb-3 opacity-30" />
                  <p className="font-medium">Nenhum membro no projeto</p>
                  <p className="text-sm mt-1">Adicione membros na página do projeto primeiro.</p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3">
                {members.map(member => {
                  const currentRole = getMemberRole(member.userId);
                  return (
                    <Card key={member.userId} className="border border-slate-200">
                      <CardContent className="py-4 px-5">
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="w-9 h-9 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 font-semibold text-sm flex-shrink-0">
                              {(member.userName ?? member.userEmail ?? "?")[0].toUpperCase()}
                            </div>
                            <div className="min-w-0">
                              <p className="font-medium text-slate-800 truncate">{member.userName ?? member.userEmail ?? `Usuário ${member.userId}`}</p>
                              <p className="text-xs text-slate-400 truncate">{member.userEmail ?? ""}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 flex-shrink-0">
                            {currentRole?.roleName && (
                              <div className="w-2 h-2 rounded-full" style={{ backgroundColor: currentRole.color ?? "#6366f1" }} />
                            )}
                            <Select
                              value={currentRole?.roleId?.toString() ?? "none"}
                              onValueChange={(val) => {
                                if (val === "none") {
                                  unassignRole.mutate({ projectId: pid, userId: member.userId });
                                } else {
                                  assignRole.mutate({ projectId: pid, userId: member.userId, roleId: Number(val) });
                                }
                              }}
                            >
                              <SelectTrigger className="w-40 h-8 text-sm border-slate-200">
                                <SelectValue placeholder="Sem função" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="none">Sem função</SelectItem>
                                {roles.map(role => (
                                  <SelectItem key={role.id} value={role.id.toString()}>
                                    <div className="flex items-center gap-2">
                                      <div className="w-2 h-2 rounded-full" style={{ backgroundColor: role.color ?? "#6366f1" }} />
                                      {role.name}
                                    </div>
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Create/Edit Role Dialog */}
      <Dialog open={showRoleDialog} onOpenChange={setShowRoleDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editingRole ? "Editar Função" : "Nova Função"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-5 py-2">
            <div className="space-y-2">
              <Label>Nome da Função</Label>
              <Input
                placeholder="Ex: Líder de Equipe, Designer, Desenvolvedor..."
                value={roleForm.name}
                onChange={e => setRoleForm(f => ({ ...f, name: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Cor de Identificação</Label>
              <div className="flex items-center gap-3">
                <div className="flex gap-2 flex-wrap">
                  {PRESET_COLORS.map(c => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setRoleForm(f => ({ ...f, color: c }))}
                      className={`w-7 h-7 rounded-full transition-all ${roleForm.color === c ? "ring-2 ring-offset-2 ring-slate-400 scale-110" : "hover:scale-105"}`}
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </div>
                <input
                  type="color"
                  value={roleForm.color}
                  onChange={e => setRoleForm(f => ({ ...f, color: e.target.value }))}
                  className="w-8 h-8 rounded cursor-pointer border border-slate-200"
                  title="Cor personalizada"
                />
              </div>
            </div>
            <div className="space-y-3">
              <Label>Permissões</Label>
              <div className="space-y-3 bg-slate-50 rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-slate-700 flex items-center gap-2">
                      <Crown className="w-4 h-4 text-amber-500" /> Líder da Equipe
                    </p>
                    <p className="text-xs text-slate-500 mt-0.5">Pode aprovar tarefas e mover de Compartilhado para Publicado/Arquivado</p>
                  </div>
                  <Switch
                    checked={roleForm.isLeader}
                    onCheckedChange={v => setRoleForm(f => ({ ...f, isLeader: v, canApprove: v ? true : f.canApprove }))}
                  />
                </div>
                <div className="border-t border-slate-200" />
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-slate-700 flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-green-500" /> Pode Aprovar
                    </p>
                    <p className="text-xs text-slate-500 mt-0.5">Permissão para aprovar tarefas compartilhadas</p>
                  </div>
                  <Switch
                    checked={roleForm.canApprove || roleForm.isLeader}
                    disabled={roleForm.isLeader}
                    onCheckedChange={v => setRoleForm(f => ({ ...f, canApprove: v }))}
                  />
                </div>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRoleDialog(false)}>Cancelar</Button>
            <Button
              onClick={handleSaveRole}
              disabled={createRole.isPending || updateRole.isPending}
              className="bg-indigo-600 hover:bg-indigo-700 text-white"
            >
              {editingRole ? "Salvar Alterações" : "Criar Função"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
