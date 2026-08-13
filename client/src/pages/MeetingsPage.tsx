import { useMemo, useState } from "react";
import AppLayout from "@/components/AppLayout";
import { GoogleCalendarCard } from "@/components/GoogleCalendarCard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { CalendarClock, CheckCircle2, ExternalLink, Link2, Plus, RefreshCw, Users } from "lucide-react";
import { toast } from "sonner";

function parseJson<T>(value: string | null | undefined, fallback: T): T {
  if (!value) return fallback;
  try { return JSON.parse(value) as T; } catch { return fallback; }
}

function formatDate(value: string | Date | null | undefined) {
  if (!value) return "—";
  return new Date(value).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}

function durationMinutes(start: string | Date | null | undefined, end: string | Date | null | undefined) {
  if (!start || !end) return 0;
  return Math.max(0, Math.round((new Date(end).getTime() - new Date(start).getTime()) / 60000));
}

export default function MeetingsPage() {
  const { user } = useAuth();
  const utils = trpc.useUtils();
  const [showCreate, setShowCreate] = useState(false);
  const [selectedCrsId, setSelectedCrsId] = useState("");
  const [selectedTaskId, setSelectedTaskId] = useState("");
  const [selectedParticipantIds, setSelectedParticipantIds] = useState<number[]>([]);
  const [form, setForm] = useState({ title: "", description: "", startDate: "", endDate: "" });

  const connectedQ = trpc.googleCalendar.isConnected.useQuery();
  const crsQ = trpc.crs.list.useQuery();
  const usersQ = trpc.users.list.useQuery();
  const taskInput = useMemo(() => ({ crsId: selectedCrsId ? Number(selectedCrsId) : undefined }), [selectedCrsId]);
  const tasksQ = trpc.tasks.listForGantt.useQuery(taskInput);
  const meetingsQ = trpc.meetings.list.useQuery({});

  const createMut = trpc.meetings.create.useMutation({
    onSuccess: (meeting) => {
      utils.meetings.list.invalidate();
      setShowCreate(false);
      setForm({ title: "", description: "", startDate: "", endDate: "" });
      setSelectedCrsId("");
      setSelectedTaskId("");
      setSelectedParticipantIds([]);
      toast.success(meeting.googleMeetUrl ? "Reunião criada com link do Google Meet." : "Reunião criada.");
    },
    onError: (error) => toast.error(error.message),
  });

  const syncMut = trpc.meetings.syncReport.useMutation({
    onSuccess: (result) => {
      utils.meetings.list.invalidate();
      toast.success(result.found ? "Relatório sincronizado com o Google Meet." : "Ainda não há registro concluído para esta reunião.");
    },
    onError: (error) => toast.error(error.message),
  });

  const removeMut = trpc.meetings.remove.useMutation({
    onSuccess: () => {
      utils.meetings.list.invalidate();
      toast.success("Reunião removida do Orbita.");
    },
    onError: (error) => toast.error(error.message),
  });

  const selectedCrs = (crsQ.data ?? []).find((crs: any) => String(crs.id) === selectedCrsId);
  const meetings = (meetingsQ.data ?? []) as any[];
  const users = (usersQ.data ?? []) as any[];
  const tasks = (tasksQ.data ?? []) as any[];

  function toggleParticipant(id: number) {
    setSelectedParticipantIds((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  }

  function submitCreate() {
    if (!selectedCrsId || !form.title || !form.startDate || !form.endDate) {
      toast.error("Preencha CRS, título, início e término.");
      return;
    }
    const participantEmails = users
      .filter((candidate) => selectedParticipantIds.includes(candidate.id) && candidate.email)
      .map((candidate) => candidate.email as string);
    createMut.mutate({
      crsId: Number(selectedCrsId),
      taskId: selectedTaskId ? Number(selectedTaskId) : undefined,
      title: form.title,
      description: form.description || undefined,
      startDate: new Date(form.startDate),
      endDate: new Date(form.endDate),
      participantIds: selectedParticipantIds,
      participantEmails,
    });
  }

  return (
    <AppLayout title="Reuniões">
      <div className="mx-auto max-w-7xl space-y-5 p-5">
        <div className="flex flex-col justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm md:flex-row md:items-center">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-600">Agenda operacional</p>
            <h1 className="mt-1 text-2xl font-bold text-slate-900">Reuniões</h1>
            <p className="mt-1 text-sm text-slate-500">Crie reuniões do Google Meet ligadas a um CRS, OS ou tarefa e acompanhe o relatório básico.</p>
          </div>
          <Button onClick={() => setShowCreate(true)} disabled={!connectedQ.data?.connected} className="gap-2">
            <Plus className="h-4 w-4" /> Nova reunião
          </Button>
        </div>

        {!connectedQ.data?.connected && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
            Conecte o Google Calendar para criar reuniões com link do Google Meet. A conexão é individual para cada usuário.
          </div>
        )}

        <div className="grid gap-5 lg:grid-cols-[280px_1fr]">
          <div className="space-y-4">
            <GoogleCalendarCard />
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm">Resumo</CardTitle></CardHeader>
              <CardContent className="grid grid-cols-2 gap-3 text-center">
                <div className="rounded-lg bg-blue-50 p-3"><p className="text-2xl font-bold text-blue-700">{meetings.length}</p><p className="text-xs text-slate-500">Reuniões</p></div>
                <div className="rounded-lg bg-emerald-50 p-3"><p className="text-2xl font-bold text-emerald-700">{meetings.filter((meeting) => meeting.status === "completed").length}</p><p className="text-xs text-slate-500">Com relatório</p></div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0">
              <div><CardTitle className="flex items-center gap-2"><CalendarClock className="h-5 w-5 text-blue-600" /> Agenda de reuniões</CardTitle><p className="mt-1 text-sm text-slate-500">Todos os usuários autenticados podem criar reuniões.</p></div>
              <Badge variant="outline">{meetings.length} registros</Badge>
            </CardHeader>
            <CardContent>
              {meetingsQ.isLoading ? <p className="py-10 text-center text-sm text-slate-500">Carregando reuniões...</p> : meetings.length === 0 ? (
                <div className="rounded-xl border border-dashed border-slate-300 p-10 text-center"><CalendarClock className="mx-auto h-8 w-8 text-slate-300" /><p className="mt-2 text-sm font-medium text-slate-600">Nenhuma reunião cadastrada.</p><p className="mt-1 text-xs text-slate-400">Crie a primeira reunião vinculada a um CRS ou tarefa.</p></div>
              ) : (
                <div className="space-y-3">
                  {meetings.map((meeting) => {
                    const plannedParticipants = parseJson<string[]>(meeting.participantEmails, []);
                    const actualParticipants = parseJson<Array<{ name: string }>>(meeting.actualParticipants, []);
                    const reportParticipants = actualParticipants.length ? actualParticipants.map((participant) => participant.name) : plannedParticipants;
                    const actualStart = meeting.actualStartDate ?? meeting.startDate;
                    const actualEnd = meeting.actualEndDate ?? meeting.endDate;
                    return (
                      <div key={meeting.id} className="rounded-xl border border-slate-200 bg-slate-50/70 p-4">
                        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2"><h3 className="font-semibold text-slate-900">{meeting.title}</h3><Badge variant={meeting.status === "completed" ? "default" : "outline"}>{meeting.status === "completed" ? "Relatório disponível" : "Agendada"}</Badge></div>
                            <p className="mt-1 text-sm text-slate-600">{meeting.crsCode ? `${meeting.crsCode} — ` : ""}{meeting.crsName ?? "CRS"}{meeting.taskTitle ? ` · ${meeting.taskTitle}` : ""}</p>
                            <div className="mt-3 grid gap-2 text-xs text-slate-500 sm:grid-cols-3"><span><strong className="text-slate-700">Data:</strong> {formatDate(actualStart)}</span><span><strong className="text-slate-700">Duração:</strong> {durationMinutes(actualStart, actualEnd)} min</span><span><strong className="text-slate-700">Participantes:</strong> {reportParticipants.length || 0}</span></div>
                            {reportParticipants.length > 0 && <p className="mt-2 flex items-center gap-1.5 text-xs text-slate-500"><Users className="h-3.5 w-3.5" /> {reportParticipants.join(", ")}</p>}
                          </div>
                          <div className="flex flex-wrap gap-2 md:justify-end">
                            {meeting.googleMeetUrl && <Button size="sm" variant="outline" className="gap-1.5" onClick={() => window.open(meeting.googleMeetUrl, "_blank", "noopener,noreferrer")}><ExternalLink className="h-3.5 w-3.5" /> Abrir Meet</Button>}
                            {meeting.createdById === user?.id && meeting.status !== "completed" && <Button size="sm" variant="outline" className="gap-1.5" onClick={() => syncMut.mutate({ id: meeting.id })} disabled={syncMut.isPending}><RefreshCw className="h-3.5 w-3.5" /> Sincronizar</Button>}
                            {meeting.createdById === user?.id && <Button size="sm" variant="ghost" className="text-red-600 hover:text-red-700" onClick={() => removeMut.mutate({ id: meeting.id })}>Remover</Button>}
                          </div>
                        </div>
                        <div className="mt-3 flex flex-wrap items-center gap-3 border-t border-slate-200 pt-2 text-xs text-slate-400"><span className="flex items-center gap-1"><Link2 className="h-3.5 w-3.5" /> Criada por {meeting.creatorName ?? "usuário"}</span>{meeting.lastSyncedAt && <span className="flex items-center gap-1"><CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" /> Atualizada em {formatDate(meeting.lastSyncedAt)}</span>}</div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader><DialogTitle>Nova reunião do Google Meet</DialogTitle></DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-2"><Label>CRS obrigatório</Label><Select value={selectedCrsId} onValueChange={(value) => { setSelectedCrsId(value); setSelectedTaskId(""); }}><SelectTrigger><SelectValue placeholder="Selecione o CRS" /></SelectTrigger><SelectContent>{(crsQ.data ?? []).map((crs: any) => <SelectItem key={crs.id} value={String(crs.id)}>{crs.code ? `${crs.code} — ` : ""}{crs.name}</SelectItem>)}</SelectContent></Select></div>
            <div className="grid gap-2"><Label>Tarefa ou OS relacionada <span className="text-xs text-slate-400">(opcional)</span></Label><Select value={selectedTaskId} onValueChange={setSelectedTaskId} disabled={!selectedCrsId}><SelectTrigger><SelectValue placeholder={selectedCrs ? "Selecione uma tarefa" : "Selecione o CRS primeiro"} /></SelectTrigger><SelectContent>{tasks.filter((task) => !selectedCrsId || task.crsId === Number(selectedCrsId)).map((task) => <SelectItem key={task.id} value={String(task.id)}>{task.title}</SelectItem>)}</SelectContent></Select></div>
            <div className="grid gap-2"><Label>Título</Label><Input value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} placeholder="Ex.: Reunião de alinhamento da OS" /></div>
            <div className="grid gap-2"><Label>Descrição</Label><Textarea value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} placeholder="Pauta ou observações para os convidados" /></div>
            <div className="grid gap-3 sm:grid-cols-2"><div className="grid gap-2"><Label>Início</Label><Input type="datetime-local" value={form.startDate} onChange={(event) => setForm({ ...form, startDate: event.target.value })} /></div><div className="grid gap-2"><Label>Término</Label><Input type="datetime-local" value={form.endDate} onChange={(event) => setForm({ ...form, endDate: event.target.value })} /></div></div>
            <div className="grid gap-2"><Label>Participantes</Label><div className="max-h-36 space-y-2 overflow-y-auto rounded-lg border border-slate-200 p-3">{users.length === 0 ? <p className="text-xs text-slate-400">Nenhum usuário disponível.</p> : users.map((candidate) => <label key={candidate.id} className="flex cursor-pointer items-center gap-2 text-sm"><input type="checkbox" checked={selectedParticipantIds.includes(candidate.id)} onChange={() => toggleParticipant(candidate.id)} /><span className="truncate">{candidate.name ?? candidate.email ?? `Usuário ${candidate.id}`}</span>{candidate.email && <span className="truncate text-xs text-slate-400">{candidate.email}</span>}</label>)}</div></div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setShowCreate(false)}>Cancelar</Button><Button onClick={submitCreate} disabled={createMut.isPending || !connectedQ.data?.connected}>{createMut.isPending ? "Criando..." : "Criar e gerar link Meet"}</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
