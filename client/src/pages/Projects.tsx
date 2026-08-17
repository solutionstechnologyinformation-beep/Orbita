import { useRef, useState } from "react";
import JSZip from "jszip";
import { Link } from "wouter";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { useGlobalPeriod, dateRangeOverlapsGlobalPeriod } from "@/contexts/GlobalPeriodContext";
import AppLayout from "@/components/AppLayout";
import { SplitLayout, SplitPanelHeader, SplitPanelList, SplitPanelItem, SplitPanelContent, SplitPanelEmpty } from "@/components/SplitLayout";
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
  Archive, Trash2, ExternalLink, FolderOpen, Filter, Calendar, Upload, MapPinned, Download, Loader2,
} from "lucide-react";
import { COUNTRIES, getStatesForCountry } from "@/lib/geoData";
import { getSegmentBaseName, isSupportedSegmentFileName } from "@/lib/segment-files";

// ── Helpers ─────────────────────────────────────────────────────────────────
const TIPO_OBRA_OPTIONS = [
  { key: "implementacao", label: "Implementação" },
  { key: "restauracao", label: "Restauração" },
  { key: "aumento_capacidade", label: "Aumento de Capacidade" },
  { key: "levantamento", label: "Levantamento" },
  { key: "outro", label: "Outro" },
] as const;

type TipoObraKey = typeof TIPO_OBRA_OPTIONS[number]["key"];

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

type ParsedSegment = {
  geometryJson: string;
  boundsJson: string;
};

function localElements(root: Element | Document, name: string): Element[] {
  return Array.from(root.getElementsByTagName("*")).filter((node) => node.localName === name || node.tagName.endsWith(`:${name}`));
}

function parseKmlCoordinates(raw: string | null | undefined): number[][] {
  return (raw ?? "").trim().split(/\s+/).map((pair) => {
    const values = pair.split(",").map(Number);
    return values.length >= 2 && Number.isFinite(values[0]) && Number.isFinite(values[1]) ? [values[0], values[1]] : null;
  }).filter((point): point is number[] => point !== null);
}

function parseKmlToGeoJson(kml: string): ParsedSegment {
  const document = new DOMParser().parseFromString(kml, "application/xml");
  if (document.querySelector("parsererror")) throw new Error("O KML está malformado.");
  const placemarks = localElements(document, "Placemark");
  const features: any[] = [];
  const allCoordinates: number[][] = [];

  placemarks.forEach((placemark, index) => {
    const name = localElements(placemark, "name")[0]?.textContent?.trim() || `Elemento ${index + 1}`;
    const descEl = localElements(placemark, "description")[0];
    const description = descEl ? descEl.textContent?.trim() : undefined;

    // Verificar LineString
    const lineEls = localElements(placemark, "LineString");
    if (lineEls.length > 0) {
      const coordsText = localElements(lineEls[0], "coordinates")[0]?.textContent;
      const coordinates = parseKmlCoordinates(coordsText);
      if (coordinates.length >= 2) {
        coordinates.forEach(([lng, lat]) => allCoordinates.push([lng, lat]));
        features.push({
          type: "Feature",
          properties: { name, description },
          geometry: { type: "LineString", coordinates },
        });
        return;
      }
    }

    // Verificar Point
    const pointEls = localElements(placemark, "Point");
    if (pointEls.length > 0) {
      const coordsText = localElements(pointEls[0], "coordinates")[0]?.textContent;
      const coords = parseKmlCoordinates(coordsText);
      if (coords.length > 0) {
        const [lng, lat] = coords[0];
        allCoordinates.push([lng, lat]);
        features.push({
          type: "Feature",
          properties: { name, description },
          geometry: { type: "Point", coordinates: [lng, lat] },
        });
      }
    }
  });

  if (features.length === 0) throw new Error("Nenhum elemento geográfico válido (linha ou ponto) foi encontrado no KMZ/KML.");

  const lngs = allCoordinates.map(([lng]) => lng);
  const lats = allCoordinates.map(([, lat]) => lat);
  const bounds = lngs.length > 0 ? {
    minLng: Math.min(...lngs),
    minLat: Math.min(...lats),
    maxLng: Math.max(...lngs),
    maxLat: Math.max(...lats),
  } : null;

  return { geometryJson: JSON.stringify({ type: "FeatureCollection", features }), boundsJson: JSON.stringify(bounds) };
}

async function extractKml(file: File): Promise<string> {
  if (file.name.toLowerCase().endsWith(".kml")) return file.text();
  const zip = await JSZip.loadAsync(await file.arrayBuffer());
  const entryName = Object.keys(zip.files).find((name) => name.toLowerCase().endsWith(".kml") && !zip.files[name].dir);
  if (!entryName) throw new Error("O arquivo KMZ não contém um doc.kml válido.");
  return zip.files[entryName].async("text");
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(",")[1] ?? "");
    reader.onerror = () => reject(new Error("Não foi possível ler o arquivo."));
    reader.readAsDataURL(file);
  });
}

type CrsSegmentItem = { id: number; crsId: number; name: string; fileName: string; fileUrl: string; geometryJson: string; boundsJson?: string | null; createdAt: Date | string };

function CrsSegmentsPanel({ crsId, isAdmin }: { crsId: number; isAdmin: boolean }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [segmentName, setSegmentName] = useState("");
  const [parsedSegment, setParsedSegment] = useState<ParsedSegment | null>(null);
  const utils = trpc.useUtils();
  const segmentsQ = trpc.crs.segments.list.useQuery({ crsId });
  const uploadMut = trpc.crs.segments.upload.useMutation({
    onSuccess: () => {
      toast.success("Trecho importado e vinculado ao contrato.");
      utils.crs.segments.list.invalidate({ crsId });
      setSelectedFile(null);
      setParsedSegment(null);
      setSegmentName("");
      if (inputRef.current) inputRef.current.value = "";
    },
    onError: (error) => toast.error(error.message),
  });
  const deleteMut = trpc.crs.segments.delete.useMutation({
    onSuccess: () => { toast.success("Trecho removido."); utils.crs.segments.list.invalidate({ crsId }); },
    onError: (error) => toast.error(error.message),
  });

  async function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (file.size > 15 * 1024 * 1024) { toast.error("O arquivo deve ter no máximo 15 MB."); return; }
    if (!isSupportedSegmentFileName(file.name)) { toast.error("Selecione um arquivo .KMZ ou .KML."); return; }
    try {
      const parsed = parseKmlToGeoJson(await extractKml(file));
      setSelectedFile(file);
      setParsedSegment(parsed);
      setSegmentName(getSegmentBaseName(file.name));
      toast.success("Trecho lido. Confirme o nome para importar.");
    } catch (error) {
      setSelectedFile(null);
      setParsedSegment(null);
      toast.error(error instanceof Error ? error.message : "Não foi possível ler o trecho.");
    }
  }

  async function handleUpload() {
    if (!selectedFile || !parsedSegment || !segmentName.trim()) return;
    uploadMut.mutate({
      crsId,
      name: segmentName.trim(),
      fileName: selectedFile.name,
      mimeType: selectedFile.type || (selectedFile.name.toLowerCase().endsWith(".kmz") ? "application/vnd.google-earth.kmz" : "application/vnd.google-earth.kml+xml"),
      base64: await fileToBase64(selectedFile),
      geometryJson: parsedSegment.geometryJson,
      boundsJson: parsedSegment.boundsJson,
    });
  }

  return (
    <Card className="border-border">
      <CardHeader className="pb-3"><div className="flex items-center justify-between gap-3"><div><p className="text-sm font-semibold text-foreground">Trechos geográficos</p><p className="text-xs text-muted-foreground">Importe KMZ/KML para visualizar o traçado no mapa.</p></div><MapPinned className="w-4 h-4 text-primary" /></div></CardHeader>
      <CardContent className="pt-0 space-y-3">
        {isAdmin && (
          <div className="rounded-lg border border-dashed border-primary/30 bg-primary/5 p-3 space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <input ref={inputRef} type="file" accept=".kmz,.kml,application/vnd.google-earth.kmz,application/vnd.google-earth.kml+xml" className="hidden" onChange={handleFileChange} />
              <Button type="button" variant="outline" size="sm" onClick={() => inputRef.current?.click()} disabled={uploadMut.isPending} className="gap-2"><Upload className="w-3.5 h-3.5" /> Selecionar KMZ/KML</Button>
              {selectedFile && <span className="text-xs text-muted-foreground truncate max-w-[220px]">{selectedFile.name}</span>}
            </div>
            {selectedFile && parsedSegment && <div className="flex flex-wrap items-end gap-2"><div className="min-w-[220px] flex-1"><Label className="text-xs">Nome do trecho</Label><Input className="mt-1 h-8" value={segmentName} onChange={(event) => setSegmentName(event.target.value)} /></div><Button type="button" size="sm" onClick={handleUpload} disabled={uploadMut.isPending || !segmentName.trim()} className="gap-2">{uploadMut.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />} {uploadMut.isPending ? "Importando…" : "Importar trecho"}</Button></div>}
            <p className="text-[11px] text-muted-foreground">Limite de 15 MB. O sistema preserva o arquivo original e armazena a geometria linear para o mapa.</p>
          </div>
        )}
        {segmentsQ.isLoading ? <Skeleton className="h-12 w-full" /> : (segmentsQ.data ?? []).length === 0 ? <p className="text-xs text-muted-foreground">Nenhum trecho importado para este contrato.</p> : <div className="space-y-2">{(segmentsQ.data as CrsSegmentItem[]).map((segment) => <div key={segment.id} className="flex items-center gap-2 rounded-lg border border-border px-3 py-2"><MapPinned className="w-4 h-4 text-primary shrink-0" /><div className="min-w-0 flex-1"><p className="text-sm font-medium truncate">{segment.name}</p><p className="text-[11px] text-muted-foreground truncate">{segment.fileName}</p></div><a href={segment.fileUrl} target="_blank" rel="noreferrer" className="text-muted-foreground hover:text-primary" title="Baixar arquivo original"><Download className="w-4 h-4" /></a>{isAdmin && <Button type="button" variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => deleteMut.mutate({ id: segment.id, crsId })} disabled={deleteMut.isPending} aria-label={`Excluir ${segment.name}`}><Trash2 className="w-3.5 h-3.5" /></Button>}</div>)}</div>}
      </CardContent>
    </Card>
  );
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
type Client = { id: number; name: string; color?: string | null; crsCode?: string | null };

const emptyForm = {
  clientId: "", name: "", code: "", description: "",
  country: "", countryCode: "", state: "", stateCode: "",
  tiposObra: [] as TipoObraKey[],
  extensaoKm: "", areaHa: "", perimetroUrbano: "",
  techDataByType: {} as TechDataByType,
};

// ── CrsDetail Component ───────────────────────────────────────────────────────
type CrsDetailProps = {
  crs: CrsItem;
  tipos: TipoObraKey[];
  isAdmin: boolean;
  onEdit: (crs: CrsItem) => void;
  onArchive: (id: number) => void;
  onRestore: (id: number) => void;
  onDelete: (id: number, name: string) => void;
};

function CrsDetail({ crs, tipos, isAdmin, onEdit, onArchive, onRestore, onDelete }: CrsDetailProps) {
  const [showDisciplines, setShowDisciplines] = useState(false);
  const discQ = trpc.crs_discipline.progress.useQuery(
    { crsId: crs.id },
    { enabled: showDisciplines }
  );
  const disciplines = discQ.data ?? [];

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          {crs.clientName && (
            <div className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full mb-2 font-medium"
              style={{ backgroundColor: (crs.clientColor ?? "#3b82f6") + "20", color: crs.clientColor ?? "#3b82f6" }}>
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: crs.clientColor ?? "#3b82f6" }} />
              {crs.clientName}
            </div>
          )}
          <h2 className="text-xl font-bold text-foreground">OS: {crs.name}</h2>
          {crs.code && <p className="text-sm text-muted-foreground mt-0.5">CRS: {crs.code}</p>}
        </div>
        {crs.status === "archived" && <Badge variant="secondary">Arquivado</Badge>}
      </div>

      {/* Location + Types */}
      <div className="grid grid-cols-2 gap-4">
        {(crs.country || crs.state) && (
          <Card className="border-border">
            <CardContent className="p-3 flex items-center gap-2">
              <MapPin className="w-4 h-4 text-muted-foreground shrink-0" />
              <div>
                <p className="text-xs text-muted-foreground">Localização</p>
                <p className="text-sm font-medium">{[crs.state, crs.country].filter(Boolean).join(", ")}</p>
              </div>
            </CardContent>
          </Card>
        )}
        {tipos.length > 0 && (
          <Card className="border-border">
            <CardContent className="p-3">
              <p className="text-xs text-muted-foreground mb-1.5">Tipo(s) de Obra</p>
              <div className="flex flex-wrap gap-1">
                {tipos.map(k => (
                  <span key={k} className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary font-medium">
                    {TIPO_OBRA_OPTIONS.find(o => o.key === k)?.label ?? k}
                  </span>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Technical data */}
      {(crs.extensaoKm != null || crs.areaHa != null || crs.perimetroUrbano != null) && (
        <div className="grid grid-cols-3 gap-3">
          {crs.extensaoKm != null && (
            <Card className="border-border">
              <CardContent className="p-3 text-center">
                <p className="text-xs text-muted-foreground">Extensão</p>
                <p className="text-lg font-bold text-foreground">{crs.extensaoKm}</p>
                <p className="text-xs text-muted-foreground">km</p>
              </CardContent>
            </Card>
          )}
          {crs.areaHa != null && (
            <Card className="border-border">
              <CardContent className="p-3 text-center">
                <p className="text-xs text-muted-foreground">Área</p>
                <p className="text-lg font-bold text-foreground">{crs.areaHa}</p>
                <p className="text-xs text-muted-foreground">m²</p>
              </CardContent>
            </Card>
          )}
          {crs.perimetroUrbano != null && (
            <Card className="border-border">
              <CardContent className="p-3 text-center">
                <p className="text-xs text-muted-foreground">Perím. Urbanos</p>
                <p className="text-lg font-bold text-foreground">{crs.perimetroUrbano} Un.</p>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Progress */}
      <Card className="border-border">
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-medium text-foreground">Progresso Geral</p>
            <p className="text-lg font-bold text-primary">{crs.progress}%</p>
          </div>
          <div className="h-2 bg-muted rounded-full overflow-hidden">
            <div className="h-full rounded-full transition-all"
              style={{ width: `${crs.progress}%`, backgroundColor: crs.progress >= 100 ? "#10b981" : crs.progress >= 50 ? "#3b82f6" : "#3b82f6" }} />
          </div>
        </CardContent>
      </Card>

      {/* Disciplines */}
      <Card className="border-border">
        <CardContent className="p-4">
          <button
            onClick={() => setShowDisciplines(v => !v)}
            className="flex items-center gap-1.5 text-sm text-primary hover:text-primary/80 font-medium transition-colors w-full text-left"
          >
            <span>{showDisciplines ? "▾" : "▸"}</span>
            <span>Disciplinas {disciplines.length > 0 ? `(${disciplines.length})` : ""}</span>
            {discQ.isLoading && <span className="text-muted-foreground ml-1 text-xs">carregando…</span>}
          </button>
          {showDisciplines && disciplines.length > 0 && (
            <div className="mt-3 space-y-2">
              {disciplines.map((d: any) => (
                <div key={d.name}>
                  <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: d.color }} />
                      <span className="truncate font-medium">{d.name}</span>
                    </div>
                    <span className="font-medium shrink-0 ml-2">{d.done}/{d.total} ({d.progress}%)</span>
                  </div>
                  <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                    <div className="h-full rounded-full transition-all" style={{ width: `${d.progress}%`, backgroundColor: d.color }} />
                  </div>
                </div>
              ))}
            </div>
          )}
          {showDisciplines && disciplines.length === 0 && !discQ.isLoading && (
            <p className="text-xs text-muted-foreground mt-2">Nenhum item de checklist cadastrado.</p>
          )}
        </CardContent>
      </Card>

      {/* Description */}
      {crs.description && (
        <Card className="border-border">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground mb-1">Descrição</p>
            <p className="text-sm text-foreground">{crs.description}</p>
          </CardContent>
        </Card>
      )}

      {/* Dates */}
      {(crs.derivedStartDate || crs.derivedEndDate) && (
        <Card className="border-border">
          <CardContent className="p-4 flex items-center gap-4">
            <Calendar className="w-4 h-4 text-muted-foreground shrink-0" />
            {crs.derivedStartDate && (
              <div>
                <p className="text-xs text-muted-foreground">Início</p>
                <p className="text-sm font-medium">{new Date(crs.derivedStartDate).toLocaleDateString("pt-BR")}</p>
              </div>
            )}
            {crs.derivedStartDate && crs.derivedEndDate && <div className="w-px h-8 bg-border" />}
            {crs.derivedEndDate && (
              <div>
                <p className="text-xs text-muted-foreground">Entrega</p>
                <p className="text-sm font-medium">{new Date(crs.derivedEndDate).toLocaleDateString("pt-BR")}</p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <CrsSegmentsPanel crsId={crs.id} isAdmin={isAdmin} />

      {/* Actions */}
      <div className="flex items-center gap-2 pt-2">
        {crs.status !== "archived" && (
          <Link href={`/kanban?crs=${crs.id}`} className="flex-1">
            <Button variant="default" className="w-full gap-2">
              <ExternalLink className="w-4 h-4" /> Abrir Kanban
            </Button>
          </Link>
        )}
        {isAdmin && (
          <>
            <Button variant="outline" onClick={() => onEdit(crs)}>Editar</Button>
            {crs.status !== "archived" ? (
              <Button variant="ghost" className="text-orange-600 hover:text-orange-700 hover:bg-orange-50" onClick={() => onArchive(crs.id)}>
                <Archive className="w-4 h-4" />
              </Button>
            ) : (
              <Button variant="ghost" className="text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50" onClick={() => onRestore(crs.id)}>
                <ArchiveRestore className="w-4 h-4" />
              </Button>
            )}
            <Button variant="ghost" className="text-destructive hover:bg-destructive/10"
              onClick={() => onDelete(crs.id, crs.name)}>
              <Trash2 className="w-4 h-4" />
            </Button>
          </>
        )}
      </div>
    </div>
  );
}

export default function Projects() {
  const { user } = useAuth();
  const { range: globalPeriodRange } = useGlobalPeriod();
  const isAdmin = user?.role === "admin" || user?.role === "master_admin";

  const [search, setSearch] = useState("");
  const [filterClient, setFilterClient] = useState("all");
  const [filterStatus, setFilterStatus] = useState("active");
  const [showCreate, setShowCreate] = useState(false);
  const [editingCrs, setEditingCrs] = useState<CrsItem | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [selectedCrsId, setSelectedCrsId] = useState<number | null>(null);

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
      id: editingCrs.id,
      clientId: form.clientId ? parseInt(form.clientId) : undefined,
      name: form.name.trim() || editingCrs.name,
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
    const matchPeriod = dateRangeOverlapsGlobalPeriod(c.derivedStartDate, c.derivedEndDate, globalPeriodRange);
    return matchSearch && matchClient && matchPeriod;
  });
  const clients: Client[] = clientsQ.data ?? [];

  const selectedCrs = filtered.find((c) => c.id === selectedCrsId) ?? filtered[0] ?? null;

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
          {TipoObraCheckboxes()}
          <div className="grid grid-cols-3 gap-3">
            <div><Label>Extensão (km)</Label><Input className="mt-1" type="number" min="0" step="0.1" placeholder="Ex: 42.5" value={form.extensaoKm} onChange={(e) => setForm((f) => ({ ...f, extensaoKm: e.target.value }))} /></div>
            <div><Label>Área total (m²)</Label><Input className="mt-1" type="number" min="0" step="0.1" placeholder="Ex: 12000" value={form.areaHa} onChange={(e) => setForm((f) => ({ ...f, areaHa: e.target.value }))} /></div>
            <div><Label>Perím. Urbanos</Label><Input className="mt-1" type="number" min="0" placeholder="Ex: 3" value={form.perimetroUrbano} onChange={(e) => setForm((f) => ({ ...f, perimetroUrbano: e.target.value }))} /></div>
          </div>
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
                        <Input className="mt-1 h-8 text-sm" type="number" min="0" step="0.1" placeholder="Ex: 42.5"
                          value={entry.extensaoKm != null ? String(entry.extensaoKm) : ""}
                          onChange={(e) => {
                            const val = e.target.value ? parseFloat(e.target.value) : null;
                            setForm((f) => ({ ...f, techDataByType: { ...f.techDataByType, [tipoKey]: { ...f.techDataByType[tipoKey], extensaoKm: val } } }));
                          }} />
                      </div>
                      <div>
                        <Label className="text-xs">Área (m²)</Label>
                        <Input className="mt-1 h-8 text-sm" type="number" min="0" step="1" placeholder="Ex: 12000"
                          value={entry.areaHa != null ? String(entry.areaHa) : ""}
                          onChange={(e) => {
                            const val = e.target.value ? parseFloat(e.target.value) : null;
                            setForm((f) => ({ ...f, techDataByType: { ...f.techDataByType, [tipoKey]: { ...f.techDataByType[tipoKey], areaHa: val } } }));
                          }} />
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
    <AppLayout title="Projetos CRS" fullHeight>
      <SplitLayout
        leftWidth="340px"
        left={
          <>
            {/* Left Panel Header */}
            <SplitPanelHeader
              title="Contratos"
              subtitle={`${filtered.length} ${filterStatus === "archived" ? "arquivados" : "ativos"}`}
              action={
                isAdmin ? (
                  <Button size="sm" onClick={() => { setForm(emptyForm); setShowCreate(true); }} className="gap-1.5 h-8 text-xs">
                    <Plus className="w-3.5 h-3.5" /> Novo
                  </Button>
                ) : undefined
              }
            />
            {/* Filters */}
            <div className="flex-shrink-0 px-3 py-2 border-b border-border bg-card space-y-2">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                <Input placeholder="Buscar..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-8 h-8 text-sm bg-background" />
              </div>
              <div className="flex gap-2">
                <Select value={filterClient} onValueChange={setFilterClient}>
                  <SelectTrigger className="flex-1 h-7 text-xs">
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
                      className={`px-2 py-1 text-xs font-medium transition-colors ${filterStatus === s ? "bg-primary text-primary-foreground" : "hover:bg-muted text-muted-foreground"}`}>
                      {s === "active" ? "Ativos" : "Arq."}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            {/* Stats row */}
            <div className="flex-shrink-0 grid grid-cols-4 border-b border-border">
              {[
                { label: "Total", value: (crsQ.data?.length ?? 0) + (archivedQ.data?.length ?? 0), color: "text-primary" },
                { label: "Ativos", value: crsQ.data?.length ?? 0, color: "text-emerald-500" },
                { label: "Arq.", value: archivedQ.data?.length ?? 0, color: "text-orange-500" },
                { label: "Clientes", value: clients.length, color: "text-blue-500" },
              ].map((stat) => (
                <div key={stat.label} className="py-2 px-2 text-center border-r border-border last:border-0">
                  <p className={`text-base font-bold ${stat.color}`}>{stat.value}</p>
                  <p className="text-[10px] text-muted-foreground">{stat.label}</p>
                </div>
              ))}
            </div>
            {/* List */}
            <SplitPanelList>
              {crsQ.isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="px-4 py-3 border-b border-border/50">
                    <Skeleton className="h-4 w-3/4 mb-1" />
                    <Skeleton className="h-3 w-1/2" />
                  </div>
                ))
              ) : filtered.length === 0 ? (
                <SplitPanelEmpty
                  icon={<Layers className="w-5 h-5" />}
                  title="Nenhum contrato"
                  description={filterStatus === "archived" ? "Nenhum arquivado." : "Crie o primeiro contrato."}
                />
              ) : (
                filtered.map((crs) => {
                  const tipos = parseTipoObra(crs.tipoObra);
                  const isSelected = crs.id === selectedCrs?.id;
                  return (
                    <SplitPanelItem key={crs.id} active={isSelected} onClick={() => setSelectedCrsId(crs.id)}>
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5 mb-0.5">
                            {crs.clientColor && <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: crs.clientColor }} />}
                            <p className="text-sm font-semibold text-foreground truncate">OS: {crs.name}</p>
                              {crs.code && <p className="text-xs text-muted-foreground truncate">CRS: {crs.code}</p>}
                          </div>
                          {crs.clientName && <p className="text-xs text-muted-foreground truncate">{crs.clientName}</p>}
                          {crs.state && <p className="text-xs text-muted-foreground">{crs.state}</p>}
                          {tipos.length > 0 && (
                            <p className="text-[11px] text-muted-foreground/70 mt-0.5 truncate">{formatTipoObra(tipos)}</p>
                          )}
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-sm font-bold text-primary">{crs.progress}%</p>
                          <div className="w-12 h-1 bg-muted rounded-full mt-1">
                            <div className="h-full rounded-full" style={{ width: `${crs.progress}%`, backgroundColor: crs.progress >= 100 ? "#10b981" : "#3b82f6" }} />
                          </div>
                        </div>
                      </div>
                    </SplitPanelItem>
                  );
                })
              )}
            </SplitPanelList>
          </>
        }
        right={
          selectedCrs ? (
            <SplitPanelContent>
              <CrsDetail
                crs={selectedCrs}
                tipos={parseTipoObra(selectedCrs.tipoObra)}
                isAdmin={isAdmin}
                onEdit={openEdit}
                onArchive={(id: number) => archiveMut.mutate({ id })}
                onRestore={(id: number) => restoreMut.mutate({ id })}
                onDelete={(id: number, name: string) => { if (confirm(`Excluir "${name}"? Esta ação não pode ser desfeita.`)) deleteMut.mutate({ id }); }}
              />
            </SplitPanelContent>
          ) : (
            <SplitPanelEmpty
              icon={<FolderOpen className="w-5 h-5" />}
              title="Selecione um contrato"
              description="Clique em um contrato na lista para ver os detalhes."
            />
          )
        }
      />

      {/* Create Dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Novo Contrato</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Cliente *</Label>
                <Select value={form.clientId} onValueChange={(v) => setForm((f) => ({ ...f, clientId: v }))}>
                  <SelectTrigger className="mt-1"><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>{clients.map((c) => <SelectItem key={c.id} value={String(c.id)}>{c.crsCode ? `${c.crsCode} — ${c.name}` : c.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label>OS *</Label><Input className="mt-1" placeholder="Nome da Ordem de Serviço" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} /></div>
              <div><Label>Código CRS</Label><Input className="mt-1" placeholder="Ex: CRS-2024-001" value={form.code} onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))} /></div>
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
            {TechnicalFields()}
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
              <div>
                <Label>Cliente *</Label>
                <Select value={form.clientId} onValueChange={(v) => setForm((f) => ({ ...f, clientId: v }))}>
                  <SelectTrigger className="mt-1"><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>{clients.map((c) => <SelectItem key={c.id} value={String(c.id)}>{c.crsCode ? `${c.crsCode} — ${c.name}` : c.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label>OS *</Label><Input className="mt-1" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} /></div>
              <div><Label>Código CRS</Label><Input className="mt-1" value={form.code} onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))} /></div>
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
            {TechnicalFields()}
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
