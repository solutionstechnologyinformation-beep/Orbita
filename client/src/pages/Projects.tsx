import { useState } from "react";
import { Link } from "wouter";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import AppLayout from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import {
  Plus, Search, Layers, Globe, MapPin, ArchiveRestore,
  Archive, Trash2, ExternalLink, FolderOpen, Filter, Calendar,
} from "lucide-react";
import { COUNTRIES, getStatesForCountry } from "@/lib/geoData";

// ── Helpers ─────────────────────────────────────────────────────────────────
const TIPO_OBRA_OPTIONS = [
  { key: "implementacao", label: "Implementação" },
  { key: "restauracao", label: "Restauração" },
  { key: "aumento_capacidade", label: "Aumento de Capacidade" },
  { key: "levantamento", label: "Levantamento" },
  { key: "outro", label: "Outro" },
] as const;

type TipoObraKey = typeof TIPO_OBRA_OPTIONS[number]["key"];

/** Parseia o campo tipoObra que pode ser string JSON, string simples ou null */
function parseTipoObra(raw: string | null | undefined): TipoObraKey[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed as TipoObraKey[];
    return [parsed as TipoObraKey];
  } catch {
    return [raw as TipoObraKey];
  }
}

function formatTipoObra(keys: TipoObraKey[]): string {
  if (keys.length === 0) return "—";
  return keys.map(k => TIPO_OBRA_OPTIONS.find(o => o.key === k)?.label ?? k).join(", ");
}

type TechDataEntry = { extensaoKm?: number | null; areaHa?: number | null };
type TechDataByType = Record<string, TechDataEntry>;
type CrsItem = {
  id: number; clientId: number; name: string; code?: string | null;
  description?: string | null; country?: string | null; countryCode?: string | null;
  state?: string | null; stateCode?: string | null; status: string; progress: number;
  clientName?: string | null; clientColor?: string | null;
  tipoObra?: string | null; extensaoKm?: number | null; areaHa?: number | null; perimetroUrbano?: number | null;
  techDataByType?: string | null;
  derivedStartDate?: Date | null; derivedEndDate?: Date | null;
};
type Client = { id: number; name: string; color?: string | null };

const emptyForm = {
  clientId: "", name: "", code: "", description: "",
  country: "", countryCode: "", state: "", stateCode: "",
  tiposObra: [] as TipoObraKey[],
  extensaoKm: "", areaHa: "", perimetroUrbano: "",
  techDataByType: {} as TechDataByType,
};

// ── CrsCard Component ─────────────────────────────────────────────────────────
type CrsCardProps = {
  crs: CrsItem;
  tipos: TipoObraKey[];
  isAdmin: boolean;
  onEdit: (crs: CrsItem) => void;
  onArchive: (id: number) => void;
  onRestore: (id: number) => void;
  onDelete: (id: number, name: string) => void;
};

function CrsCard({ crs, tipos, isAdmin, onEdit, onArchive, onRestore, onDelete }: CrsCardProps) {
  const [showDisciplines, setShowDisciplines] = useState(false);
  const discQ = trpc.crs_discipline.progress.useQuery(
    { crsId: crs.id },
    { enabled: showDisciplines }
  );
  const disciplines = discQ.data ?? [];

  return (
    <Card className="border-border hover:shadow-md transition-shadow">
      <CardHeader className="pb-2 pt-4 px-4">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            {crs.clientName && (
              <div className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full mb-2 font-medium"
                style={{ backgroundColor: (crs.clientColor ?? "#785500") + "20", color: crs.clientColor ?? "#785500" }}>
                <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: crs.clientColor ?? "#785500" }} />
                {crs.clientName}
              </div>
            )}
            <h3 className="font-semibold text-foreground truncate">{crs.name}</h3>
            {crs.code && <p className="text-xs text-muted-foreground mt-0.5">#{crs.code}</p>}
          </div>
          {crs.status === "archived" && <Badge variant="secondary" className="text-xs shrink-0">Arquivado</Badge>}
        </div>
      </CardHeader>
      <CardContent className="px-4 pb-4">
        {(crs.country || crs.state) && (
          <div className="flex items-center gap-1 text-xs text-muted-foreground mb-2">
            <MapPin className="w-3 h-3" />
            <span>{[crs.state, crs.country].filter(Boolean).join(", ")}</span>
          </div>
        )}
        {tipos.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-2">
            {tipos.map(k => (
              <span key={k} className="text-[10px] px-1.5 py-0.5 rounded-full bg-primary/10 text-primary font-medium">
                {TIPO_OBRA_OPTIONS.find(o => o.key === k)?.label ?? k}
              </span>
            ))}
          </div>
        )}
        {(crs.extensaoKm != null || crs.areaHa != null || crs.perimetroUrbano != null) && (
          <div className="flex flex-wrap gap-3 text-xs text-muted-foreground mb-2">
            {crs.extensaoKm != null && <span><span className="font-medium text-foreground/70">Ext:</span> {crs.extensaoKm} km</span>}
            {crs.areaHa != null && <span><span className="font-medium text-foreground/70">Área:</span> {crs.areaHa} m²</span>}
            {crs.perimetroUrbano != null && <span><span className="font-medium text-foreground/70">Perím.:</span> {crs.perimetroUrbano}</span>}
          </div>
        )}
        {/* Progresso geral */}
        <div className="mb-2">
          <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
            <span>Progresso Geral</span><span className="font-medium">{crs.progress}%</span>
          </div>
          <div className="h-1.5 bg-muted rounded-full overflow-hidden">
            <div className="h-full rounded-full transition-all"
              style={{ width: `${crs.progress}%`, backgroundColor: crs.progress >= 100 ? "#10b981" : crs.progress >= 50 ? "#1dbab4" : "#785500" }} />
          </div>
        </div>
        {/* Progresso por Disciplina */}
        <div className="mb-2">
          <button
            onClick={() => setShowDisciplines(v => !v)}
            className="flex items-center gap-1 text-xs text-primary hover:text-primary/80 font-medium transition-colors"
          >
            <span>{showDisciplines ? "▾" : "▸"}</span>
            <span>Disciplinas {disciplines.length > 0 ? `(${disciplines.length})` : ""}</span>
            {discQ.isLoading && <span className="text-muted-foreground ml-1">…</span>}
          </button>
          {showDisciplines && disciplines.length > 0 && (
            <div className="mt-2 space-y-1.5">
              {disciplines.map(d => (
                <div key={d.name}>
                  <div className="flex items-center justify-between text-[11px] text-muted-foreground mb-0.5">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: d.color }} />
                      <span className="truncate">{d.name}</span>
                    </div>
                    <span className="font-medium shrink-0 ml-2">{d.done}/{d.total} ({d.progress}%)</span>
                  </div>
                  <div className="h-1 bg-muted rounded-full overflow-hidden">
                    <div className="h-full rounded-full transition-all" style={{ width: `${d.progress}%`, backgroundColor: d.color }} />
                  </div>
                </div>
              ))}
            </div>
          )}
          {showDisciplines && disciplines.length === 0 && !discQ.isLoading && (
            <p className="text-[11px] text-muted-foreground mt-1 ml-3">Nenhum item de checklist cadastrado.</p>
          )}
        </div>
        {crs.description && <p className="text-xs text-muted-foreground line-clamp-2 mb-2">{crs.description}</p>}
        {(crs.derivedStartDate || crs.derivedEndDate) && (
          <div className="flex items-center gap-3 text-xs text-muted-foreground mb-2 bg-muted/50 rounded-md px-2 py-1.5">
            <Calendar className="w-3 h-3 shrink-0" />
            {crs.derivedStartDate && (
              <span><span className="font-medium text-foreground/70">Início:</span> {new Date(crs.derivedStartDate).toLocaleDateString("pt-BR")}</span>
            )}
            {crs.derivedStartDate && crs.derivedEndDate && <span className="text-muted-foreground/40">•</span>}
            {crs.derivedEndDate && (
              <span><span className="font-medium text-foreground/70">Entrega:</span> {new Date(crs.derivedEndDate).toLocaleDateString("pt-BR")}</span>
            )}
          </div>
        )}
        <div className="flex items-center gap-2 mt-2">
          {crs.status !== "archived" && (
            <Link href={`/kanban?crs=${crs.id}`} className="flex-1">
              <Button variant="default" size="sm" className="w-full gap-1.5 text-xs">
                <ExternalLink className="w-3.5 h-3.5" /> Abrir Kanban
              </Button>
            </Link>
          )}
          {isAdmin && (
            <>
              <Button variant="outline" size="sm" className="text-xs" onClick={() => onEdit(crs)}>Editar</Button>
              {crs.status !== "archived" ? (
                <Button variant="ghost" size="sm" className="text-orange-600 hover:text-orange-700 hover:bg-orange-50" onClick={() => onArchive(crs.id)}>
                  <Archive className="w-3.5 h-3.5" />
                </Button>
              ) : (
                <Button variant="ghost" size="sm" className="text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50" onClick={() => onRestore(crs.id)}>
                  <ArchiveRestore className="w-3.5 h-3.5" />
                </Button>
              )}
              <Button variant="ghost" size="sm" className="text-destructive hover:bg-destructive/10"
                onClick={() => onDelete(crs.id, crs.name)}>
                <Trash2 className="w-3.5 h-3.5" />
              </Button>
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export default function Projects() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin" || user?.role === "master_admin";

  const [search, setSearch] = useState("");
  const [filterClient, setFilterClient] = useState("all");
  const [filterStatus, setFilterStatus] = useState("active");
  const [showCreate, setShowCreate] = useState(false);
  const [editingCrs, setEditingCrs] = useState<CrsItem | null>(null);
  const [form, setForm] = useState(emptyForm);

  const utils = trpc.useUtils();
  const crsQ = trpc.crs.list.useQuery();
  const archivedQ = trpc.crs.listArchived.useQuery();
  const clientsQ = trpc.clients.list.useQuery();

  const createMut = trpc.crs.create.useMutation({
    onSuccess: () => { toast.success("CRS criado!"); utils.crs.list.invalidate(); setShowCreate(false); setForm(emptyForm); },
    onError: (e) => toast.error(e.message),
  });
  const updateMut = trpc.crs.update.useMutation({
    onSuccess: () => { toast.success("CRS atualizado!"); utils.crs.list.invalidate(); utils.crs.listArchived.invalidate(); setEditingCrs(null); },
    onError: (e) => toast.error(e.message),
  });
  const archiveMut = trpc.crs.archive.useMutation({
    onSuccess: () => { toast.success("CRS arquivado."); utils.crs.list.invalidate(); utils.crs.listArchived.invalidate(); },
    onError: (e) => toast.error(e.message),
  });
  const restoreMut = trpc.crs.restore.useMutation({
    onSuccess: () => { toast.success("CRS restaurado."); utils.crs.list.invalidate(); utils.crs.listArchived.invalidate(); },
    onError: (e) => toast.error(e.message),
  });
  const deleteMut = trpc.crs.delete.useMutation({
    onSuccess: () => { toast.success("Contrato excluído."); utils.crs.list.invalidate(); utils.crs.listArchived.invalidate(); },
    onError: (e) => toast.error(e.message),
  });

  function handleCreate() {
    if (!form.clientId || !form.name.trim()) return toast.error("Cliente e nome são obrigatórios.");
    createMut.mutate({
      clientId: parseInt(form.clientId), name: form.name.trim(),
      code: form.code.trim() || undefined, description: form.description.trim() || undefined,
      country: form.country || undefined, countryCode: form.countryCode || undefined,
      state: form.state.trim() || undefined, stateCode: form.stateCode.trim() || undefined,
      tipoObra: form.tiposObra.length > 0 ? form.tiposObra : undefined,
      extensaoKm: form.extensaoKm ? parseFloat(form.extensaoKm) : undefined,
      areaHa: form.areaHa ? parseFloat(form.areaHa) : undefined,
      perimetroUrbano: form.perimetroUrbano ? parseInt(form.perimetroUrbano) : undefined,
      techDataByType: Object.keys(form.techDataByType).length > 0 ? form.techDataByType : undefined,
    });
  }

  function handleUpdate() {
    if (!editingCrs) return;
    updateMut.mutate({
      id: editingCrs.id, name: form.name.trim() || editingCrs.name,
      code: form.code.trim() || undefined, description: form.description.trim() || undefined,
      country: form.country || undefined, countryCode: form.countryCode || undefined,
      state: form.state.trim() || undefined, stateCode: form.stateCode.trim() || undefined,
      tipoObra: form.tiposObra.length > 0 ? form.tiposObra : null,
      extensaoKm: form.extensaoKm ? parseFloat(form.extensaoKm) : null,
      areaHa: form.areaHa ? parseFloat(form.areaHa) : null,
      perimetroUrbano: form.perimetroUrbano ? parseInt(form.perimetroUrbano) : null,
      techDataByType: Object.keys(form.techDataByType).length > 0 ? form.techDataByType : null,
    });
  }

  function openEdit(crs: CrsItem) {
    setEditingCrs(crs);
    let techData: TechDataByType = {};
    try { if (crs.techDataByType) techData = JSON.parse(crs.techDataByType); } catch {}
    setForm({
      clientId: String(crs.clientId), name: crs.name, code: crs.code ?? "",
      description: crs.description ?? "", country: crs.country ?? "",
      countryCode: crs.countryCode ?? "", state: crs.state ?? "", stateCode: crs.stateCode ?? "",
      tiposObra: parseTipoObra(crs.tipoObra),
      extensaoKm: crs.extensaoKm != null ? String(crs.extensaoKm) : "",
      areaHa: crs.areaHa != null ? String(crs.areaHa) : "",
      perimetroUrbano: crs.perimetroUrbano != null ? String(crs.perimetroUrbano) : "",
      techDataByType: techData,
    });
  }

  function handleCountryChange(code: string) {
    const country = COUNTRIES.find((c) => c.code === code);
    setForm((f) => ({ ...f, countryCode: code, country: country?.name ?? "", state: "", stateCode: "" }));
  }

  function toggleTipoObra(key: TipoObraKey) {
    setForm((f) => ({
      ...f,
      tiposObra: f.tiposObra.includes(key)
        ? f.tiposObra.filter(k => k !== key)
        : [...f.tiposObra, key],
    }));
  }

  const allCrs: CrsItem[] = filterStatus === "archived" ? (archivedQ.data ?? []) : (crsQ.data ?? []);
  const filtered = allCrs.filter((c) => {
    const matchSearch = !search || c.name.toLowerCase().includes(search.toLowerCase()) || (c.code ?? "").toLowerCase().includes(search.toLowerCase());
    const matchClient = filterClient === "all" || String(c.clientId) === filterClient;
    return matchSearch && matchClient;
  });
  const clients: Client[] = clientsQ.data ?? [];

  // ── Shared form fields ───────────────────────────────────────────────────
  function TipoObraCheckboxes() {
    return (
      <div>
        <Label>Tipo(s) de Obra</Label>
        <div className="mt-2 grid grid-cols-2 gap-2">
          {TIPO_OBRA_OPTIONS.map(({ key, label }) => (
            <div key={key} className="flex items-center gap-2">
              <Checkbox
                id={`tipo-${key}`}
                checked={form.tiposObra.includes(key)}
                onCheckedChange={() => toggleTipoObra(key)}
              />
              <label htmlFor={`tipo-${key}`} className="text-sm cursor-pointer select-none">{label}</label>
            </div>
          ))}
        </div>
      </div>
    );
  }

  function TechnicalFields() {
    return (
      <div className="border-t border-border pt-3">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Dados Técnicos da Obra (opcional)</p>
        <div className="space-y-4">
          <TipoObraCheckboxes />
          {/* Perím. Urbanos — campo global */}
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Perím. Urbanos</Label><Input className="mt-1" type="number" min="0" placeholder="Ex: 3" value={form.perimetroUrbano} onChange={(e) => setForm((f) => ({ ...f, perimetroUrbano: e.target.value }))} /></div>
          </div>
          {/* Extensão e Área por tipo de obra selecionado */}
          {form.tiposObra.length > 0 && (
            <div className="space-y-3">
              <p className="text-xs font-medium text-muted-foreground">Medidas por tipo de obra:</p>
              {form.tiposObra.map((tipoKey) => {
                const label = TIPO_OBRA_OPTIONS.find(o => o.key === tipoKey)?.label ?? tipoKey;
                const entry = form.techDataByType[tipoKey] ?? {};
                return (
                  <div key={tipoKey} className="bg-muted/40 rounded-lg p-3">
                    <p className="text-xs font-semibold text-foreground mb-2">{label}</p>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label className="text-xs">Extensão (km)</Label>
                        <Input
                          className="mt-1 h-8 text-sm"
                          type="number" min="0" step="0.1"
                          placeholder="Ex: 42.5"
                          value={entry.extensaoKm != null ? String(entry.extensaoKm) : ""}
                          onChange={(e) => {
                            const val = e.target.value ? parseFloat(e.target.value) : null;
                            setForm((f) => ({
                              ...f,
                              techDataByType: { ...f.techDataByType, [tipoKey]: { ...f.techDataByType[tipoKey], extensaoKm: val } },
                            }));
                          }}
                        />
                      </div>
                      <div>
                        <Label className="text-xs">Área (m²)</Label>
                        <Input
                          className="mt-1 h-8 text-sm"
                          type="number" min="0" step="1"
                          placeholder="Ex: 12000"
                          value={entry.areaHa != null ? String(entry.areaHa) : ""}
                          onChange={(e) => {
                            const val = e.target.value ? parseFloat(e.target.value) : null;
                            setForm((f) => ({
                              ...f,
                              techDataByType: { ...f.techDataByType, [tipoKey]: { ...f.techDataByType[tipoKey], areaHa: val } },
                            }));
                          }}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <AppLayout>
      <div className="p-6 max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Projetos CRS</h1>
            <p className="text-sm text-muted-foreground mt-0.5">Gerencie os contratos e projetos por cliente</p>
          </div>
          {isAdmin && (
            <Button onClick={() => { setForm(emptyForm); setShowCreate(true); }} className="gap-2">
              <Plus className="w-4 h-4" /> Novo Contrato
            </Button>
          )}
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-3 mb-6">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input placeholder="Buscar por nome ou código..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
          </div>
          <Select value={filterClient} onValueChange={setFilterClient}>
            <SelectTrigger className="w-48">
              <Filter className="w-4 h-4 mr-2 text-muted-foreground" />
              <SelectValue placeholder="Todos os clientes" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os clientes</SelectItem>
              {clients.map((c) => <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <div className="flex gap-0 border border-border rounded-md overflow-hidden">
            {["active", "archived"].map((s) => (
              <button key={s} onClick={() => setFilterStatus(s)}
                className={`px-3 py-1.5 text-sm font-medium transition-colors ${filterStatus === s ? "bg-primary text-primary-foreground" : "hover:bg-muted text-muted-foreground"}`}>
                {s === "active" ? "Ativos" : "Arquivados"}
              </button>
            ))}
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
          {[
            { label: "Total de Contratos", value: (crsQ.data?.length ?? 0) + (archivedQ.data?.length ?? 0), icon: Layers, color: "text-primary" },
            { label: "Ativos", value: crsQ.data?.length ?? 0, icon: FolderOpen, color: "text-emerald-500" },
            { label: "Arquivados", value: archivedQ.data?.length ?? 0, icon: Archive, color: "text-orange-500" },
            { label: "Clientes", value: clients.length, icon: Globe, color: "text-teal-500" },
          ].map((stat) => (
            <Card key={stat.label} className="border-border">
              <CardContent className="p-4 flex items-center gap-3">
                <div className={`p-2 rounded-lg bg-muted ${stat.color}`}><stat.icon className="w-4 h-4" /></div>
                <div>
                  <p className="text-2xl font-bold text-foreground">{stat.value}</p>
                  <p className="text-xs text-muted-foreground">{stat.label}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* CRS Grid */}
        {crsQ.isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-48 rounded-xl" />)}
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <Layers className="w-12 h-12 text-muted-foreground/30 mb-3" />
            <p className="text-muted-foreground font-medium">Nenhum Contrato encontrado</p>
            <p className="text-sm text-muted-foreground/60 mt-1">{filterStatus === "archived" ? "Nenhum Contrato arquivado." : "Crie o primeiro Contrato para começar."}</p>
            {isAdmin && filterStatus === "active" && (
              <Button onClick={() => { setForm(emptyForm); setShowCreate(true); }} className="mt-4 gap-2">
                <Plus className="w-4 h-4" /> Criar CRS
              </Button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map((crs) => {
              const tipos = parseTipoObra(crs.tipoObra);
              return (<CrsCard key={crs.id} crs={crs} tipos={tipos} isAdmin={isAdmin}
                onEdit={openEdit}
                onArchive={(id: number) => archiveMut.mutate({ id })}
                onRestore={(id: number) => restoreMut.mutate({ id })}
                onDelete={(id: number, name: string) => { if (confirm(`Excluir "${name}"? Esta ação não pode ser desfeita.`)) deleteMut.mutate({ id }); }}
              />);
            })}
          </div>
        )}
      </div>

      {/* Create Dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Novo Contrato</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label>Cliente *</Label>
              <Select value={form.clientId} onValueChange={(v) => setForm((f) => ({ ...f, clientId: v }))}>
                <SelectTrigger className="mt-1"><SelectValue placeholder="Selecione o cliente" /></SelectTrigger>
                <SelectContent>{clients.map((c) => <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Nome *</Label><Input className="mt-1" placeholder="Ex: Rodovia BR-101" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} /></div>
              <div><Label>Código</Label><Input className="mt-1" placeholder="Ex: CRS-2024-001" value={form.code} onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))} /></div>
            </div>
            <div><Label>Descrição</Label><Textarea className="mt-1" rows={2} value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>País</Label>
                <Select value={form.countryCode} onValueChange={handleCountryChange}>
                  <SelectTrigger className="mt-1"><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>{COUNTRIES.map((c) => <SelectItem key={c.code} value={c.code}>{c.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label>Estado / Região</Label>
                {getStatesForCountry(form.countryCode).length > 0 ? (
                  <Select value={form.stateCode} onValueChange={(v) => {
                    const st = getStatesForCountry(form.countryCode).find(s => s.code === v);
                    setForm((f) => ({ ...f, stateCode: v, state: st?.name ?? v }));
                  }}>
                    <SelectTrigger className="mt-1"><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent>{getStatesForCountry(form.countryCode).map((s) => <SelectItem key={s.code} value={s.code}>{s.name}</SelectItem>)}</SelectContent>
                  </Select>
                ) : (
                  <Input className="mt-1" placeholder="Ex: Santa Catarina" value={form.state} onChange={(e) => setForm((f) => ({ ...f, state: e.target.value }))} />
                )}
              </div>
            </div>
            <TechnicalFields />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreate(false)}>Cancelar</Button>
            <Button onClick={handleCreate} disabled={createMut.isPending}>{createMut.isPending ? "Criando..." : "Criar CRS"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={!!editingCrs} onOpenChange={(o) => !o && setEditingCrs(null)}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Editar Contrato</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Nome *</Label><Input className="mt-1" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} /></div>
              <div><Label>Código</Label><Input className="mt-1" value={form.code} onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))} /></div>
            </div>
            <div><Label>Descrição</Label><Textarea className="mt-1" rows={2} value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>País</Label>
                <Select value={form.countryCode} onValueChange={handleCountryChange}>
                  <SelectTrigger className="mt-1"><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>{COUNTRIES.map((c) => <SelectItem key={c.code} value={c.code}>{c.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label>Estado / Região</Label>
                {getStatesForCountry(form.countryCode).length > 0 ? (
                  <Select value={form.stateCode} onValueChange={(v) => {
                    const st = getStatesForCountry(form.countryCode).find(s => s.code === v);
                    setForm((f) => ({ ...f, stateCode: v, state: st?.name ?? v }));
                  }}>
                    <SelectTrigger className="mt-1"><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent>{getStatesForCountry(form.countryCode).map((s) => <SelectItem key={s.code} value={s.code}>{s.name}</SelectItem>)}</SelectContent>
                  </Select>
                ) : (
                  <Input className="mt-1" value={form.state} onChange={(e) => setForm((f) => ({ ...f, state: e.target.value }))} />
                )}
              </div>
            </div>
            <TechnicalFields />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingCrs(null)}>Cancelar</Button>
            <Button onClick={handleUpdate} disabled={updateMut.isPending}>{updateMut.isPending ? "Salvando..." : "Salvar"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
