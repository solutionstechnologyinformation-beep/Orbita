import AppLayout from "@/components/AppLayout";
import { SplitLayout, SplitPanelHeader, SplitPanelContent } from "@/components/SplitLayout";
import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ChevronLeft, ChevronRight, Plus, CalendarDays, User, ClipboardList } from "lucide-react";
import { toast } from "sonner";

const EVENT_COLORS: Record<string, string> = {
  meeting: "#3b82f6",
  vacation: "#f59e0b",
  other: "#6366f1",
};
const EVENT_LABELS: Record<string, string> = {
  meeting: "Reunião",
  vacation: "Férias/Ausência",
  other: "Outro",
};

// Task status colors matching the Kanban
const TASK_STATUS_COLORS: Record<string, string> = {
  pending: "#94a3b8",
  in_progress: "#3b82f6",
  shared: "#8b5cf6",
  published: "#22c55e",
  archived: "#6b7280",
  blocked: "#ef4444",
};
const TASK_STATUS_LABELS: Record<string, string> = {
  pending: "Para Iniciar",
  in_progress: "Em Andamento",
  shared: "Compartilhado",
  published: "Publicado",
  archived: "Arquivado",
  blocked: "Bloqueado",
};

const WEEKDAYS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const MONTHS = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

export default function CalendarPage() {
  const { user } = useAuth();
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());
  const [showCreate, setShowCreate] = useState(false);
  const [selectedDayDate, setSelectedDayDate] = useState<Date | null>(null);
  const [form, setForm] = useState({
    title: "",
    type: "other" as "meeting" | "vacation" | "other",
    startDate: "",
    endDate: "",
    description: "",
    isPublic: true,
  });

  // All events — shared calendar, all users see all events
  const agendaQ = trpc.agenda.list.useQuery({});
  // ALL tasks from contracts (not filtered by assignee)
  const allTasksQ = trpc.tasks.listForGantt.useQuery({});

  const utils = trpc.useUtils();

  const createMut = trpc.agenda.create.useMutation({
    onSuccess: () => {
      utils.agenda.list.invalidate();
      setShowCreate(false);
      setForm({ title: "", type: "other", startDate: "", endDate: "", description: "", isPublic: true });
      toast.success("Compromisso criado!");
    },
    onError: (e) => toast.error(e.message),
  });
  const deleteMut = trpc.agenda.delete.useMutation({
    onSuccess: () => {
      utils.agenda.list.invalidate();
      toast.success("Compromisso removido.");
    },
  });

  const events = (agendaQ.data ?? []) as any[];
  const allTasks = (allTasksQ.data ?? []) as any[];

  // Build calendar grid
  const calendarDays = useMemo(() => {
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const days: (Date | null)[] = [];
    for (let i = 0; i < firstDay.getDay(); i++) days.push(null);
    for (let d = 1; d <= lastDay.getDate(); d++) days.push(new Date(year, month, d));
    return days;
  }, [year, month]);

  function getEventsForDay(date: Date) {
    return events.filter((e: any) => {
      const start = new Date(e.startDate);
      const end = new Date(e.endDate);
      const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
      return d >= new Date(start.getFullYear(), start.getMonth(), start.getDate()) &&
             d <= new Date(end.getFullYear(), end.getMonth(), end.getDate());
    });
  }

  function getTasksForDay(date: Date) {
    return allTasks.filter((t: any) => {
      const due = t.dueDate ? new Date(t.dueDate) : null;
      const tStart = t.startDate ? new Date(t.startDate) : due;
      const tEnd = t.endDate ? new Date(t.endDate) : due;
      if (!tStart) return false;
      const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
      const s = new Date(tStart.getFullYear(), tStart.getMonth(), tStart.getDate());
      const e2 = tEnd ? new Date(tEnd.getFullYear(), tEnd.getMonth(), tEnd.getDate()) : s;
      return d >= s && d <= e2;
    });
  }

  // Upcoming events (next 30 days)
  const upcomingEvents = useMemo(() => {
    const now = new Date();
    const limit = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    return events
      .filter((e: any) => new Date(e.endDate) >= now && new Date(e.startDate) <= limit)
      .sort((a: any, b: any) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime())
      .slice(0, 10);
  }, [events]);

  function prevMonth() {
    if (month === 0) { setMonth(11); setYear(y => y - 1); }
    else setMonth(m => m - 1);
  }
  function nextMonth() {
    if (month === 11) { setMonth(0); setYear(y => y + 1); }
    else setMonth(m => m + 1);
  }

  function handleDayClick(date: Date) {
    setSelectedDayDate(date);
    const iso = date.toISOString().split("T")[0];
    setForm(f => ({ ...f, startDate: iso, endDate: iso }));
  }

  function handleCreate() {
    if (!form.title || !form.startDate || !form.endDate) {
      toast.error("Preencha título e datas.");
      return;
    }
    createMut.mutate({
      title: form.title,
      type: form.type,
      startDate: new Date(new Date(form.startDate + "T00:00:00").getTime()),
      endDate: new Date(new Date(form.endDate + "T23:59:59").getTime()),
      description: form.description || undefined,
      isPublic: form.isPublic,
    });
  }

  const selectedDayEvents = selectedDayDate ? getEventsForDay(selectedDayDate) : [];
  const selectedDayTasks = selectedDayDate ? getTasksForDay(selectedDayDate) : [];

  return (
    <AppLayout title="Calendário" fullHeight>
      <SplitLayout
        leftWidth="290px"
        left={
          <>
            <SplitPanelHeader
              title="Calendário"
              subtitle="Compromissos e Tarefas"
              action={
                <Button size="sm" onClick={() => { setSelectedDayDate(null); setShowCreate(true); }} className="gap-1.5 h-8 text-xs">
                  <Plus className="w-3.5 h-3.5" /> Novo
                </Button>
              }
            />
            <SplitPanelContent>
              <div className="space-y-4">
                {/* Upcoming events */}
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <CalendarDays className="h-4 w-4" />
                      Próximos Compromissos
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {agendaQ.isLoading ? (
                      <p className="text-xs text-gray-400">Carregando...</p>
                    ) : upcomingEvents.length === 0 ? (
                      <p className="text-xs text-gray-400">Nenhum compromisso nos próximos 30 dias.</p>
                    ) : (
                      upcomingEvents.map((e: any) => (
                        <div key={e.id} className="flex items-start gap-2 p-2 rounded-lg bg-gray-50 group">
                          <div className="w-2 h-2 rounded-full mt-1.5 flex-shrink-0" style={{ backgroundColor: EVENT_COLORS[e.type] ?? "#6366f1" }} />
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-medium truncate">{e.title}</p>
                            <div className="flex items-center gap-1">
                              <User className="h-3 w-3 text-gray-400" />
                              <span className="text-xs text-gray-500 truncate">{e.creatorName ?? "?"}</span>
                            </div>
                            <p className="text-xs text-gray-400">
                              {new Date(e.startDate).toLocaleDateString("pt-BR")}
                              {e.startDate !== e.endDate && ` – ${new Date(e.endDate).toLocaleDateString("pt-BR")}`}
                            </p>
                            <Badge variant="outline" className="text-xs mt-0.5" style={{ borderColor: EVENT_COLORS[e.type], color: EVENT_COLORS[e.type] }}>
                              {EVENT_LABELS[e.type]}
                            </Badge>
                          </div>
                          {e.createdById === user?.id && (
                            <button className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-500 text-xs" onClick={() => deleteMut.mutate({ id: e.id })}>✕</button>
                          )}
                        </div>
                      ))
                    )}
                  </CardContent>
                </Card>

                {/* Legend — Events */}
                <Card>
                  <CardContent className="pt-4 space-y-2">
                    <p className="text-xs font-semibold text-gray-500 mb-2 flex items-center gap-1.5">
                      <CalendarDays className="h-3.5 w-3.5" /> Legenda — Eventos
                    </p>
                    {Object.entries(EVENT_LABELS).map(([key, label]) => (
                      <div key={key} className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-sm flex-shrink-0" style={{ backgroundColor: EVENT_COLORS[key] }} />
                        <span className="text-xs text-gray-600">{label}</span>
                      </div>
                    ))}
                  </CardContent>
                </Card>

                {/* Legend — Tasks */}
                <Card>
                  <CardContent className="pt-4 space-y-2">
                    <p className="text-xs font-semibold text-gray-500 mb-2 flex items-center gap-1.5">
                      <ClipboardList className="h-3.5 w-3.5" /> Legenda — Tarefas dos Contratos
                    </p>
                    {Object.entries(TASK_STATUS_LABELS).map(([key, label]) => (
                      <div key={key} className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-sm flex-shrink-0" style={{ backgroundColor: TASK_STATUS_COLORS[key] }} />
                        <span className="text-xs text-gray-600">{label}</span>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              </div>
            </SplitPanelContent>
          </>
        }
        right={
          <SplitPanelContent noPadding>
            <div className="p-4 overflow-y-auto h-full space-y-4">
              {/* Main calendar */}
              <Card>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg">{MONTHS[month]} {year}</CardTitle>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="sm" onClick={prevMonth}><ChevronLeft className="h-4 w-4" /></Button>
                      <Button variant="ghost" size="sm" onClick={() => { setYear(today.getFullYear()); setMonth(today.getMonth()); }} className="text-xs px-2">Hoje</Button>
                      <Button variant="ghost" size="sm" onClick={nextMonth}><ChevronRight className="h-4 w-4" /></Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-7 mb-1">
                    {WEEKDAYS.map(d => (
                      <div key={d} className="text-center text-xs font-medium text-gray-400 py-1">{d}</div>
                    ))}
                  </div>
                  <div className="grid grid-cols-7 gap-px bg-gray-200">
                    {calendarDays.map((date, i) => {
                      if (!date) return <div key={i} className="bg-gray-50 h-24" />;
                      const dayEvents = getEventsForDay(date);
                      const dayTasks = getTasksForDay(date);
                      const isToday = date.toDateString() === today.toDateString();
                      const isSelected = selectedDayDate?.toDateString() === date.toDateString();
                      return (
                        <div
                          key={i}
                          className={`bg-white h-24 p-1 cursor-pointer hover:bg-indigo-50 transition-colors ${isSelected ? "ring-2 ring-inset ring-indigo-500" : ""}`}
                          onClick={() => handleDayClick(date)}
                        >
                          <div className={`text-xs font-medium w-6 h-6 flex items-center justify-center rounded-full mb-1 ${isToday ? "bg-indigo-600 text-white" : "text-gray-700"}`}>{date.getDate()}</div>
                          <div className="space-y-0.5">
                            {dayEvents.slice(0, 2).map((e: any) => (
                              <div key={e.id} className="text-xs px-1 py-0.5 rounded truncate text-white" style={{ backgroundColor: EVENT_COLORS[e.type] ?? "#6366f1" }} title={`${e.title} (${e.creatorName ?? "?"})`}>{e.title}</div>
                            ))}
                            {dayTasks.slice(0, Math.max(0, 3 - dayEvents.length)).map((t: any) => {
                              const statusKey = t.phaseName?.toLowerCase().includes("conclu") ? "published" :
                                t.phaseName?.toLowerCase().includes("andamento") ? "in_progress" :
                                t.phaseName?.toLowerCase().includes("bloqueado") ? "blocked" :
                                t.phaseName?.toLowerCase().includes("compartilhado") ? "shared" :
                                t.phaseName?.toLowerCase().includes("arquivado") ? "archived" : "pending";
                              const color = TASK_STATUS_COLORS[statusKey] ?? "#94a3b8";
                              return (
                                <div key={`t-${t.id}`} className="text-xs px-1 py-0.5 rounded truncate text-white" style={{ backgroundColor: color + "cc" }} title={`${t.title} — ${t.projectName ?? "Contrato"} (${t.assigneeName ?? "Sem responsável"})`}>
                                  📋 {t.title}
                                </div>
                              );
                            })}
                            {(dayEvents.length + dayTasks.length) > 3 && (
                              <div className="text-xs text-gray-400 px-1">+{dayEvents.length + dayTasks.length - 3} mais</div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>

              {/* Day detail panel */}
              {selectedDayDate && (
                <Card>
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-sm">{selectedDayDate.toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long" })}</CardTitle>
                      <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={() => { const iso = selectedDayDate.toISOString().split("T")[0]; setForm(f => ({ ...f, startDate: iso, endDate: iso })); setShowCreate(true); }}>
                        <Plus className="h-3 w-3" /> Evento
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {selectedDayEvents.length === 0 && selectedDayTasks.length === 0 && (
                      <p className="text-xs text-gray-400">Nenhum compromisso ou tarefa neste dia.</p>
                    )}

                    {/* Events */}
                    {selectedDayEvents.length > 0 && (
                      <div>
                        <p className="text-xs font-semibold text-blue-600 mb-1.5 flex items-center gap-1"><CalendarDays className="h-3 w-3" /> Eventos</p>
                        <div className="space-y-1.5">
                          {selectedDayEvents.map((e: any) => (
                            <div key={e.id} className="flex items-start gap-2 p-2 rounded-lg bg-gray-50 group">
                              <div className="w-2 h-2 rounded-full mt-1.5 flex-shrink-0" style={{ backgroundColor: EVENT_COLORS[e.type] ?? "#6366f1" }} />
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium truncate">{e.title}</p>
                                <div className="flex items-center gap-1 mt-0.5">
                                  <User className="h-3 w-3 text-gray-400" />
                                  <span className="text-xs text-gray-500">{e.creatorName ?? "Desconhecido"}</span>
                                  <Badge variant="outline" className="text-xs ml-1" style={{ borderColor: EVENT_COLORS[e.type], color: EVENT_COLORS[e.type] }}>{EVENT_LABELS[e.type]}</Badge>
                                </div>
                                {e.description && <p className="text-xs text-gray-400 mt-0.5">{e.description}</p>}
                              </div>
                              {e.createdById === user?.id && (
                                <button className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-500 text-xs" onClick={() => deleteMut.mutate({ id: e.id })}>✕</button>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Tasks from contracts */}
                    {selectedDayTasks.length > 0 && (
                      <div>
                        <p className="text-xs font-semibold text-slate-600 mb-1.5 flex items-center gap-1"><ClipboardList className="h-3 w-3" /> Tarefas dos Contratos ({selectedDayTasks.length})</p>
                        <div className="space-y-1.5">
                          {selectedDayTasks.map((t: any) => {
                            const statusKey = t.phaseName?.toLowerCase().includes("conclu") ? "published" :
                              t.phaseName?.toLowerCase().includes("andamento") ? "in_progress" :
                              t.phaseName?.toLowerCase().includes("bloqueado") ? "blocked" :
                              t.phaseName?.toLowerCase().includes("compartilhado") ? "shared" :
                              t.phaseName?.toLowerCase().includes("arquivado") ? "archived" : "pending";
                            const color = TASK_STATUS_COLORS[statusKey] ?? "#94a3b8";
                            const statusLabel = TASK_STATUS_LABELS[statusKey] ?? t.phaseName ?? "—";
                            return (
                              <div key={t.id} className="flex items-center gap-2 p-2 rounded-lg bg-slate-50 border border-slate-100">
                                <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
                                <div className="flex-1 min-w-0">
                                  <p className="text-xs font-medium truncate">{t.title}</p>
                                  <div className="flex items-center gap-2 mt-0.5">
                                    <span className="text-xs text-gray-400">{t.projectName ?? "Contrato"}</span>
                                    {t.assigneeName && <span className="text-xs text-gray-400">· {t.assigneeName}</span>}
                                  </div>
                                </div>
                                <span className="text-xs font-medium px-1.5 py-0.5 rounded-full text-white flex-shrink-0" style={{ backgroundColor: color }}>
                                  {statusLabel}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}
            </div>
          </SplitPanelContent>
        }
      />

      {/* Create Event Dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Novo Compromisso</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Título *</Label>
              <Input
                value={form.title}
                onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                placeholder="Ex: Reunião de alinhamento"
              />
            </div>
            <div>
              <Label>Tipo</Label>
              <Select
                value={form.type}
                onValueChange={v => setForm(f => ({ ...f, type: v as typeof form.type }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="meeting">Reunião</SelectItem>
                  <SelectItem value="vacation">Férias / Ausência</SelectItem>
                  <SelectItem value="other">Outro</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Data de Início *</Label>
                <Input
                  type="date"
                  value={form.startDate}
                  onChange={e => setForm(f => ({ ...f, startDate: e.target.value }))}
                />
              </div>
              <div>
                <Label>Data de Fim *</Label>
                <Input
                  type="date"
                  value={form.endDate}
                  onChange={e => setForm(f => ({ ...f, endDate: e.target.value }))}
                />
              </div>
            </div>
            <div>
              <Label>Descrição</Label>
              <Input
                value={form.description}
                onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                placeholder="Detalhes adicionais..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreate(false)}>Cancelar</Button>
            <Button onClick={handleCreate} disabled={createMut.isPending}>
              {createMut.isPending ? "Salvando..." : "Criar Compromisso"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
