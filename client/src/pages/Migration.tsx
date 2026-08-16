import AppLayout from "@/components/AppLayout";
import { MigrationPanel } from "@/components/MigrationPanel";
import { FileArchive, ShieldCheck } from "lucide-react";

export default function Migration() {
  return (
    <AppLayout title="Migração e Backups">
      <main className="min-h-full space-y-5 bg-background p-4 sm:p-6 lg:p-8">
        <section className="mx-auto max-w-5xl">
          <div className="mb-6 flex flex-col gap-4 rounded-2xl border border-border bg-card p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between sm:p-6">
            <div className="flex items-start gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300">
                <FileArchive className="h-5 w-5" aria-hidden="true" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-foreground sm:text-2xl">Migração e Backups</h1>
                <p className="mt-1 max-w-2xl text-sm text-muted-foreground">Centralize os arquivos de migração e os agendamentos de backup sem ocupar o espaço operacional do Dashboard.</p>
              </div>
            </div>
            <div className="flex items-center gap-2 rounded-lg bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300">
              <ShieldCheck className="h-4 w-4" aria-hidden="true" /> Dados separados por empresa
            </div>
          </div>
          <MigrationPanel />
        </section>
      </main>
    </AppLayout>
  );
}
