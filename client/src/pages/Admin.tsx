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
  ClipboardList, User, Layers, Loader2, Palette, ShieldCheck,
} from "lucide-react";
import { UserAvatar, AvatarEditor } from "@/components/UserAvatar";
import { PresenceDot } from "@/components/PresenceDot";
import { normalizeCompanySlug } from "./admin-company-utils";

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
  const isMasterAdmin = user?.role === "master_admin";

  // Clients state
  const [showClientDialog, setShowClientDialog] = useState(false);
  const [editingClient, setEditingClient] = useState<any>(null);
  const [clientForm, setClientForm] = useState({ name: "", color: "#3b82f6", country: "Brasil", notes: "", crsCode: "" });

  // CRS state
  const [showCrsDialog, setShowCrsDialog] = useState(false);
  const [editingCrs, setEditingCrs] = useState<any>(null);
  const [crsForm, setCrsForm] = useState({ clientId: "", name: "", code: "", country: "Brasil", state: "", description: "" });
  const [showArchivedCrs, setShowArchivedCrs] = useState(false);

  // Disciplines state
  const [showDisciplineDialog, setShowDisciplineDialog] = useState(false);
  const [editingDiscipline, setEditingDiscipline] = useState<any>(null);
  const [disciplineForm, setDisciplineForm] = useState({ name: "", color: "#3b82f6", description: "" });

  // Companies state (Master Admin)
  const [showCompanyDialog, setShowCompanyDialog] = useState(false);
  const [editingCompany, setEditingCompany] = useState<any>(null);
  const [companyForm, setCompanyForm] = useState({ name: "", slug: "", color: "#102C2D" });

  // Users state
  const [showCreateUserDialog, setShowCreateUserDialog] = useState(false);
  const [createUserForm, setCreateUserForm] = useState({ name: "", email: "", password: "", role: "user", company: "" });
  const [editingUserRole, setEditingUserRole] = useState<{ id: number; role: string } | null>(null);
  const [editingUserDisc, setEditingUserDisc] = useState<any>(null);
  const [confirmDeleteUser, setConfirmDeleteUser] = useState<any>(null);
  const [editingUserAvatar, setEditingUserAvatar] = useState<any>(null);
  const [avatarForm, setAvatarForm] = useState({ avatarColor: "#3b82f6", avatarInitials: "" });

  // Registros state
  const [registrosFilter, setRegistrosFilter] = useState("all");

  // Custom domains state
  const [domainForm, setDomainForm] = useState({ companyId: "", domain: "" });
  const [domainSetup, setDomainSetup] = useState<{ id: number; domain: string; token: string; txtHost: string } | null>(null);

  const clientsQ = trpc.clients.list.useQuery();
  const companiesQ = trpc.companies.list.useQuery(undefined, { enabled: isMasterAdmin });
  const crsQ = trpc.crs.list.useQuery();
  const archivedCrsQ = trpc.crs.listArchived.useQuery(undefined, { enabled: showArchivedCrs });
  const disciplinesQ = trpc.disciplines.list.useQuery();
  const usersQ = trpc.users.list.useQuery();
  const registrosQ = trpc.registros.list.useQuery({
    limit: 300,
    entityType: registrosFilter !== "all" ? registrosFilter : undefined,
  });
  const domainsQ = trpc.tenant.listDomains.useQuery(undefined, { enabled: isAdmin });
  const utils = trpc.useUtils();

  // Client mutations
  const createClientM = trpc.clients.create.useMutation({
    onSuccess: () => { utils.clients.list.invalidate(); setShowClientDialog(false); setClientForm({ name: "", color: "#3b82f6", country: "Brasil", notes: "", crsCode: "" }); toast.success("Cliente criado!"); },
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

  // Company mutations (Master Admin)
  const createCompanyM = trpc.companies.create.useMutation({
    onSuccess: () => { utils.companies.list.invalidate(); setShowCompanyDialog(false); setCompanyForm({ name: "", slug: "", color: "#102C2D" }); toast.success("Empresa criada!"); },
    onError: (e) => toast.error("Erro: " + e.message),
  });
  const updateCompanyM = trpc.companies.update.useMutation({
    onSuccess: () => { utils.companies.list.invalidate(); setShowCompanyDialog(false); setEditingCompany(null); toast.success("Empresa atualizada!"); },
    onError: (e) => toast.error("Erro: " + e.message),
  });
  const deleteCompanyM = trpc.companies.delete.useMutation({
    onSuccess: () => { utils.companies.list.invalidate(); toast.success("Empresa excluída!"); },
    onError: (e) => toast.error("Erro: " + e.message),
  });

  const addDomainM = trpc.tenant.addDomain.useMutation({
    onSuccess: (data) => {
      utils.tenant.listDomains.invalidate();
      setDomainForm((current) => ({ ...current, domain: "" }));
      setDomainSetup({ id: data.id, domain: data.domain, token: data.verificationToken, txtHost: data.txtHost });
      toast.success("Domínio cadastrado. Configure o registro TXT antes de verificar.");
    },
    onError: (e) => toast.error("Erro ao cadastrar domínio: " + e.message),
  });
  const verifyDomainM = trpc.tenant.verifyDomain.useMutation({
    onSuccess: () => { utils.tenant.listDomains.invalidate(); setDomainSetup(null); toast.success("Domínio verificado com sucesso!"); },
    onError: (e) => toast.error("Verificação DNS: " + e.message),
  });
  const setPrimaryDomainM = trpc.tenant.setPrimary.useMutation({
    onSuccess: () => { utils.tenant.listDomains.invalidate(); toast.success("Domínio primário atualizado."); },
    onError: (e) => toast.error("Erro ao definir domínio primário: " + e.message),
  });
  const removeDomainM = trpc.tenant.removeDomain.useMutation({
    onSuccess: () => { utils.tenant.listDomains.invalidate(); toast.success("Domínio removido."); },
    onError: (e) => toast.error("Erro ao remover domínio: " + e.message),
  });
  const renewSslM = trpc.tenant.renewSsl.useMutation({
    onSuccess: () => { utils.tenant.listDomains.invalidate(); toast.success("Certificado SSL renovado com sucesso!"); },
    onError: (e) => toast.error("Erro ao renovar SSL: " + e.message),
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
    onSuccess: () => { utils.disciplines.list.invalidate(); setShowDisciplineDialog(false); setDisciplineForm({ name: "", color: "#3b82f6", description: "" }); toast.success("Disciplina criada!"); },
    onError: (e) => toast.error("Erro: " + e.message),
  });
  const updateDisciplineM = trpc.disciplines.update.useMutation({
    onSuccess: () => { utils.disciplines.list.invalidate(); setShowDisciplineDialog(false); setEditingDiscipline(null); toast.success("Disciplina atualizada!"); },
    onError: (e) => toast.error("Erro: " + e.message),
  });
  const deleteDisciplineM = trpc.disciplines.delete.useMutation({
    onSuccess: () => { utils.disciplines.list.invalidate(); toast.success("Disciplina excluida"); },
    onError: (e) => toast.error("Erro: " + e.message),
  });

  const createUserM = trpc.users.createUser.useMutation({
    onSuccess: () => {
      utils.users.list.invalidate();
      setShowCreateUserDialog(false);
      setCreateUserForm({ name: "", email: "", password: "", role: "user", company: "" });
      toast.success("Usuário criado com senha segura.");
    },
    onError: (e) => toast.error("Erro ao criar usuário: " + e.message),
  });

  // User avatar mutation
  const updateAvatarM = trpc.auth.updateUserAvatar.useMutation({
    onSuccess: () => { utils.users.list.invalidate(); setEditingUserAvatar(null); toast.success("Avatar atualizado!"); },
    onError: (e) => toast.error("Erro: " + e.message),
  });

  // User delete mutation
  const deleteUserM = trpc.users.delete.useMutation({
    onSuccess: () => { utils.users.list.invalidate(); setConfirmDeleteUser(null); toast.success("Usuário removido com sucesso."); },
    onError: (e) => toast.error("Erro: " + e.message),
  });

  // User role mutation
  const updateRoleM = trpc.users.updateRole.useMutation({
    onSuccess: () => { utils.users.list.invalidate(); setEditingUserRole(null); toast.success("Funcao atualizada!"); },
    onError: (e) => toast.error("Erro: " + e.message),
  });

  const clients = (clientsQ.data ?? []) as any[];
  const companies = (companiesQ.data ?? []) as any[];
  const crsList = (crsQ.data ?? []) as any[];
  const archivedCrsList = (archivedCrsQ.data ?? []) as any[];
  const disciplines = (disciplinesQ.data ?? []) as any[];
  const users = (usersQ.data ?? []) as any[];
  const registros = (registrosQ.data ?? []) as any[];
  const domainCompanies = isMasterAdmin ? companies : (user?.companyId ? [{ id: user.companyId, name: user.company ?? "Minha empresa" }] : []);

  useEffect(() => {
    if (!domainForm.companyId && domainCompanies.length > 0) {
      setDomainForm((current) => ({ ...current, companyId: String(domainCompanies[0].id) }));
    }
  }, [domainCompanies.length, domainForm.companyId]);

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
    setClientForm({ name: client.name, color: client.color ?? "#3b82f6", country: client.country ?? "Brasil", notes: client.notes ?? "", crsCode: client.crsCode ?? "" });
    setShowClientDialog(true);
  };

  const openEditCompany = (company: any) => {
    setEditingCompany(company);
    setCompanyForm({ name: company.name, slug: company.slug, color: company.color ?? "#102C2D" });
    setShowCompanyDialog(true);
  };

  const handleSaveCompany = () => {
    const name = companyForm.name.trim();
    const slug = normalizeCompanySlug(companyForm.slug);
    if (!name || !slug) return;
    if (editingCompany) {
      updateCompanyM.mutate({ id: editingCompany.id, name, slug, color: companyForm.color });
    } else {
      createCompanyM.mutate({ name, slug, color: companyForm.color });
    }
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

  const handleCreateUser = () => {
    const name = createUserForm.name.trim();
    const email = createUserForm.email.trim();
    if (!name || !email || createUserForm.password.length < 6) return;
    createUserM.mutate({
      name,
      email,
      password: createUserForm.password,
      role: createUserForm.role as "user" | "admin" | "leader",
      company: createUserForm.company.trim() || undefined,
    });
  };

  const [adminTab, setAdminTab] = useState("clients");

  const adminMenuItems = [
    ...(isMasterAdmin ? [{ value: "companies", icon: Building2, label: "Empresas" }] : []),
    { value: "clients",     icon: Building2,     label: "Clientes" },
    { value: "crs",         icon: Globe,         label: "Contratos" },
    { value: "disciplines", icon: Tag,           label: "Disciplinas" },
    { value: "users",       icon: Users,         label: "Usuários" },
    { value: "registros",   icon: ClipboardList, label: "Registros" },
    { value: "domains",     icon: Globe,         label: "Domínios" },
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
            {isMasterAdmin && <TabsTrigger value="companies">Empresas</TabsTrigger>}
            <TabsTrigger value="clients">Clientes</TabsTrigger>
            <TabsTrigger value="crs">Contrato</TabsTrigger>
            <TabsTrigger value="disciplines">Disciplinas</TabsTrigger>
            <TabsTrigger value="users">Usuários</TabsTrigger>
            <TabsTrigger value="registros">Registros</TabsTrigger>
            <TabsTrigger value="domains">Domínios</TabsTrigger>
          </TabsList>

          {/* COMPANIES TAB — Master Admin only */}
          {isMasterAdmin && (
            <TabsContent value="companies">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-lg font-semibold text-foreground">Empresas ({companies.length})</h2>
                  <p className="text-xs text-muted-foreground">Organizações que isolam usuários, contratos e tarefas.</p>
                </div>
                <Button size="sm" onClick={() => { setEditingCompany(null); setCompanyForm({ name: "", slug: "", color: "#102C2D" }); setShowCompanyDialog(true); }}>
                  <Plus className="w-4 h-4 mr-1" />Nova Empresa
                </Button>
              </div>
              <div className="grid gap-3">
                {companies.map((company: any) => (
                  <div key={company.id} className="flex items-center gap-3 p-4 bg-card border border-border rounded-xl">
                    <span className="w-4 h-4 rounded-full shrink-0" style={{ background: company.color ?? "#102C2D" }} />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-foreground truncate">{company.name}</p>
                      <p className="text-xs text-muted-foreground font-mono truncate">{company.slug}</p>
                    </div>
                    <Badge variant="outline" className="text-xs">ID {company.id}</Badge>
                    <Button size="sm" variant="ghost" onClick={() => openEditCompany(company)} title="Editar empresa"><Edit2 className="w-4 h-4" /></Button>
                    <Button size="sm" variant="ghost" onClick={() => { if (confirm(`Excluir a empresa ${company.name}?`)) deleteCompanyM.mutate({ id: company.id }); }} className="text-destructive hover:text-destructive" title="Excluir empresa"><Trash2 className="w-4 h-4" /></Button>
                  </div>
                ))}
                {companies.length === 0 && <p className="text-center text-muted-foreground py-8">Nenhuma empresa cadastrada</p>}
              </div>
            </TabsContent>
          )}

          {/* CLIENTS TAB */}
          <TabsContent value="clients">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-foreground">Clientes ({clients.length})</h2>
              <Button size="sm" onClick={() => { setEditingClient(null); setClientForm({ name: "", color: "#3b82f6", country: "Brasil", notes: "", crsCode: "" }); setShowClientDialog(true); }}>
                <Plus className="w-4 h-4 mr-1" />Novo Cliente
              </Button>
            </div>
            <div className="grid gap-3">
              {clients.map((client: any) => (
                <div key={client.id} className="flex items-center gap-3 p-4 bg-card border border-border rounded-xl">
                  <span className="w-4 h-4 rounded-full shrink-0" style={{ background: client.color ?? "#3b82f6" }} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-foreground">{client.name}</p>
                      {client.crsCode && <Badge variant="outline" className="text-xs font-mono">{client.crsCode}</Badge>}
                    </div>
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
                  <span className="w-4 h-4 rounded-full shrink-0" style={{ background: crs.clientColor ?? "#3b82f6" }} />
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
              <Button size="sm" onClick={() => { setEditingDiscipline(null); setDisciplineForm({ name: "", color: "#3b82f6", description: "" }); setShowDisciplineDialog(true); }}>
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
                  <div className="flex items-center gap-1">
                    <Button size="sm" variant="ghost" title="Editar disciplina" onClick={() => { setEditingDiscipline(d); setDisciplineForm({ name: d.name ?? "", color: d.color ?? "#3b82f6", description: d.description ?? "" }); setShowDisciplineDialog(true); }}>
                      <Edit2 className="w-4 h-4" />
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => { if (confirm("Excluir disciplina?")) deleteDisciplineM.mutate({ id: d.id }); }} className="text-destructive hover:text-destructive">
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ))}
              {disciplines.length === 0 && <p className="text-center text-muted-foreground py-8">Nenhuma disciplina cadastrada</p>}
            </div>
          </TabsContent>

          {/* USERS TAB */}
          <TabsContent value="users">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-foreground">Usuários ({users.length})</h2>
              <Button size="sm" onClick={() => { setCreateUserForm({ name: "", email: "", password: "", role: "user", company: "" }); setShowCreateUserDialog(true); }}>
                <Plus className="w-4 h-4 mr-1" />Novo Usuário
              </Button>
            </div>
            <div className="grid gap-3">
              {users.map((u: any) => (
                <div key={u.id} className="flex items-center gap-3 p-4 bg-card border border-border rounded-xl">
                  <div className="relative shrink-0">
                    <UserAvatar user={u} size="md" />
                    <PresenceDot className="absolute -right-1 -top-0.5" lastSeenAt={u.lastSeenAt} />
                    {/* Discipline dots */}
                    {(() => {
                      const discData = disciplinesQ.data as any[];
                      const userDiscData = (u.disciplines ?? []) as string[];
                      const matched = (discData ?? []).filter((d: any) => userDiscData.includes(d.name));
                      if (matched.length === 0) return null;
                      return (
                        <div className="absolute -bottom-1 -right-1 flex gap-0.5">
                          {matched.slice(0, 3).map((d: any) => (
                            <span key={d.id} className="w-2.5 h-2.5 rounded-full border border-background" style={{ backgroundColor: d.color ?? "#6366f1" }} title={d.name} />
                          ))}
                        </div>
                      );
                    })()}
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
                      <Button size="sm" variant="ghost" title="Editar avatar" onClick={() => { setEditingUserAvatar(u); setAvatarForm({ avatarColor: u.avatarColor ?? "#3b82f6", avatarInitials: u.avatarInitials ?? "" }); }}>
                        <Palette className="w-4 h-4" />
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setEditingUserRole({ id: u.id, role: u.role })}>
                        <Edit2 className="w-4 h-4" />
                      </Button>
                      {(user?.role === "master_admin" || user?.role === "admin") && u.role !== "master_admin" && u.id !== user?.id && (
                        <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive" title="Remover usuário" onClick={() => setConfirmDeleteUser(u)}>
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      )}
                    </div>
                  )}
                </div>
              ))}
              {users.length === 0 && <p className="text-center text-muted-foreground py-8">Nenhum usuário encontrado</p>}
            </div>
          </TabsContent>

          {/* CUSTOM DOMAINS TAB */}
          <TabsContent value="domains">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-lg font-semibold text-foreground flex items-center gap-2"><Globe className="w-5 h-5 text-primary" />Domínios personalizados</h2>
                <p className="text-xs text-muted-foreground mt-1">Uma marca única, com espaços isolados por empresa e DNS verificado.</p>
              </div>
              <Badge variant="outline">{(domainsQ.data ?? []).length} domínio(s)</Badge>
            </div>

            <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 mb-5">
              <div className="flex items-start gap-3">
                <ShieldCheck className="w-5 h-5 text-primary mt-0.5 shrink-0" />
                <div className="text-sm">
                  <p className="font-semibold text-foreground">Como funciona</p>
                  <p className="text-muted-foreground mt-1">Cadastre o hostname sem protocolo, crie o registro TXT exibido pelo Orbita e só então clique em Verificar. O domínio não será ativado antes da confirmação de posse.</p>
                </div>
              </div>
            </div>

            <form
              className="grid gap-3 md:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)_auto] items-end mb-5"
              onSubmit={(event) => {
                event.preventDefault();
                if (!domainForm.companyId || !domainForm.domain.trim()) return;
                addDomainM.mutate({ companyId: Number(domainForm.companyId), domain: domainForm.domain });
              }}
            >
              <div>
                <Label htmlFor="domain-company">Empresa</Label>
                <Select value={domainForm.companyId} onValueChange={(companyId) => setDomainForm((current) => ({ ...current, companyId }))}>
                  <SelectTrigger id="domain-company" className="mt-1"><SelectValue placeholder="Selecione a empresa" /></SelectTrigger>
                  <SelectContent>
                    {domainCompanies.map((company: any) => <SelectItem key={company.id} value={String(company.id)}>{company.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="custom-domain">Domínio ou subdomínio</Label>
                <Input id="custom-domain" className="mt-1" value={domainForm.domain} onChange={(event) => setDomainForm((current) => ({ ...current, domain: event.target.value }))} placeholder="app.empresa.com.br" autoComplete="url" />
              </div>
              <Button type="submit" disabled={!domainForm.companyId || !domainForm.domain.trim() || addDomainM.isPending}>
                {addDomainM.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Plus className="w-4 h-4 mr-1" />}
                Cadastrar
              </Button>
            </form>

            {domainSetup && (
              <div className="rounded-xl border border-amber-300/60 bg-amber-50/70 dark:bg-amber-950/20 dark:border-amber-800 p-4 mb-5">
                <div className="flex items-center justify-between gap-3 mb-2">
                  <p className="font-semibold text-foreground">DNS necessário para {domainSetup.domain}</p>
                  <Button size="sm" variant="ghost" onClick={() => setDomainSetup(null)}>Fechar</Button>
                </div>
                <p className="text-xs text-muted-foreground mb-3">Crie este registro TXT no provedor DNS do domínio:</p>
                <div className="grid gap-2 text-xs font-mono sm:grid-cols-[auto_1fr]">
                  <span className="text-muted-foreground">Host</span><span className="rounded bg-background border border-border px-2 py-1 break-all">{domainSetup.txtHost}</span>
                  <span className="text-muted-foreground">Valor</span><span className="rounded bg-background border border-border px-2 py-1 break-all">{domainSetup.token}</span>
                </div>
              </div>
            )}

            {domainsQ.isLoading ? (
              <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
            ) : (domainsQ.data ?? []).length === 0 ? (
              <div className="text-center py-12 text-muted-foreground border border-dashed border-border rounded-xl">
                <Globe className="w-10 h-10 mx-auto mb-3 opacity-30" />
                <p>Nenhum domínio personalizado cadastrado.</p>
              </div>
            ) : (
              <div className="grid gap-3">
                {(domainsQ.data ?? []).map((domain: any) => (
                  <div key={domain.id} className="rounded-xl border border-border bg-card p-4 space-y-3">
                    <div className="flex flex-wrap items-center gap-3">
                      <Globe className="w-4 h-4 text-primary shrink-0" />
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-foreground truncate">{domain.domain}</p>
                        <p className="text-xs text-muted-foreground">{domain.companyName ?? `Empresa #${domain.companyId}`}</p>
                      </div>
                      <Badge variant={domain.status === "verified" ? "default" : "outline"}>{domain.status === "verified" ? "Verificado" : domain.status === "disabled" ? "Desativado" : "Pendente DNS"}</Badge>
                      {domain.isPrimary && <Badge variant="secondary">Primário</Badge>}
                      <Badge variant={domain.sslStatus === "active" ? "outline" : "destructive"} className="text-[11px]">
                        {domain.sslStatus === "active" ? "SSL Ativo" : domain.sslStatus === "expiring" ? "SSL Expirando" : "SSL Pendente"}
                      </Badge>
                    </div>
                    {domain.status === "pending" && domain.verificationToken && (
                      <div className="rounded-lg bg-muted/40 p-3 text-xs text-muted-foreground">
                        Registro TXT: <code className="text-foreground break-all">_orbita-verification.{domain.domain}</code> = <code className="text-foreground break-all">{domain.verificationToken}</code>
                      </div>
                    )}
                    {!domain.isPrimary && domain.status === "verified" && (
                      <p className="text-xs text-muted-foreground">Domínio secundário: acessos serão redirecionados por HTTP 301 para o domínio primário da empresa.</p>
                    )}
                    <div className="flex flex-wrap items-center gap-2">
                      {domain.status === "pending" && (
                        <Button size="sm" onClick={() => verifyDomainM.mutate({ id: domain.id })} disabled={verifyDomainM.isPending}>
                          {verifyDomainM.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <ShieldCheck className="w-4 h-4 mr-1" />}
                          Verificar DNS
                        </Button>
                      )}
                      {domain.status === "verified" && !domain.isPrimary && (
                        <Button size="sm" variant="outline" onClick={() => setPrimaryDomainM.mutate({ id: domain.id })} disabled={setPrimaryDomainM.isPending}>Definir como primário</Button>
                      )}
                      {domain.status === "verified" && (
                        <Button size="sm" variant="outline" onClick={() => renewSslM.mutate({ id: domain.id })} disabled={renewSslM.isPending}>
                          {renewSslM.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}
                          Renovar SSL
                        </Button>
                      )}
                      <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive" onClick={() => { if (confirm(`Remover o domínio ${domain.domain}?`)) removeDomainM.mutate({ id: domain.id }); }} disabled={removeDomainM.isPending}>
                        <Trash2 className="w-4 h-4 mr-1" />Remover
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
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

      {/* Company Dialog — Master Admin */}
      {isMasterAdmin && (
        <Dialog open={showCompanyDialog} onOpenChange={(open) => { setShowCompanyDialog(open); if (!open) setEditingCompany(null); }}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2"><Building2 className="w-4 h-4" />{editingCompany ? "Editar Empresa" : "Nova Empresa"}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div>
                <Label htmlFor="company-name">Nome *</Label>
                <Input id="company-name" className="mt-1" value={companyForm.name} onChange={(e) => setCompanyForm({ ...companyForm, name: e.target.value })} placeholder="LS Solutions" />
              </div>
              <div>
                <Label htmlFor="company-slug">Slug *</Label>
                <Input id="company-slug" className="mt-1" value={companyForm.slug} onChange={(e) => setCompanyForm({ ...companyForm, slug: e.target.value })} placeholder="ls-solutions" />
                <p className="text-xs text-muted-foreground mt-1">Identificador único usado no isolamento da organização.</p>
              </div>
              <div>
                <Label htmlFor="company-color">Cor da empresa</Label>
                <div className="flex items-center gap-2 mt-1"><Input id="company-color" type="color" className="w-14 h-9 p-1" value={companyForm.color} onChange={(e) => setCompanyForm({ ...companyForm, color: e.target.value })} /><span className="text-xs text-muted-foreground font-mono">{companyForm.color}</span></div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowCompanyDialog(false)}>Cancelar</Button>
              <Button onClick={handleSaveCompany} disabled={!companyForm.name.trim() || !companyForm.slug.trim() || createCompanyM.isPending || updateCompanyM.isPending}>
                {(createCompanyM.isPending || updateCompanyM.isPending) && <Loader2 className="w-4 h-4 animate-spin mr-1" />}
                Salvar Empresa
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Create Local User Dialog */}
      <Dialog open={showCreateUserDialog} onOpenChange={setShowCreateUserDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <User className="w-4 h-4" />
              Novo Usuário Local
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="admin-user-name">Nome completo *</Label>
              <Input id="admin-user-name" value={createUserForm.name} onChange={(e) => setCreateUserForm({ ...createUserForm, name: e.target.value })} placeholder="Nome do usuário" autoComplete="name" />
            </div>
            <div>
              <Label htmlFor="admin-user-email">E-mail *</Label>
              <Input id="admin-user-email" type="email" value={createUserForm.email} onChange={(e) => setCreateUserForm({ ...createUserForm, email: e.target.value })} placeholder="usuario@empresa.com" autoComplete="email" />
            </div>
            <div>
              <Label htmlFor="admin-user-company">Empresa</Label>
              <Input id="admin-user-company" value={createUserForm.company} onChange={(e) => setCreateUserForm({ ...createUserForm, company: e.target.value })} placeholder="Nome da empresa (opcional)" autoComplete="organization" />
            </div>
            <div>
              <Label htmlFor="admin-user-password">Senha provisória *</Label>
              <Input id="admin-user-password" type="password" value={createUserForm.password} onChange={(e) => setCreateUserForm({ ...createUserForm, password: e.target.value })} placeholder="Mínimo de 6 caracteres" autoComplete="new-password" />
              {createUserForm.password.length > 0 && createUserForm.password.length < 6 && <p className="mt-1 text-xs text-destructive">A senha deve conter pelo menos 6 caracteres.</p>}
            </div>
            <div>
              <Label>Perfil de acesso</Label>
              <Select value={createUserForm.role} onValueChange={(role) => setCreateUserForm({ ...createUserForm, role })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{ROLES.map((role) => <SelectItem key={role.value} value={role.value}>{role.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <p className="text-xs text-muted-foreground">A senha será armazenada no servidor com hash scrypt e nunca será exibida após a criação.</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateUserDialog(false)}>Cancelar</Button>
            <Button onClick={handleCreateUser} disabled={!createUserForm.name.trim() || !createUserForm.email.trim() || createUserForm.password.length < 6 || createUserM.isPending}>
              {createUserM.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Plus className="w-4 h-4 mr-1" />}
              Criar Usuário
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Avatar Dialog */}
      {editingUserAvatar && (
        <Dialog open onOpenChange={(o) => { if (!o) setEditingUserAvatar(null); }}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Palette className="w-4 h-4" />
                Avatar de {editingUserAvatar.name ?? editingUserAvatar.email}
              </DialogTitle>
            </DialogHeader>
            <div className="py-2">
              <AvatarEditor
                value={avatarForm}
                onChange={setAvatarForm}
                name={editingUserAvatar.name}
              />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setEditingUserAvatar(null)}>Cancelar</Button>
              <Button
                onClick={() => updateAvatarM.mutate({ userId: editingUserAvatar.id, avatarColor: avatarForm.avatarColor, avatarInitials: avatarForm.avatarInitials || undefined })}
                disabled={updateAvatarM.isPending}
              >
                {updateAvatarM.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}
                Salvar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Confirm Delete User Dialog */}
      {confirmDeleteUser && (
        <Dialog open onOpenChange={(o) => { if (!o) setConfirmDeleteUser(null); }}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-destructive">
                <Trash2 className="w-4 h-4" />
                Remover Usuário
              </DialogTitle>
            </DialogHeader>
            <div className="py-2 space-y-3">
              <p className="text-sm text-foreground">
                Tem certeza que deseja remover o usuário <span className="font-semibold">{confirmDeleteUser.name ?? confirmDeleteUser.email}</span>?
              </p>
              <p className="text-xs text-muted-foreground">
                Esta ação é irreversível. O usuário perderá acesso ao sistema e será removido de todos os projetos e disciplinas.
              </p>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setConfirmDeleteUser(null)}>Cancelar</Button>
              <Button
                variant="destructive"
                onClick={() => deleteUserM.mutate({ userId: confirmDeleteUser.id })}
                disabled={deleteUserM.isPending}
              >
                {deleteUserM.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Trash2 className="w-4 h-4 mr-1" />}
                Remover
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

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
            <div><Label>Código CRS <span className="text-muted-foreground text-xs">(identificador do cliente, ex: Seinfra, DNIT)</span></Label><Input value={clientForm.crsCode} onChange={(e) => setClientForm({ ...clientForm, crsCode: e.target.value })} placeholder="Ex: Seinfra" className="mt-1 font-mono" /></div>
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
                <SelectContent>{clients.map((c: any) => <SelectItem key={c.id} value={String(c.id)}>{c.crsCode ? `${c.crsCode} — ${c.name}` : c.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>OS *</Label><Input value={crsForm.name} onChange={(e) => setCrsForm({ ...crsForm, name: e.target.value })} placeholder="Nome da Ordem de Serviço" /></div>
              <div><Label>Código CRS</Label><Input value={crsForm.code} onChange={(e) => setCrsForm({ ...crsForm, code: e.target.value })} placeholder="Ex: CRS-001" /></div>
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
      <Dialog open={showDisciplineDialog} onOpenChange={(open) => { setShowDisciplineDialog(open); if (!open) setEditingDiscipline(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>{editingDiscipline ? "Editar Disciplina" : "Nova Disciplina"}</DialogTitle></DialogHeader>
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
            <Button
              onClick={() => {
                if (!disciplineForm.name.trim()) return;
                if (editingDiscipline) {
                  updateDisciplineM.mutate({ id: editingDiscipline.id, ...disciplineForm });
                } else {
                  createDisciplineM.mutate(disciplineForm);
                }
              }}
              disabled={!disciplineForm.name.trim() || createDisciplineM.isPending || updateDisciplineM.isPending}
            >
              {editingDiscipline ? "Salvar" : "Criar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
