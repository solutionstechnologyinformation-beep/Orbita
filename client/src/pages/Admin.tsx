import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import AppLayout from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Plus, Trash2, Edit2, Users, Building2, Layers, Tag, Globe, Archive, RotateCcw } from "lucide-react";

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

export default function Admin() {
  const { user } = useAuth();
  
  const isAdmin = user?.role === "admin" || user?.role === "master_admin";

  // Clients state
  const [showClientDialog, setShowClientDialog] = useState(false);
  const [editingClient, setEditingClient] = useState<any>(null);
  const [clientForm, setClientForm] = useState({ name: "", color: "#1561ad", country: "Brasil", notes: "" });

  // CRS state
  const [showCrsDialog, setShowCrsDialog] = useState(false);
  const [editingCrs, setEditingCrs] = useState<any>(null);
  const [crsForm, setCrsForm] = useState({ clientId: "", name: "", code: "", country: "Brasil", state: "", description: "" });
  const [showArchivedCrs, setShowArchivedCrs] = useState(false);

  // Disciplines state
  const [showDisciplineDialog, setShowDisciplineDialog] = useState(false);
  const [disciplineForm, setDisciplineForm] = useState({ name: "", color: "#1561ad", description: "" });

  // Users state
  const [editingUserRole, setEditingUserRole] = useState<{ id: number; role: string } | null>(null);

  const clientsQ = trpc.clients.list.useQuery();
  const crsQ = trpc.crs.list.useQuery();
  const archivedCrsQ = trpc.crs.listArchived.useQuery(undefined, { enabled: showArchivedCrs });
  const disciplinesQ = trpc.disciplines.list.useQuery();
  const usersQ = trpc.users.list.useQuery();
  const utils = trpc.useUtils();

  // Client mutations
  const createClientM = trpc.clients.create.useMutation({
    onSuccess: () => { utils.clients.list.invalidate(); setShowClientDialog(false); setClientForm({ name: "", color: "#1561ad", country: "Brasil", notes: "" }); toast.success("Cliente criado!"); },
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
    onSuccess: () => { utils.disciplines.list.invalidate(); setShowDisciplineDialog(false); setDisciplineForm({ name: "", color: "#1561ad", description: "" }); toast.success("Disciplina criada!"); },
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
    setClientForm({ name: client.name, color: client.color ?? "#1561ad", country: client.country ?? "Brasil", notes: client.notes ?? "" });
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

  return (
    <AppLayout>
      <div className="max-w-5xl mx-auto px-4 py-6">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-foreground">Administracao</h1>
        </div>

        <Tabs defaultValue="clients">
          <TabsList className="mb-6">
            <TabsTrigger value="clients"><Building2 className="w-4 h-4 mr-1.5" />Clientes</TabsTrigger>
            <TabsTrigger value="crs"><Globe className="w-4 h-4 mr-1.5" />CRS</TabsTrigger>
            <TabsTrigger value="disciplines"><Tag className="w-4 h-4 mr-1.5" />Disciplinas</TabsTrigger>
            <TabsTrigger value="users"><Users className="w-4 h-4 mr-1.5" />Usuarios</TabsTrigger>
          </TabsList>

          {/* CLIENTS TAB */}
          <TabsContent value="clients">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-foreground">Clientes ({clients.length})</h2>
              <Button size="sm" onClick={() => { setEditingClient(null); setClientForm({ name: "", color: "#1561ad", country: "Brasil", notes: "" }); setShowClientDialog(true); }}>
                <Plus className="w-4 h-4 mr-1" />Novo Cliente
              </Button>
            </div>
            <div className="grid gap-3">
              {clients.map((client: any) => (
                <div key={client.id} className="flex items-center gap-3 p-4 bg-card border border-border rounded-xl">
                  <span className="w-4 h-4 rounded-full shrink-0" style={{ background: client.color ?? "#1561ad" }} />
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
                  <Plus className="w-4 h-4 mr-1" />Novo CRS
                </Button>
              </div>
            </div>
            <div className="grid gap-3">
              {crsList.map((crs: any) => (
                <div key={crs.id} className="flex items-center gap-3 p-4 bg-card border border-border rounded-xl">
                  <span className="w-4 h-4 rounded-full shrink-0" style={{ background: crs.clientColor ?? "#1561ad" }} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-foreground">{crs.name}</p>
                      {crs.code && <Badge variant="outline" className="text-xs">{crs.code}</Badge>}
                    </div>
                    <p className="text-xs text-muted-foreground">{crs.clientName} · {crs.country ?? "---"}{crs.state ? ", " + crs.state : ""}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-xs font-bold text-primary">{crs.progress ?? 0}%</p>
                    <p className="text-xs text-muted-foreground">progresso</p>
                  </div>
                  <Button size="sm" variant="ghost" onClick={() => openEditCrs(crs)}><Edit2 className="w-4 h-4" /></Button>
                  <Button size="sm" variant="ghost" onClick={() => { if (confirm("Arquivar este CRS?")) archiveCrsM.mutate({ id: crs.id }); }} className="text-muted-foreground hover:text-orange-500">
                    <Archive className="w-4 h-4" />
                  </Button>
                </div>
              ))}
              {crsList.length === 0 && <p className="text-center text-muted-foreground py-8">Nenhum CRS ativo</p>}
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
                  {archivedCrsList.length === 0 && <p className="text-center text-muted-foreground py-4 text-sm">Nenhum CRS arquivado</p>}
                </div>
              </div>
            )}
          </TabsContent>

          {/* DISCIPLINES TAB */}
          <TabsContent value="disciplines">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-foreground">Disciplinas ({disciplines.length})</h2>
              <Button size="sm" onClick={() => { setDisciplineForm({ name: "", color: "#1561ad", description: "" }); setShowDisciplineDialog(true); }}>
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
              <h2 className="text-lg font-semibold text-foreground">Usuarios ({users.length})</h2>
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
                      <Button size="sm" variant="ghost" onClick={() => setEditingUserRole({ id: u.id, role: u.role })}><Edit2 className="w-4 h-4" /></Button>
                    </div>
                  )}
                </div>
              ))}
              {users.length === 0 && <p className="text-center text-muted-foreground py-8">Nenhum usuario encontrado</p>}
            </div>
          </TabsContent>
        </Tabs>
      </div>

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
                <Label>Pais</Label>
                <Select value={clientForm.country} onValueChange={(v) => setClientForm({ ...clientForm, country: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{COUNTRIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div><Label>Observacoes</Label><Input value={clientForm.notes} onChange={(e) => setClientForm({ ...clientForm, notes: e.target.value })} placeholder="Observacoes opcionais" /></div>
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
          <DialogHeader><DialogTitle>{editingCrs ? "Editar CRS" : "Novo CRS"}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Cliente *</Label>
              <Select value={crsForm.clientId} onValueChange={(v) => setCrsForm({ ...crsForm, clientId: v })}>
                <SelectTrigger><SelectValue placeholder="Selecionar cliente" /></SelectTrigger>
                <SelectContent>{clients.map((c: any) => <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Nome *</Label><Input value={crsForm.name} onChange={(e) => setCrsForm({ ...crsForm, name: e.target.value })} placeholder="Nome do CRS" /></div>
              <div><Label>Codigo</Label><Input value={crsForm.code} onChange={(e) => setCrsForm({ ...crsForm, code: e.target.value })} placeholder="Ex: CRS-001" /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Pais</Label>
                <Select value={crsForm.country} onValueChange={(v) => setCrsForm({ ...crsForm, country: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{COUNTRIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label>Estado / Regiao</Label><Input value={crsForm.state} onChange={(e) => setCrsForm({ ...crsForm, state: e.target.value })} placeholder="Ex: Sao Paulo" /></div>
            </div>
            <div><Label>Descricao</Label><Input value={crsForm.description} onChange={(e) => setCrsForm({ ...crsForm, description: e.target.value })} placeholder="Descricao opcional" /></div>
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
            <div><Label>Descricao</Label><Input value={disciplineForm.description} onChange={(e) => setDisciplineForm({ ...disciplineForm, description: e.target.value })} placeholder="Descricao opcional" /></div>
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
