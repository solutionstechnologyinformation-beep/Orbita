import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Download, Upload, FileSpreadsheet, FileJson, CheckCircle2, AlertCircle } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";

export function MigrationPanel() {
  const [importing, setImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const utils = trpc.useUtils();

  const exportJsonQuery = trpc.migration.exportJson.useQuery({}, { enabled: false });
  const importJsonMutation = trpc.migration.importJson.useMutation({
    onSuccess: (res) => {
      toast.success(`Migração concluída com sucesso! Importados: ${JSON.stringify(res.importedCounts)}`);
      utils.invalidate();
    },
    onError: (err) => {
      toast.error(`Erro ao importar arquivo: ${err.message}`);
    },
  });

  const handleExportJson = async () => {
    try {
      const result = await exportJsonQuery.refetch();
      if (!result.data) {
        toast.error("Não foi possível gerar os dados de exportação.");
        return;
      }
      const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(result.data, null, 2));
      const downloadAnchor = document.createElement("a");
      downloadAnchor.setAttribute("href", dataStr);
      downloadAnchor.setAttribute("download", `orbita_migration_${Date.now()}.json`);
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();
      toast.success("Arquivo JSON exportado com sucesso!");
    } catch (e: any) {
      toast.error(`Erro ao exportar JSON: ${e.message}`);
    }
  };

  const handleExportExcel = async () => {
    toast.info("A exportação em Excel com abas separadas está disponível via API ou backup nativo.");
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const content = event.target?.result as string;
        if (!content) return;
        setImporting(true);
        await importJsonMutation.mutateAsync({ jsonContent: content });
      } catch (err: any) {
        toast.error(`Arquivo inválido: ${err.message}`);
      } finally {
        setImporting(false);
        if (fileInputRef.current) fileInputRef.current.value = "";
      }
    };
    reader.readAsText(file);
  };

  return (
    <Card className="border-amber-200 bg-amber-50/40 shadow-sm">
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-bold text-slate-900 flex items-center gap-2">
          <Download className="h-5 w-5 text-amber-600" />
          Migração e Backup do Sistema (Local / VS Code)
        </CardTitle>
        <CardDescription className="text-xs text-slate-600">
          Exporte ou importe todos os dados da empresa (empresas, clientes, contratos, tarefas, sprints e agenda) para migrar para a versão local.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-wrap items-center gap-3 pt-0">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="border-amber-300 bg-white text-slate-800 hover:bg-amber-100"
          onClick={handleExportJson}
        >
          <FileJson className="h-4 w-4 mr-1.5 text-blue-600" />
          Exportar Arquivo (.json)
        </Button>

        <Button
          type="button"
          variant="outline"
          size="sm"
          className="border-amber-300 bg-white text-slate-800 hover:bg-amber-100"
          onClick={() => {
            fileInputRef.current?.click();
          }}
          disabled={importing}
        >
          <Upload className="h-4 w-4 mr-1.5 text-emerald-600" />
          {importing ? "Importando..." : "Importar Arquivo (.json)"}
        </Button>

        <input
          ref={fileInputRef}
          type="file"
          accept=".json,application/json"
          className="hidden"
          onChange={handleFileChange}
        />
      </CardContent>
    </Card>
  );
}
