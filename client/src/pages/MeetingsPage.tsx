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
import { useEffect, useState, useMemo } from "react";
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

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("google_connected") === "true") {
      toast.success("Google Calendar conectado com sucesso!");
      window.history.replaceState({}, document.title, window.location.pathname);
    } else if (params.get("error") === "google_auth_failed") {
      toast.error("Falha ao autenticar com o Google Calendar. Verifique as credenciais.");
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, []);

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
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800 flex items-center justify-between">
            <span>Conecte sua conta do Google Calendar para criar reuniões no Meet e sincronizar sua agenda.</span>
            <div className="w-48">
              <GoogleCalendarCard />
            </div>
          </div>
        )}

        <div className="grid gap-4 md:grid-cols-3">
          {meetings.map((meeting: any) => {
            const participants = parseJson<any[]>(meeting.participants, []);
            const report = parseJson<any>(meeting.meetingReport, null);
            return (
              <Card key={meeting.id} className="relative overflow-hidden border-slate-200 shadow-sm">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <Badge variant="outline" className="mb-2 bg-slate-50 text-slate-700">{meeting.crsName || `CRS #${meeting.crsId}`}</Badge>
                      <CardTitle className="text-base font-bold text-slate-900">{meeting.title}</CardTitle>
                    </div>
                    <Badge className={meeting.status === "completed" ? "bg-emerald-100 text-emerald-700" : meeting.status === "cancelled" ? "bg-red-100 text-red-750" : "bg-blue-100 text-blue-700"}>
                      {meeting.status === "completed" ? "Concluída" : meeting.status === "cancelled" ? "Cancelada" : "Agendada"}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3 text-xs text-slate-600">
                  {meeting.description && <p className="text-slate-500 line-clamp-2">{meeting.description}</p>}
                  <div className="rounded-xl bg-slate-50 p-3 space-y-1.5 border border-slate-100">
                    <div className="flex items-center justify-between"><span className="text-slate-400">Início</span><span className="font-medium text-slate-800">{formatDate(meeting.startDate)}</span></div>
                    <div className="flex items-center justify-between"><span className="text-slate-400">Término</span><span className="font-medium text-slate-800">{formatDate(meeting.endDate)}</span></div>
                    <div className="flex items-center justify-between"><span className="text-slate-400">Duração</span><span className="font-medium text-slate-800">{durationMinutes(meeting.startDate, meeting.endDate)} min</span></div>
                  </div>

                  <div>
                    <p className="font-semibold text-slate-700 mb-1 flex items-center gap-1"><Users className="h-3.5 w-3.5 text-slate-400" /> Participantes ({participants.length})</p>
                    <div className="flex flex-wrap gap-1">
                      {participants.map((p, idx) => (
                        <span key={idx} className="inline-flex items-center rounded-md bg-slate-100 px-2 py-0.5 text-[11px] text-slate-700">{p.name || p.email}</span>
                      ))}
                      {participants.length === 0 && <span className="text-slate-400 italic">Nenhum participante extra.</span>}
                    </div>
                  </div>

                  {report && (
                    <div className="rounded-xl border border-emerald-100 bg-emerald-50/60 p-3 space-y-1 text-emerald-900">
                      <p className="font-semibold flex items-center gap-1 text-emerald-800"><CheckCircle2 className="h-3.5 w-3.5" /> Relatório Meet</p>
                      <p>Participantes reais: <span className="font-medium">{report.attendeesCount ?? "—"}</span></p>
                      <p>Duração real: <span className="font-medium">{report.actualDurationMinutes ?? "—"} min</span></p>
                    </div>
                  )}

                  <div className="pt-2 flex flex-wrap items-center gap-2">
                    {meeting.googleMeetUrl && (
                      <Button asChild size="sm" className="gap-1.5 bg-blue-600 hover:bg-blue-700 text-xs h-8">
                        <a href={meeting.googleMeetUrl} target="_blank" rel="noreferrer">
                          <ExternalLink className="h-3.5 w-3.5" /> Entrar no Meet
                        </a>
                      </Button>
                    )}
                    <Button variant="outline" size="sm" onClick={() => syncMut.mutate({ id: meeting.id })} disabled={syncMut.isPending} className="gap-1.5 text-xs h-8">
                      <RefreshCw className={`h-3.5 w-3.5 ${syncMut.isPending ? "animate-spin" : ""}`} /> Sincronizar Relatório
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => { if (confirm("Remover esta reunião?")) removeMut.mutate({ id: meeting.id }); }} className="text-red-600 hover:bg-red-50 text-xs h-8 ml-auto">
                      Excluir
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
          {meetings.length === 0 && (
            <div className="col-span-full rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center text-slate-500">
              <CalendarClock className="mx-auto h-10 w-10 text-slate-300 mb-3" />
              <p className="font-semibold text-slate-800">Nenhuma reunião agendada</p>
              <p className="text-xs text-slate-500 mt-1">Crie reuniões integradas ao Google Meet para organizar seus contratos e tarefas.</p>
            </div>
          )}
        </div>

        <Dialog open={showCreate} onOpenChange={setShowCreate}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Agendar Nova Reunião com Google Meet</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div>
                <Label>Contrato (CRS) *</Label>
                <Select value={selectedCrsId} onValueChange={setSelectedCrsId}>
                  <SelectTrigger><SelectValue placeholder="Selecione a CRS" /></SelectTrigger>
                  <SelectContent>
                    {(crsQ.data ?? []).map((c: any) => (
                      <SelectItem key={c.id} value={String(c.id)}>{c.name} {c.code ? `(${c.code})` : ""}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Tarefa Vinculada (Opcional)</Label>
                <Select value={selectedTaskId} onValueChange={setSelectedTaskId}>
                  <SelectTrigger><SelectValue placeholder="Selecione uma tarefa específica" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Nenhuma tarefa específica</SelectItem>
                    {tasks.map((t: any) => (
                      <SelectItem key={t.id} value={String(t.id)}>{t.title} ({t.projectName || "Contrato"})</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Título da Reunião *</Label>
                <Input value={form.title} onChange={(e) => setForm(f => ({ ...f, title: e.target.value }))} placeholder="Ex: Alinhamento de engenharia - Trecho Norte" />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Início *</Label>
                  <Input type="datetime-local" value={form.startDate} onChange={(e) => setForm(f => ({ ...f, startDate: e.target.value }))} />
                </div>
                <div>
                  <Label>Término *</Label>
                  <Input type="datetime-local" value={form.endDate} onChange={(e) => setForm(f => ({ ...f, endDate: e.target.value }))} />
                </div>
              </div>

              <div>
                <Label>Descrição / Pauta</Label>
                <Textarea value={form.description} onChange={(e) => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Tópicos que serão discutidos..." rows={3} />
              </div>

              <div>
                <Label className="mb-1.5 block">Participantes da Equipe</Label>
                <div className="max-h-40 overflow-y-auto rounded-xl border border-slate-200 p-2 space-y-1">
                  {users.map((member: any) => {
                    const isChecked = selectedParticipantIds.includes(member.id);
                    return (
                      <label key={member.id} className="flex items-center gap-2 rounded-lg p-1.5 hover:bg-slate-50 cursor-pointer text-xs">
                        <input type="checkbox" checked={isChecked} onChange={() => toggleParticipant(member.id)} className="rounded border-slate-300 text-blue-600 focus:ring-blue-500" />
                        <span className="font-medium text-slate-800">{member.name}</span>
                        <span className="text-slate-400 text-[11px] ml-auto">{member.email}</span>
                      </label>
                    );
                  })}
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowCreate(false)}>Cancelar</Button>
              <Button onClick={submitCreate} disabled={createMut.isPending} className="bg-blue-600 hover:bg-blue-700">
                {createMut.isPending ? "Criando e gerando Meet..." : "Criar Reunião e Gerar Meet"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
}
