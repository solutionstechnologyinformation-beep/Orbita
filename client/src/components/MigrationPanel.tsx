import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Download, Upload, FileSpreadsheet, FileJson, CalendarClock, Pause, Play, Trash2, Loader2 } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { getMigrationImportWarning, prepareMigrationImport, type PendingMigrationImport } from "./migration-import-guard";


function downloadBase64File(contentBase64: string, fileName: string, mimeType: string) {
  const bytes = Uint8Array.from(atob(contentBase64), (char) => char.charCodeAt(0));
  const url = URL.createObjectURL(new Blob([bytes], { type: mimeType }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

export function MigrationPanel() {
  const [importing, setImporting] = useState(false);
  const [pendingImport, setPendingImport] = useState<PendingMigrationImport | null>(null);
  const [dayOfWeek, setDayOfWeek] = useState(0);
  const [hourUtc, setHourUtc] = useState(12);
  const [minuteUtc, setMinuteUtc] = useState(0);
  const [isEnabled, setIsEnabled] = useState(true);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const utils = trpc.useUtils();

  const exportJsonQuery = trpc.migration.exportJson.useQuery({}, { enabled: false });
  const exportExcelQuery = trpc.migration.exportExcel.useQuery({}, { enabled: false });
  const backupQuery = trpc.weeklyBackup.get.useQuery(undefined, { staleTime: 30_000 });
  const saveBackupMutation = trpc.weeklyBackup.save.useMutation({
    onSuccess: (schedule) => {
      setDayOfWeek(schedule.dayOfWeek);
      setHourUtc(schedule.hourUtc);
      setMinuteUtc(schedule.minuteUtc);
      setIsEnabled(schedule.isEnabled);
      toast.success("Backup semanal configurado com sucesso.");
      utils.weeklyBackup.get.invalidate();
    },
    onError: (err) => toast.error(`Não foi possível configurar o backup: ${err.message}`),
  });
  const toggleBackupMutation = trpc.weeklyBackup.toggle.useMutation({
    onSuccess: ({ enabled }) => {
      setIsEnabled(enabled);
      toast.success(enabled ? "Backup semanal ativado." : "Backup semanal pausado.");
      utils.weeklyBackup.get.invalidate();
    },
    onError: (err) => toast.error(`Não foi possível alterar o backup: ${err.message}`),
  });
  const removeBackupMutation = trpc.weeklyBackup.remove.useMutation({
    onSuccess: () => {
      setIsEnabled(false);
      toast.success("Agendamento de backup removido.");
      utils.weeklyBackup.get.invalidate();
    },
    onError: (err) => toast.error(`Não foi possível remover o backup: ${err.message}`),
  });

  useEffect(() => {
    if (!backupQuery.data) return;
    setDayOfWeek(backupQuery.data.dayOfWeek);
    setHourUtc(backupQuery.data.hourUtc);
    setMinuteUtc(backupQuery.data.minuteUtc);
    setIsEnabled(backupQuery.data.isEnabled);
  }, [backupQuery.data]);

  const handleExportJson = async () => {
    try {
      const result = await exportJsonQuery.refetch();
      if (!result.data) return toast.error("Não foi possível gerar os dados de exportação.");
      const dataStr = "data:application/json;charset=utf-8," + encodeURIComponent(JSON.stringify(result.data, null, 2));
      const anchor = document.createElement("a");
      anchor.href = dataStr;
      anchor.download = `orbita_migration_${Date.now()}.json`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      toast.success("Arquivo JSON exportado com sucesso.");
    } catch (error: any) {
      toast.error(`Erro ao exportar JSON: ${error.message}`);
    }
  };

  const handleExportExcel = async () => {
    try {
      const result = await exportExcelQuery.refetch();
      if (!result.data) return toast.error("Não foi possível gerar o Excel de migração.");
      downloadBase64File(result.data.contentBase64, result.data.fileName, result.data.mimeType);
      toast.success("Excel de migração exportado com abas separadas.");
    } catch (error: any) {
      toast.error(`Erro ao exportar Excel: ${error.message}`);
    }
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (loadEvent) => {
      try {
        const content = loadEvent.target?.result as string;
        setPendingImport(prepareMigrationImport(file.name, content));
      } catch (error: any) {
        toast.error(`Arquivo inválido: ${error.message}`);
      } finally {
        if (fileInputRef.current) fileInputRef.current.value = "";
      }
    };
    reader.readAsText(file);
  };

  const importJsonMutation = trpc.migration.importJson.useMutation({
    onSuccess: (result) => {
      toast.success(`Migração concluída. ${Object.values(result.importedCounts).reduce((sum, count) => sum + count, 0)} registros importados.`);
      utils.invalidate();
    },
    onError: (error) => toast.error(`Erro ao importar arquivo: ${error.message}`),
  });

  const confirmImport = async () => {
    if (!pendingImport) return;
    try {
      setImporting(true);
      await importJsonMutation.mutateAsync({ jsonContent: pendingImport.content });
      setPendingImport(null);
    } finally {
      setImporting(false);
    }
  };

  const saveBackup = () => saveBackupMutation.mutate({ dayOfWeek, hourUtc, minuteUtc, isEnabled });
  const busy = saveBackupMutation.isPending || toggleBackupMutation.isPending || removeBackupMutation.isPending;
  const nextBackup = backupQuery.data?.nextExecutionAt ? new Date(backupQuery.data.nextExecutionAt).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" }) : null;

  return (
    <>
      <Card className="border-amber-200 bg-amber-50/40 shadow-sm">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base font-bold text-slate-900">
          <Download className="h-5 w-5 text-amber-600" />
          Migração e Backup do Sistema (Local / VS Code)
        </CardTitle>
        <CardDescription className="text-xs text-slate-600">
          Exporte ou importe os dados da empresa para migrar para a versão local. O backup automático gera um Excel semanal armazenado com segurança.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 pt-0">
        <div className="flex flex-wrap items-center gap-3">
          <Button type="button" variant="outline" size="sm" className="border-amber-300 bg-white text-slate-800 hover:bg-amber-100" onClick={handleExportExcel}>
            <FileSpreadsheet className="mr-1.5 h-4 w-4 text-emerald-600" /> Exportar Excel (abas)
          </Button>
          <Button type="button" variant="outline" size="sm" className="border-amber-300 bg-white text-slate-800 hover:bg-amber-100" onClick={handleExportJson}>
            <FileJson className="mr-1.5 h-4 w-4 text-blue-600" /> Exportar (.json)
          </Button>
          <Button type="button" variant="outline" size="sm" className="border-amber-300 bg-white text-slate-800 hover:bg-amber-100" onClick={() => fileInputRef.current?.click()} disabled={importing}>
            <Upload className="mr-1.5 h-4 w-4 text-emerald-600" /> {importing ? "Importando..." : "Importar (.json)"}
          </Button>
          <input ref={fileInputRef} type="file" accept=".json,application/json" className="hidden" onChange={handleFileChange} />
        </div>

        <div className="rounded-lg border border-amber-200 bg-white/70 p-3">
          <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
            <div>
              <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-800"><CalendarClock className="h-4 w-4 text-amber-600" /> Backup automático semanal</h3>
              <p className="mt-1 text-[11px] text-slate-500">O horário é informado em UTC. O arquivo Excel preserva as abas do modelo nativo.</p>
            </div>
            {backupQuery.data && <span className={`rounded-full px-2 py-1 text-[10px] font-semibold ${isEnabled ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-600"}`}>{isEnabled ? "Ativo" : "Pausado"}</span>}
          </div>
          <div className="grid gap-2 sm:grid-cols-[1.4fr_0.8fr_0.8fr_auto] sm:items-end">
            <label className="text-[11px] font-medium text-slate-600">Dia<select value={dayOfWeek} onChange={(event) => setDayOfWeek(Number(event.target.value))} className="mt-1 h-9 w-full rounded-md border border-slate-200 bg-white px-2 text-xs text-slate-800"><option value={0}>Domingo</option><option value={1}>Segunda-feira</option><option value={2}>Terça-feira</option><option value={3}>Quarta-feira</option><option value={4}>Quinta-feira</option><option value={5}>Sexta-feira</option><option value={6}>Sábado</option></select></label>
            <label className="text-[11px] font-medium text-slate-600">Hora UTC<select value={hourUtc} onChange={(event) => setHourUtc(Number(event.target.value))} className="mt-1 h-9 w-full rounded-md border border-slate-200 bg-white px-2 text-xs text-slate-800">{Array.from({ length: 24 }, (_, hour) => <option key={hour} value={hour}>{String(hour).padStart(2, "0")}</option>)}</select></label>
            <label className="text-[11px] font-medium text-slate-600">Minuto<select value={minuteUtc} onChange={(event) => setMinuteUtc(Number(event.target.value))} className="mt-1 h-9 w-full rounded-md border border-slate-200 bg-white px-2 text-xs text-slate-800">{[0, 15, 30, 45].map((minute) => <option key={minute} value={minute}>{String(minute).padStart(2, "0")}</option>)}</select></label>
            <Button type="button" size="sm" className="h-9 bg-amber-500 text-slate-900 hover:bg-amber-400" onClick={saveBackup} disabled={busy}>{saveBackupMutation.isPending ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : null}Salvar</Button>
          </div>
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-3">
            <p className="text-[11px] text-slate-500">{nextBackup ? `Próxima execução: ${nextBackup} (UTC)` : "Nenhum backup semanal configurado."}</p>
            {backupQuery.data && <div className="flex gap-2"><Button type="button" variant="outline" size="sm" className="h-8 text-[11px]" onClick={() => toggleBackupMutation.mutate({ enabled: !isEnabled })} disabled={busy}>{isEnabled ? <Pause className="mr-1 h-3.5 w-3.5" /> : <Play className="mr-1 h-3.5 w-3.5" />}{isEnabled ? "Pausar" : "Retomar"}</Button><Button type="button" variant="outline" size="sm" className="h-8 text-[11px] text-red-600 hover:bg-red-50" onClick={() => removeBackupMutation.mutate({})} disabled={busy}><Trash2 className="mr-1 h-3.5 w-3.5" />Remover</Button></div>}
          </div>
        </div>
      </CardContent>
      </Card>
      <Dialog open={Boolean(pendingImport)} onOpenChange={(open) => { if (!open && !importing) setPendingImport(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Confirmar importação de dados</DialogTitle>
            <DialogDescription>
              {pendingImport ? getMigrationImportWarning(pendingImport) : "Selecione um arquivo JSON para continuar."}
            </DialogDescription>
          </DialogHeader>
          {pendingImport && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-100">
              <p className="font-semibold">Esta ação não deve ser feita por engano.</p>
              <p className="mt-1 text-xs">O arquivo contém {pendingImport.recordGroups} grupo(s) de registros reconhecidos. Confirme somente se o arquivo pertence à empresa atual e foi revisado.</p>
            </div>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setPendingImport(null)} disabled={importing}>Cancelar</Button>
            <Button type="button" className="bg-amber-500 text-slate-950 hover:bg-amber-400" onClick={confirmImport} disabled={importing}>
              {importing && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
              {importing ? "Importando..." : "Confirmar importação"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
