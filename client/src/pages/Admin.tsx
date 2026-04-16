import { useState, useEffect, useRef } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import AppLayout from "@/components/AppLayout";
import { SplitLayout, SplitPanelHeader, SplitPanelContent } from "@/components/SplitLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Plus, Trash2, Edit2, Users, Building2, Tag, Globe, Archive, RotateCcw,
  ClipboardList, User, Layers, Loader2,
} from "lucide-react";

const COUNTRIES = [
  "Brasil","Argentina","Chile","Colombia","Peru","Uruguai","Paraguai","Bolivia","Venezuela","Ecuador",
  "Estados Unidos","Canada","Mexico","Portugal","Espanha","Franca","Alemanha","Italia","Reino Unido","Holanda",
  "Angola","Mocambique","Africa do Sul","Nigeria","Kenya","Etiopia","Tanzania","Ghana","Senegal","Costa do Marfim",
  "China","Japao","India","Coreia do Sul","Indonesia","Malasia","Tailandia","Vietnam","Filipinas","Paquistao",
  "Australia","Nova Zelandia","Arabia Saudita","Emirados Arabes","Qatar","Kuwait","Bahrein","Oman","Jordania","Egito",
];

const ROLES = [
  { value: "user", label: "Usuario" },
  { value: "leader", label: "Lider" },
  { value: "admin", label: "Admin" },
];

const ACTION_LABELS: Record<string, string> = {
  created_task: "Criou tarefa",
  updated_task: "Atualizou tarefa",
  deleted_task: "Excluiu tarefa",
  moved_task: "Moveu tarefa",
  created_client: "Criou cliente",
  updated_client: "Atualizou cliente",
  deleted_client: "Excluiu cliente",
  created_crs: "Criou contrato",
  updated_crs: "Atualizou contrato",
  archived_crs: "Arquivou contrato",
  restored_crs: "Restaurou contrato",
  created_checklist_item: "Criou item de checklist",
  updated_checklist_item: "Atualizou checklist",
  deleted_checklist_item: "Excluiu checklist",
  updated_checklist_status: "Alterou status de checklist",
  login: "Login",
  logout: "Logout",
};

// ── UserDisciplinesDialog ────────────────────────────────────────────────────
function UserDisciplinesDialog({
  user: targetUser,
  disciplines,
  onClose,
}: {
  user: any;
  disciplines: any[];
  onClose: () => void;
}) {
  const utils = trpc.useUtils();
  const discQ = trpc.users.getDisciplines.useQuery({ userId: targetUser.id });
  const setDiscM = trpc.users.setDisciplines.useMutation({
    onSuccess: () => {
      utils.users.getDisciplines.invalidate({ userId: targetUser.id });
      toast.success("Disciplinas atualizadas!");
      onClose();
    },
    onError: (e) => toast.error(e.message),
  });

  const [selected, setSelected] = useState<string[]>([]);

  // Sync when data loads — use useEffect to avoid setState-in-render (React 19 error)
  const syncedRef = useRef(false);
  useEffect(() => {
    if (!syncedRef.current && discQ.data) {
      setSelected((discQ.data ?? []).map((d: any) => d.disciplineName));
      syncedRef.current = true;
    }
  }, [discQ.data]);

  function toggle(name: string) {
    setSelected((prev) =>
      prev.includes(name) ? prev.filter((n) => n !== name) : [...prev, name]
    );
  }

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Layers className="w-4 h-4" />
            Disciplinas de {targetUser.name ?? targetUser.email}
          </DialogTitle>
        </DialogHeader>
        {discQ.isLoading ? (
          <div className="flex justify-center py-6"><Loader2 className="w-5 h-5 animate-spin text-primary" /></div>
        ) : (
          <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
            {disciplines.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">Nenhuma disciplina cadastrada</p>
            )}
            {disciplines.map((d: any) => (
              <label key={d.id} className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-muted/50 cursor-pointer">
                <Checkbox
                  checked={selected.includes(d.name)}
                  onCheckedChange={() => toggle(d.name)}
                />
                <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: d.color ?? "#6366f1" }} />
                <span className="text-sm font-medium text-foreground">{d.name}</span>
              </label>
            ))}
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button
            onClick={() => setDiscM.mutate({ userId: targetUser.id, disciplines: selected })}
            disabled={setDiscM.isPending}
          >
            {setDiscM.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function Admin() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin" || user?.role === "master_admin";

  // Clients state
  const [showClientDialog, setShowClientDialog] = useState(false);
  const [editingClient, setEditingClient] = useState<any>(null);
  const [clientForm, setClientForm] = useState({ name: "", color: "#785500", country: "Brasil", notes: "" });

  // CRS state
  const [showCrsDialog, setShowCrsDialog] = useState(false);
  const [editingCrs, setEditingCrs] = useState<any>(null);
  const [crsForm, setCrsForm] = useState({ clientId: "", name: "", code: "", country: "Brasil", state: "", description: "" });
  const [showArchivedCrs, setShowArchivedCrs] = useState(false);

  // Disciplines state
  const [showDisciplineDialog, setShowDisciplineDialog] = useState(false);
  const [disciplineForm, setDisciplineForm] = useState({ name: "", color: "#785500", description: "" });

  // Users state
  const [editingUserRole, setEditingUserRole] = useState<{ id: number; role: string } | null>(null);
  const [editingUserDisc, setEditingUserDisc] = useState<any>(null);

  // Registros state
  const [registrosFilter, setRegistrosFilter] = useState("all");

  const clientsQ = trpc.clients.list.useQuery();
  const crsQ = trpc.crs.list.useQuery();
  const archivedCrsQ = trpc.crs.listArchived.useQuery(undefined, { enabled: showArchivedCrs });
  const disciplinesQ = trpc.disciplines.list.useQuery();
  const usersQ = trpc.users.list.useQuery();
  const registrosQ = trpc.registros.list.useQuery({
    limit: 300,
    entityType: registrosFilter !== "all" ? registrosFilter : undefined,
  });
  const utils = trpc.useUtils();

  // Client mutations
  const createClientM = trpc.clients.create.useMutation({
    onSuccess: () => { utils.clients.list.invalidate(); setShowClientDialog(false); setClientForm({ name: "", color: "#785500", country: "Brasil", notes: "" }); toast.success("Cliente criado!"); },
    onError: (e) => toast.error("Erro: " + e.message),
  });
  const updateClientM = trpc.clients.update.useMutation({
    onSuccess: () => { utils.clients.list.invalidate(); setShowClientDialog(false); setEditingClient(null); toast.success("Cliente atualizado!"); },
    onError: (e) => toast.error("Erro: " + e.message),
  });
  const deleteClientM = trpc.clients.delete.useMutation({
    onSuccess: () => { utils.clients.list.invalidate(); toast.success("Cliente excluido"); },
    onError: (e) => toast.error("Erro: " + e.message),
  });

  // CRS mutations
  const createCrsM = trpc.crs.create.useMutation({
    onSuccess: () => { utils.crs.list.invalidate(); setShowCrsDialog(false); setCrsForm({ clientId: "", name: "", code: "", country: "Brasil", state: "", description: "" }); toast.success("CRS criado!"); },
    onError: (e) => toast.error("Erro: " + e.message),
  });
  const updateCrsM = trpc.crs.update.useMutation({
    onSuccess: () => { utils.crs.list.invalidate(); setShowCrsDialog(false); setEditingCrs(null); toast.success("CRS atualizado!"); },
    onError: (e) => toast.error("Erro: " + e.message),
  });
  const archiveCrsM = trpc.crs.archive.useMutation({
    onSuccess: () => { utils.crs.list.invalidate(); utils.crs.listArchived.invalidate(); toast.success("CRS arquivado"); },
  });
  const restoreCrsM = trpc.crs.restore.useMutation({
    onSuccess: () => { utils.crs.list.invalidate(); utils.crs.listArchived.invalidate(); toast.success("CRS restaurado!"); },
  });

  // Discipline mutations
  const createDisciplineM = trpc.disciplines.create.useMutation({
    onSuccess: () => { utils.disciplines.list.invalidate(); setShowDisciplineDialog(false); setDisciplineForm({ name: "", color: "#785500", description: "" }); toast.success("Disciplina criada!"); },
    onError: (e) => toast.error("Erro: " + e.message),
  });
  const deleteDisciplineM = trpc.disciplines.delete.useMutation({
    onSuccess: () => { utils.disciplines.list.invalidate(); toast.success("Disciplina excluida"); },
  });

  // User role mutation
  const updateRoleM = trpc.users.updateRole.useMutation({
    onSuccess: () => { utils.users.list.invalidate(); setEditingUserRole(null); toast.success("Funcao atualizada!"); },
    onError: (e) => toast.error("Erro: " + e.message),
  });

  const clients = (clientsQ.data ?? []) as any[];
  const crsList = (crsQ.data ?? []) as any[];
  const archivedCrsList = (archivedCrsQ.data ?? []) as any[];
  const disciplines = (disciplinesQ.data ?? []) as any[];
  const users = (usersQ.data ?? []) as any[];
  const registros = (registrosQ.data ?? []) as any[];

  if (!isAdmin) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-64">
          <p className="text-muted-foreground">Acesso restrito a administradores.</p>
        </div>
      </AppLayout>
    );
  }

  const openEditClient = (client: any) => {
    setEditingClient(client);
    setClientForm({ name: client.name, color: client.color ?? "#785500", country: client.country ?? "Brasil", notes: client.notes ?? "" });
    setShowClientDialog(true);
  };

  const openEditCrs = (crs: any) => {
    setEditingCrs(crs);
    setCrsForm({ clientId: String(crs.clientId), name: crs.name, code: crs.code ?? "", country: crs.country ?? "Brasil", state: crs.state ?? "", description: crs.description ?? "" });
    setShowCrsDialog(true);
  };

  const handleSaveClient = () => {
    if (!clientForm.name.trim()) return;
    if (editingClient) {
      updateClientM.mutate({ id: editingClient.id, ...clientForm });
    } else {
      createClientM.mutate(clientForm);
    }
  };

  const handleSaveCrs = () => {
    if (!crsForm.name.trim() || !crsForm.clientId) return;
    if (editingCrs) {
      updateCrsM.mutate({ id: editingCrs.id, name: crsForm.name, code: crsForm.code, description: crsForm.description, country: crsForm.country, state: crsForm.state });
    } else {
      createCrsM.mutate({ ...crsForm, clientId: Number(crsForm.clientId) });
    }
  };

  const [adminTab, setAdminTab] = useState("clients");

  const adminMenuItems = [
    { value: "clients",     icon: Building2,     label: "Clientes" },
    { value: "crs",         icon: Globe,         label: "Contratos" },
    { value: "disciplines", icon: Tag,           label: "Disciplinas" },
    { value: "users",       icon: Users,         label: "Usuários" },
    { value: "registros",   icon: ClipboardList, label: "Registros" },
  ];

  return (
    <AppLayout fullHeight>
      <SplitLayout
        leftWidth="200px"
        left={
          <>
            <SplitPanelHeader title="Administração" subtitle="Configurações" />
            <SplitPanelContent noPadding>
              <nav className="space-y-0.5 p-2">
                {adminMenuItems.map(({ value, icon: Icon, label }) => (
                  <button
                    key={value}
                    onClick={() => setAdminTab(value)}
                    className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                      adminTab === value
                        ? "bg-primary text-primary-foreground"
                        : "text-muted-foreground hover:bg-muted hover:text-foreground"
                    }`}
                  >
                    <Icon className="w-4 h-4 shrink-0" />
                    {label}
                  </button>
                ))}
              </nav>
            </SplitPanelContent>
          </>
        }
        right={
          <SplitPanelContent noPadding>
            <div className="p-5 overflow-y-auto h-full">
        <Tabs value={adminTab} onValueChange={setAdminTab}>
          <TabsList className="sr-only">
            <TabsTrigger value="clients">Clientes</TabsTrigger>
            <TabsTrigger value="crs">Contrato</TabsTrigger>
            <TabsTrigger value="disciplines">Disciplinas</TabsTrigger>
            <TabsTrigger value="users">Usuários</TabsTrigger>
            <TabsTrigger value="registros">Registros</TabsTrigger>
          </TabsList>

          {/* CLIENTS TAB */}
          <TabsContent value="clients">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-foreground">Clientes ({clients.length})</h2>
              <Button size="sm" onClick={() => { setEditingClient(null); setClientForm({ name: "", color: "#785500", country: "Brasil", notes: "" }); setShowClientDialog(true); }}>
                <Plus className="w-4 h-4 mr-1" />Novo Cliente
              </Button>
            </div>
            <div className="grid gap-3">
              {clients.map((client: any) => (
                <div key={client.id} className="flex items-center gap-3 p-4 bg-card border border-border rounded-xl">
                  <span className="w-4 h-4 rounded-full shrink-0" style={{ background: client.color ?? "#785500" }} />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-foreground">{client.name}</p>
                    <p className="text-xs text-muted-foreground">{client.country ?? "---"} {client.notes ? " · " + client.notes : ""}</p>
                  </div>
                  <Badge variant="outline" className="text-xs">{crsList.filter((c: any) => c.clientId === client.id).length} CRS</Badge>
                  <Button size="sm" variant="ghost" onClick={() => openEditClient(client)}><Edit2 className="w-4 h-4" /></Button>
                  <Button size="sm" variant="ghost" onClick={() => { if (confirm("Excluir cliente?")) deleteClientM.mutate({ id: client.id }); }} className="text-destructive hover:text-destructive">
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              ))}
              {clients.length === 0 && <p className="text-center text-muted-foreground py-8">Nenhum cliente cadastrado</p>}
            </div>
          </TabsContent>

          {/* CRS TAB */}
          <TabsContent value="crs">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-foreground">CRS ({crsList.length})</h2>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => setShowArchivedCrs(!showArchivedCrs)}>
                  <Archive className="w-4 h-4 mr-1" />{showArchivedCrs ? "Ocultar Arquivados" : "Ver Arquivados"}
                </Button>
                <Button size="sm" onClick={() => { setEditingCrs(null); setCrsForm({ clientId: "", name: "", code: "", country: "Brasil", state: "", description: "" }); setShowCrsDialog(true); }}>
                  <Plus className="w-4 h-4 mr-1" />Novo Contrato
                </Button>
              </div>
            </div>
            <div className="grid gap-3">
              {crsList.map((crs: any) => (
                <div key={crs.id} className="flex items-center gap-3 p-4 bg-card border border-border rounded-xl">
                  <span className="w-4 h-4 rounded-full shrink-0" style={{ background: crs.clientColor ?? "#785500" }} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-foreground">{crs.name}</p>
                      {crs.code && <Badge variant="outline" className="text-xs">{crs.code}</Badge>}
                    </div>
                    <p className="text-xs text-muted-foreground">{crs.clientName} · {crs.country ?? "---"}{crs.state ? ", " + crs.state : ""}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-xs font-bold text-primary">{Math.round(crs.progress ?? 0)}%</p>
                    <p className="text-xs text-muted-foreground">progresso</p>
                  </div>
                  <Button size="sm" variant="ghost" onClick={() => openEditCrs(crs)}><Edit2 className="w-4 h-4" /></Button>
                  <Button size="sm" variant="ghost" onClick={() => { if (confirm("Arquivar este CRS?")) archiveCrsM.mutate({ id: crs.id }); }} className="text-muted-foreground hover:text-orange-500">
                    <Archive className="w-4 h-4" />
                  </Button>
                </div>
              ))}
              {crsList.length === 0 && <p className="text-center text-muted-foreground py-8">Nenhum Contrato ativo</p>}
            </div>
            {showArchivedCrs && (
              <div className="mt-6">
                <h3 className="text-sm font-semibold text-muted-foreground mb-3 flex items-center gap-2">
                  <Archive className="w-4 h-4" />CRS Arquivados ({archivedCrsList.length})
                </h3>
                <div className="grid gap-3">
                  {archivedCrsList.map((crs: any) => (
                    <div key={crs.id} className="flex items-center gap-3 p-4 bg-muted/30 border border-border rounded-xl opacity-70">
                      <span className="w-4 h-4 rounded-full shrink-0 bg-muted-foreground/30" />
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-muted-foreground line-through">{crs.name}</p>
                        <p className="text-xs text-muted-foreground">{crs.clientName}</p>
                      </div>
                      <Button size="sm" variant="ghost" onClick={() => restoreCrsM.mutate({ id: crs.id })} className="text-primary hover:text-primary">
                        <RotateCcw className="w-4 h-4 mr-1" />Restaurar
                      </Button>
                    </div>
                  ))}
                  {archivedCrsList.length === 0 && <p className="text-center text-muted-foreground py-4 text-sm">Nenhum Contrato arquivado</p>}
                </div>
              </div>
            )}
          </TabsContent>

          {/* DISCIPLINES TAB */}
          <TabsContent value="disciplines">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-foreground">Disciplinas ({disciplines.length})</h2>
              <Button size="sm" onClick={() => { setDisciplineForm({ name: "", color: "#785500", description: "" }); setShowDisciplineDialog(true); }}>
                <Plus className="w-4 h-4 mr-1" />Nova Disciplina
              </Button>
            </div>
            <div className="grid gap-3">
              {disciplines.map((d: any) => (
                <div key={d.id} className="flex items-center gap-3 p-4 bg-card border border-border rounded-xl">
                  <span className="w-4 h-4 rounded-full shrink-0" style={{ background: d.color }} />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-foreground">{d.name}</p>
                    {d.description && <p className="text-xs text-muted-foreground">{d.description}</p>}
                  </div>
                  <Button size="sm" variant="ghost" onClick={() => { if (confirm("Excluir disciplina?")) deleteDisciplineM.mutate({ id: d.id }); }} className="text-destructive hover:text-destructive">
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              ))}
              {disciplines.length === 0 && <p className="text-center text-muted-foreground py-8">Nenhuma disciplina cadastrada</p>}
            </div>
          </TabsContent>

          {/* USERS TAB */}
          <TabsContent value="users">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-foreground">Usuários ({users.length})</h2>
            </div>
            <div className="grid gap-3">
              {users.map((u: any) => (
                <div key={u.id} className="flex items-center gap-3 p-4 bg-card border border-border rounded-xl">
                  <div className="w-9 h-9 rounded-full bg-primary/20 text-primary flex items-center justify-center font-semibold text-sm shrink-0">
                    {(u.name ?? u.email ?? "?")[0].toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-foreground">{u.name ?? "Sem nome"}</p>
                    <p className="text-xs text-muted-foreground">{u.email}</p>
                  </div>
                  {editingUserRole?.id === u.id ? (
                    <div className="flex items-center gap-2">
                      <Select value={editingUserRole!.role} onValueChange={(v) => setEditingUserRole(prev => prev ? { ...prev, role: v } : null)}>
                        <SelectTrigger className="h-8 w-28 text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>{ROLES.map((r) => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}</SelectContent>
                      </Select>
                      <Button size="sm" onClick={() => { if (editingUserRole) updateRoleM.mutate({ userId: editingUserRole.id, role: editingUserRole.role as any }); }} disabled={updateRoleM.isPending}>Salvar</Button>
                      <Button size="sm" variant="outline" onClick={() => setEditingUserRole(null)}>Cancelar</Button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <Badge variant={u.role === "admin" || u.role === "master_admin" ? "default" : "outline"} className="text-xs capitalize">{u.role}</Badge>
                      <Button size="sm" variant="ghost" title="Gerenciar disciplinas" onClick={() => setEditingUserDisc(u)}>
                        <Layers className="w-4 h-4" />
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setEditingUserRole({ id: u.id, role: u.role })}>
                        <Edit2 className="w-4 h-4" />
                      </Button>
                    </div>
                  )}
                </div>
              ))}
              {users.length === 0 && <p className="text-center text-muted-foreground py-8">Nenhum usuário encontrado</p>}
            </div>
          </TabsContent>

          {/* REGISTROS TAB */}
          <TabsContent value="registros">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-foreground">
                Registros de Auditoria
                {registros.length > 0 && <span className="ml-2 text-sm font-normal text-muted-foreground">({registros.length})</span>}
              </h2>
              <Select value={registrosFilter} onValueChange={setRegistrosFilter}>
                <SelectTrigger className="w-44 h-8 text-sm">
                  <SelectValue placeholder="Filtrar por tipo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os tipos</SelectItem>
                  <SelectItem value="task">Tarefas</SelectItem>
                  <SelectItem value="checklist_item">Checklist</SelectItem>
                  <SelectItem value="client">Clientes</SelectItem>
                  <SelectItem value="crs">Contratos</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {registrosQ.isLoading ? (
              <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
            ) : registros.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <ClipboardList className="w-10 h-10 mx-auto mb-3 opacity-30" />
                <p>Nenhum registro encontrado</p>
              </div>
            ) : (
              <div className="space-y-1.5">
                {registros.map((r: any) => (
                  <div key={r.id} className="flex items-start gap-3 p-3 bg-card border border-border rounded-xl text-sm">
                    <div className="w-7 h-7 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0 mt-0.5">
                      <User className="w-3.5 h-3.5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-foreground">{r.userName ?? "Sistema"}</span>
                        <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                          {ACTION_LABELS[r.action] ?? r.action}
                        </Badge>
                        {r.entityType && (
                          <Badge variant="outline" className="text-[10px] px-1.5 py-0 capitalize">
                            {r.entityType}
                          </Badge>
                        )}
                      </div>
                      {r.metadata && (() => {
                        try {
                          const meta = typeof r.metadata === "string" ? JSON.parse(r.metadata) : r.metadata;
                          const label = meta.title ?? meta.name ?? meta.taskTitle ?? meta.checklistTitle ?? "";
                          return label ? <p className="text-xs text-muted-foreground mt-0.5 truncate">"{label}"</p> : null;
                        } catch { return null; }
                      })()}
                    </div>
                    <span className="text-xs text-muted-foreground shrink-0 mt-0.5">
                      {r.createdAt
                        ? formatDistanceToNow(new Date(r.createdAt), { addSuffix: true, locale: ptBR })
                        : "—"}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
            </div>
          </SplitPanelContent>
        }
      />

      {/* User Disciplines Dialog */}
      {editingUserDisc && (
        <UserDisciplinesDialog
          user={editingUserDisc}
          disciplines={disciplines}
          onClose={() => setEditingUserDisc(null)}
        />
      )}

      {/* Client Dialog */}
      <Dialog open={showClientDialog} onOpenChange={(o) => { setShowClientDialog(o); if (!o) setEditingClient(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{editingClient ? "Editar Cliente" : "Novo Cliente"}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><Label>Nome *</Label><Input value={clientForm.name} onChange={(e) => setClientForm({ ...clientForm, name: e.target.value })} placeholder="Nome do cliente" /></div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Cor</Label>
                <div className="flex gap-2 items-center">
                  <input type="color" value={clientForm.color} onChange={(e) => setClientForm({ ...clientForm, color: e.target.value })} className="w-10 h-9 rounded border border-border cursor-pointer" />
                  <Input value={clientForm.color} onChange={(e) => setClientForm({ ...clientForm, color: e.target.value })} className="flex-1 text-xs" />
                </div>
              </div>
              <div>
                <Label>País</Label>
                <Select value={clientForm.country} onValueChange={(v) => setClientForm({ ...clientForm, country: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{COUNTRIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div><Label>Observações</Label><Input value={clientForm.notes} onChange={(e) => setClientForm({ ...clientForm, notes: e.target.value })} placeholder="Observações opcionais" /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowClientDialog(false)}>Cancelar</Button>
            <Button onClick={handleSaveClient} disabled={!clientForm.name.trim() || createClientM.isPending || updateClientM.isPending}>
              {editingClient ? "Salvar" : "Criar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* CRS Dialog */}
      <Dialog open={showCrsDialog} onOpenChange={(o) => { setShowCrsDialog(o); if (!o) setEditingCrs(null); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{editingCrs ? "Editar Contrato" : "Novo Contrato"}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Cliente *</Label>
              <Select value={crsForm.clientId} onValueChange={(v) => setCrsForm({ ...crsForm, clientId: v })}>
                <SelectTrigger><SelectValue placeholder="Selecionar cliente" /></SelectTrigger>
                <SelectContent>{clients.map((c: any) => <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Nome *</Label><Input value={crsForm.name} onChange={(e) => setCrsForm({ ...crsForm, name: e.target.value })} placeholder="Nome do Contrato" /></div>
              <div><Label>Código</Label><Input value={crsForm.code} onChange={(e) => setCrsForm({ ...crsForm, code: e.target.value })} placeholder="Ex: CRS-001" /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>País</Label>
                <Select value={crsForm.country} onValueChange={(v) => setCrsForm({ ...crsForm, country: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{COUNTRIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label>Estado / Região</Label><Input value={crsForm.state} onChange={(e) => setCrsForm({ ...crsForm, state: e.target.value })} placeholder="Ex: São Paulo" /></div>
            </div>
            <div><Label>Descrição</Label><Input value={crsForm.description} onChange={(e) => setCrsForm({ ...crsForm, description: e.target.value })} placeholder="Descrição opcional" /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCrsDialog(false)}>Cancelar</Button>
            <Button onClick={handleSaveCrs} disabled={!crsForm.name.trim() || !crsForm.clientId || createCrsM.isPending || updateCrsM.isPending}>
              {editingCrs ? "Salvar" : "Criar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Discipline Dialog */}
      <Dialog open={showDisciplineDialog} onOpenChange={setShowDisciplineDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Nova Disciplina</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><Label>Nome *</Label><Input value={disciplineForm.name} onChange={(e) => setDisciplineForm({ ...disciplineForm, name: e.target.value })} placeholder="Nome da disciplina" /></div>
            <div>
              <Label>Cor</Label>
              <div className="flex gap-2 items-center">
                <input type="color" value={disciplineForm.color} onChange={(e) => setDisciplineForm({ ...disciplineForm, color: e.target.value })} className="w-10 h-9 rounded border border-border cursor-pointer" />
                <Input value={disciplineForm.color} onChange={(e) => setDisciplineForm({ ...disciplineForm, color: e.target.value })} className="flex-1 text-xs" />
              </div>
            </div>
            <div><Label>Descrição</Label><Input value={disciplineForm.description} onChange={(e) => setDisciplineForm({ ...disciplineForm, description: e.target.value })} placeholder="Descrição opcional" /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDisciplineDialog(false)}>Cancelar</Button>
            <Button onClick={() => { if (disciplineForm.name.trim()) createDisciplineM.mutate(disciplineForm); }} disabled={!disciplineForm.name.trim() || createDisciplineM.isPending}>Criar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
