import AppLayout from "@/components/AppLayout";
import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ChevronLeft, ChevronRight, Plus, CalendarDays, Plane, Users, Package } from "lucide-react";
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
const EVENT_ICONS: Record<string, React.ReactNode> = {
  meeting: <Users className="h-3 w-3" />,
  vacation: <Plane className="h-3 w-3" />,
  other: <Package className="h-3 w-3" />,
};

const WEEKDAYS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const MONTHS = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

export default function CalendarPage() {
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());
  const [showCreate, setShowCreate] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [form, setForm] = useState({
    title: "",
    type: "other" as "meeting" | "vacation" | "other",
    startDate: "",
    endDate: "",
    description: "",
    isPublic: true,
  });

  const agendaQ = trpc.agenda.list.useQuery({});
  const utils = trpc.useUtils();

  const createMut = trpc.agenda.create.useMutation({
    onSuccess: () => {
      utils.agenda.list.invalidate();
      setShowCreate(false);
      setForm({ title: "", type: "other", startDate: "", endDate: "", description: "", isPublic: true });
      toast.success("Evento criado!");
    },
    onError: (e) => toast.error(e.message),
  });
  const deleteMut = trpc.agenda.delete.useMutation({
    onSuccess: () => {
      utils.agenda.list.invalidate();
      toast.success("Evento removido.");
    },
  });

  const events = agendaQ.data ?? [];

  // Build calendar grid
  const calendarDays = useMemo(() => {
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const days: (Date | null)[] = [];
    // Padding before first day
    for (let i = 0; i < firstDay.getDay(); i++) days.push(null);
    for (let d = 1; d <= lastDay.getDate(); d++) days.push(new Date(year, month, d));
    return days;
  }, [year, month]);

  function getEventsForDay(date: Date) {
    return events.filter(e => {
      const start = new Date(e.startDate);
      const end = new Date(e.endDate);
      const d = date;
      return d >= new Date(start.getFullYear(), start.getMonth(), start.getDate()) &&
             d <= new Date(end.getFullYear(), end.getMonth(), end.getDate());
    });
  }

  function prevMonth() {
    if (month === 0) { setMonth(11); setYear(y => y - 1); }
    else setMonth(m => m - 1);
  }
  function nextMonth() {
    if (month === 11) { setMonth(0); setYear(y => y + 1); }
    else setMonth(m => m + 1);
  }

  function handleDayClick(date: Date) {
    setSelectedDate(date);
    const iso = date.toISOString().split("T")[0];
    setForm(f => ({ ...f, startDate: iso, endDate: iso }));
    setShowCreate(true);
  }

  function handleCreate() {
    if (!form.title || !form.startDate || !form.endDate) {
      toast.error("Preencha título e datas.");
      return;
    }
    createMut.mutate({
      title: form.title,
      type: form.type,
      startDate: new Date(form.startDate + "T00:00:00").getTime(),
      endDate: new Date(form.endDate + "T23:59:59").getTime(),
      description: form.description || undefined,
      isPublic: form.isPublic,
    });
  }

  const selectedDayEvents = selectedDate ? getEventsForDay(selectedDate) : [];

  return (
    <AppLayout title="Calendário">
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Calendário</h1>
          <p className="text-gray-500 text-sm mt-1">Visualize entregas, reuniões e ausências da equipe</p>
        </div>
        <Button onClick={() => { setSelectedDate(null); setShowCreate(true); }}>
          <Plus className="h-4 w-4 mr-1" /> Novo Evento
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Calendar */}
        <div className="lg:col-span-3">
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">
                  {MONTHS[month]} {year}
                </CardTitle>
                <div className="flex gap-1">
                  <Button variant="ghost" size="sm" onClick={prevMonth}>
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => { setMonth(today.getMonth()); setYear(today.getFullYear()); }}>
                    Hoje
                  </Button>
                  <Button variant="ghost" size="sm" onClick={nextMonth}>
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {/* Weekday headers */}
              <div className="grid grid-cols-7 mb-1">
                {WEEKDAYS.map(d => (
                  <div key={d} className="text-center text-xs font-medium text-gray-400 py-1">{d}</div>
                ))}
              </div>
              {/* Day cells */}
              <div className="grid grid-cols-7 gap-px bg-gray-200">
                {calendarDays.map((date, i) => {
                  if (!date) return <div key={i} className="bg-gray-50 h-24" />;
                  const dayEvents = getEventsForDay(date);
                  const isToday = date.toDateString() === today.toDateString();
                  return (
                    <div
                      key={i}
                      className="bg-white h-24 p-1 cursor-pointer hover:bg-indigo-50 transition-colors"
                      onClick={() => handleDayClick(date)}
                    >
                      <div className={`text-xs font-medium w-6 h-6 flex items-center justify-center rounded-full mb-1 ${
                        isToday ? "bg-indigo-600 text-white" : "text-gray-700"
                      }`}>
                        {date.getDate()}
                      </div>
                      <div className="space-y-0.5">
                        {dayEvents.slice(0, 3).map(e => (
                          <div
                            key={e.id}
                            className="text-xs px-1 py-0.5 rounded truncate text-white"
                            style={{ backgroundColor: EVENT_COLORS[e.type] ?? "#6366f1" }}
                            title={e.title}
                          >
                            {e.title}
                          </div>
                        ))}
                        {dayEvents.length > 3 && (
                          <div className="text-xs text-gray-400 px-1">+{dayEvents.length - 3} mais</div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Sidebar: upcoming events */}
        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <CalendarDays className="h-4 w-4" />
                Próximos Eventos
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {agendaQ.isLoading ? (
                <p className="text-xs text-gray-400">Carregando...</p>
              ) : events.length === 0 ? (
                <p className="text-xs text-gray-400">Nenhum evento cadastrado.</p>
              ) : (
                events
                  .filter(e => new Date(e.endDate) >= today)
                  .sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime())
                  .slice(0, 8)
                  .map(e => (
                    <div key={e.id} className="flex items-start gap-2 p-2 rounded-lg bg-gray-50 group">
                      <div
                        className="w-2 h-2 rounded-full mt-1.5 flex-shrink-0"
                        style={{ backgroundColor: EVENT_COLORS[e.type] ?? "#6366f1" }}
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium truncate">{e.title}</p>
                        <p className="text-xs text-gray-400">
                          {new Date(e.startDate).toLocaleDateString("pt-BR")}
                          {e.startDate !== e.endDate && ` – ${new Date(e.endDate).toLocaleDateString("pt-BR")}`}
                        </p>
                        <Badge
                          variant="outline"
                          className="text-xs mt-0.5"
                          style={{ borderColor: EVENT_COLORS[e.type], color: EVENT_COLORS[e.type] }}
                        >
                          {EVENT_LABELS[e.type]}
                        </Badge>
                      </div>
                      <button
                        className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-500 text-xs"
                        onClick={() => deleteMut.mutate({ id: e.id })}
                      >
                        ✕
                      </button>
                    </div>
                  ))
              )}
            </CardContent>
          </Card>

          {/* Legend */}
          <Card>
            <CardContent className="pt-4 space-y-2">
              {Object.entries(EVENT_LABELS).map(([key, label]) => (
                <div key={key} className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: EVENT_COLORS[key] }} />
                  <span className="text-xs text-gray-600">{label}</span>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Create Event Dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Novo Evento</DialogTitle>
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
              {createMut.isPending ? "Salvando..." : "Criar Evento"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
    </AppLayout>
  );
}
