import { useState } from "react";
import { useParams, useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { toast } from "sonner";
import AppLayout from "@/components/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import {
  ArrowLeft, Edit2, Save, X, Plus, Trash2, MessageSquare,
  CheckSquare, History, Loader2, User, Calendar, ChevronDown
} from "lucide-react";
import { formatDistanceToNow, format } from "date-fns";
import { ptBR } from "date-fns/locale";

const PRIORITY_LABELS: Record<string, string> = { low: "Baixa", medium: "Media", high: "Alta", urgent: "Urgente" };
const PRIORITY_COLORS: Record<string, string> = {
  low: "bg-slate-100 text-slate-700",
  medium: "bg-blue-100 text-blue-700",
  high: "bg-orange-100 text-orange-700",
  urgent: "bg-red-100 text-red-700",
};
const STATUS_LABELS: Record<string, string> = {
  pending: "Para Iniciar", in_progress: "Em Andamento", shared: "Em Andamento",
  published: "Concluído", archived: "Concluído", blocked: "Bloqueado",
};
const STATUS_COLORS: Record<string, string> = {
  pending: "bg-gray-100 text-gray-700",
  in_progress: "bg-blue-100 text-blue-700",
  shared: "bg-purple-100 text-purple-700",
  published: "bg-green-100 text-green-700",
  archived: "bg-blue-100 text-blue-700",
  blocked: "bg-red-100 text-red-700",
};

export default function TaskDetail() {
  const params = useParams<{ id: string }>();
  const taskId = Number(params.id);
  const [, navigate] = useLocation();
  const { user } = useAuth();

  const [editMode, setEditMode] = useState(false);
  const [newChecklistTitle, setNewChecklistTitle] = useState("");
  const [newChecklistStartDate, setNewChecklistStartDate] = useState("");
  const [newChecklistEndDate, setNewChecklistEndDate] = useState("");
  const [showChecklistDates, setShowChecklistDates] = useState(false);
  const [newChecklistAssigneeId, setNewChecklistAssigneeId] = useState<string>("_none");
  const [newComment, setNewComment] = useState("");
  const [deleteChecklistId, setDeleteChecklistId] = useState<number | null>(null);
  const [deleteChecklistReason, setDeleteChecklistReason] = useState("");
  const [editTitle, setEditTitle] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editPriority, setEditPriority] = useState("");
  const [editAssigneeId, setEditAssigneeId] = useState<string>("");
  const [editDueDate, setEditDueDate] = useState("");
  const [editSetor, setEditSetor] = useState("");

  // tasks.get returns { ...task, comments, checklist, phaseHistory, checklistHistory }
  const taskQ = trpc.tasks.get.useQuery({ id: taskId }, { enabled: !!taskId });
  const usersQ = trpc.users.list.useQuery();
  const disciplinesQ = trpc.disciplines.list.useQuery();
  const phasesQ = trpc.kanbanPhases.list.useQuery(
    { crsId: (taskQ.data as any)?.crsId! },
    { enabled: !!(taskQ.data as any)?.crsId }
  );
  const utils = trpc.useUtils();

  const invalidateTask = () => utils.tasks.get.invalidate({ id: taskId });

  const updateTaskM = trpc.tasks.update.useMutation({
    onSuccess: () => { invalidateTask(); setEditMode(false); toast.success("Tarefa atualizada!"); },
    onError: (e) => toast.error("Erro: " + e.message),
  });

  const updateChecklistM = trpc.checklist.update.useMutation({
    onSuccess: () => { invalidateTask(); toast.success("Item atualizado!"); },
    onError: (e) => toast.error(e.message),
  });

  const addChecklistM = trpc.checklist.create.useMutation({
    onSuccess: () => {
      invalidateTask();
      setNewChecklistTitle("");
      setNewChecklistStartDate("");
      setNewChecklistEndDate("");
      setShowChecklistDates(false);
      setNewChecklistAssigneeId("_none");
      toast.success("Item adicionado!");
    },
    onError: (e) => toast.error(e.message),
  });

  const updateChecklistStatusM = trpc.checklist.updateStatus.useMutation({
    onSuccess: () => invalidateTask(),
    onError: (e) => toast.error(e.message),
  });

  const deleteChecklistM = trpc.checklist.delete.useMutation({
    onSuccess: () => { invalidateTask(); toast.success("Item removido!"); },
    onError: (e) => toast.error(e.message),
  });

  const addCommentM = trpc.tasks.addComment.useMutation({
    onSuccess: () => { invalidateTask(); setNewComment(""); },
    onError: (e) => toast.error(e.message),
  });

  const deleteCommentM = trpc.tasks.deleteComment.useMutation({
    onSuccess: () => invalidateTask(),
    onError: (e) => toast.error(e.message),
  });

  const movePhaseM = trpc.tasks.movePhase.useMutation({
    onSuccess: () => { invalidateTask(); toast.success("Fase atualizada!"); },
    onError: (e) => toast.error(e.message),
  });

  const task = taskQ.data as any;
  const checklist = (task?.checklist ?? []) as any[];
  const comments = (task?.comments ?? []) as any[];
  const phaseHistory = (task?.phaseHistory ?? []) as any[];
  const checklistHistory = (task?.checklistHistory ?? []) as any[];
  const phases = (phasesQ.data ?? []) as any[];
  const doneCount = checklist.filter((i: any) => i.status === "published" || i.status === "archived").length;
  const progress = checklist.length > 0 ? Math.round((doneCount / checklist.length) * 100) : task?.progress ?? 0;

  const startEdit = () => {
    setEditTitle(task?.title ?? "");
    setEditDescription(task?.description ?? "");
    setEditPriority(task?.priority ?? "medium");
    setEditAssigneeId(task?.assigneeId ? String(task.assigneeId) : "");
    setEditDueDate(task?.dueDate ? format(new Date(task.dueDate), "yyyy-MM-dd") : "");
    setEditSetor(task?.setor ?? "");
    setEditMode(true);
  };

  const saveEdit = () => {
    updateTaskM.mutate({
      id: taskId,
      title: editTitle || undefined,
      description: editDescription || undefined,
      priority: (editPriority as any) || undefined,
      assigneeId: editAssigneeId ? Number(editAssigneeId) : null,
      dueDate: editDueDate ? new Date(editDueDate) : null,
      setor: editSetor || null,
    });
  };

  if (taskQ.isLoading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </AppLayout>
    );
  }

  if (!task) {
    return (
      <AppLayout>
        <div className="container py-8 text-center">
          <p className="text-muted-foreground">Tarefa nao encontrada.</p>
          <Button variant="outline" className="mt-4" onClick={() => navigate("/kanban")}>
            <ArrowLeft className="h-4 w-4 mr-2" /> Voltar ao Kanban
          </Button>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="container max-w-4xl py-6">
        <div className="flex items-center gap-3 mb-6">
          <Button variant="ghost" size="icon" onClick={() => navigate("/kanban")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex-1 min-w-0">
            {editMode ? (
              <Input value={editTitle} onChange={e => setEditTitle(e.target.value)} className="text-xl font-bold h-10" />
            ) : (
              <h1 className="text-xl font-bold truncate">{task.title}</h1>
            )}
          </div>
          <div className="flex items-center gap-2">
            {editMode ? (
              <>
                <Button size="sm" onClick={saveEdit} disabled={updateTaskM.isPending}>
                  <Save className="h-4 w-4 mr-1" /> Salvar
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setEditMode(false)}>
                  <X className="h-4 w-4" />
                </Button>
              </>
            ) : (
              (user?.role === "admin" || user?.role === "leader") && (
                <Button size="sm" variant="outline" onClick={startEdit}>
                  <Edit2 className="h-4 w-4 mr-1" /> Editar
                </Button>
              )
            )}
          </div>
        </div>

        <div className="flex flex-wrap gap-2 mb-6">
          <Badge className={PRIORITY_COLORS[task.priority] ?? ""}>{PRIORITY_LABELS[task.priority] ?? task.priority}</Badge>
          {task.setor && <Badge variant="outline">{task.setor}</Badge>}
          {task.crsName && <Badge variant="secondary">{task.crsName}</Badge>}
          {task.dueDate && (
            <Badge variant="outline" className="text-muted-foreground">
              Prazo: {format(new Date(task.dueDate), "dd/MM/yyyy")}
            </Badge>
          )}
        </div>

        <Card className="mb-6">
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium">Progresso</span>
              <span className="text-sm font-bold text-primary">{progress}%</span>
            </div>
            <Progress value={progress} className="h-2" />
            <p className="text-xs text-muted-foreground mt-1">{doneCount} de {checklist.length} itens concluidos</p>
          </CardContent>
        </Card>

        {(user?.role === "admin" || user?.role === "leader") && phases.length > 0 && (
          <Card className="mb-6">
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center gap-3">
                <span className="text-sm font-medium">Fase atual:</span>
                <Select
                  value={String(task.phaseId)}
                  onValueChange={(v) => movePhaseM.mutate({ id: taskId, phaseId: Number(v) })}
                >
                  <SelectTrigger className="w-48 h-8">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {phases.map((p: any) => (
                      <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>
        )}

        {editMode && (
          <Card className="mb-6">
            <CardContent className="pt-4 space-y-4">
              <div>
                <label className="text-sm font-medium mb-1 block">Descricao</label>
                <Textarea value={editDescription} onChange={e => setEditDescription(e.target.value)} rows={3} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium mb-1 block">Prioridade</label>
                  <Select value={editPriority} onValueChange={setEditPriority}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">Baixa</SelectItem>
                      <SelectItem value="medium">Media</SelectItem>
                      <SelectItem value="high">Alta</SelectItem>
                      <SelectItem value="urgent">Urgente</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">Responsavel</label>
                  <Select value={editAssigneeId || "_none"} onValueChange={(v) => setEditAssigneeId(v === "_none" ? "" : v)}>
                    <SelectTrigger><SelectValue placeholder="Sem responsavel" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="_none">Sem responsavel</SelectItem>
                      {usersQ.data?.map((u: any) => (
                        <SelectItem key={u.id} value={String(u.id)}>{u.name ?? u.email}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">Prazo</label>
                  <Input type="date" value={editDueDate} onChange={e => setEditDueDate(e.target.value)} />
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">Setor/Disciplina</label>
                  <Select value={editSetor || "_none"} onValueChange={(v) => setEditSetor(v === "_none" ? "" : v)}>
                    <SelectTrigger><SelectValue placeholder="Sem setor" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="_none">Sem setor</SelectItem>
                      {disciplinesQ.data?.map((d: any) => (
                        <SelectItem key={d.id} value={d.name}>{d.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        <Tabs defaultValue="checklist">
          <TabsList className="mb-4">
            <TabsTrigger value="checklist">
              <CheckSquare className="h-4 w-4 mr-1" />
              Checklist ({checklist.length})
            </TabsTrigger>
            <TabsTrigger value="comments">
              <MessageSquare className="h-4 w-4 mr-1" />
              Comentarios ({comments.length})
            </TabsTrigger>
            <TabsTrigger value="history">
              <History className="h-4 w-4 mr-1" />
              Histórico ({phaseHistory.length + checklistHistory.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="checklist">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Itens do Checklist</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {checklist.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-4">Nenhum item no checklist</p>
                )}
                {checklist.map((item: any) => {
                  const isDone = item.status === "published" || item.status === "archived";
                  const canEdit = user?.role === "admin" || user?.role === "leader" || item.assigneeId === user?.id;
                  const isAdmin = user?.role === "admin" || user?.role === "leader";
                  return (
                    <div key={item.id} className="flex items-start gap-3 p-3 rounded-lg border bg-card">
                      <Checkbox
                        checked={isDone}
                        disabled={!canEdit || updateChecklistStatusM.isPending}
                        onCheckedChange={(checked) => {
                          updateChecklistStatusM.mutate({
                            id: item.id,
                            status: checked ? "published" : "in_progress",
                          });
                        }}
                        className="mt-0.5"
                      />
                      <div className="flex-1 min-w-0">
                        <p className={"text-sm font-medium " + (isDone ? "line-through text-muted-foreground" : "")}>
                          {item.title}
                        </p>
                        {item.description && (
                          <p className="text-xs text-muted-foreground mt-0.5">{item.description}</p>
                        )}
                        {/* Datas do item de checklist */}
                        {(item.startDate || item.endDate) && (
                          <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                            <Calendar className="h-3 w-3" />
                            {item.startDate && <span>Início: <strong>{new Date(item.startDate).toLocaleDateString("pt-BR")}</strong></span>}
                            {item.startDate && item.endDate && <span>•</span>}
                            {item.endDate && <span>Entrega: <strong>{new Date(item.endDate).toLocaleDateString("pt-BR")}</strong></span>}
                          </div>
                        )}
                        <div className="flex flex-wrap items-center gap-2 mt-1">
                          <Badge className={"text-xs " + (STATUS_COLORS[item.status] ?? "")} variant="outline">
                            {STATUS_LABELS[item.status] ?? item.status}
                          </Badge>
                          {isAdmin ? (
                            <Select
                              value={item.assigneeId ? String(item.assigneeId) : "_none"}
                              onValueChange={(v) => updateChecklistM.mutate({ id: item.id, assigneeId: v !== "_none" ? Number(v) : null })}
                            >
                              <SelectTrigger className="h-6 text-xs w-36">
                                <SelectValue placeholder="Sem responsável" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="_none">Sem responsável</SelectItem>
                                {(usersQ.data ?? []).map((u: any) => (
                                  <SelectItem key={u.id} value={String(u.id)}>{u.name}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          ) : item.assigneeName ? (
                            <span className="text-xs text-muted-foreground flex items-center gap-1">
                              <User className="h-3 w-3" />{item.assigneeName}
                            </span>
                          ) : null}
                          {canEdit && (
                            <Select
                              value={item.status}
                              onValueChange={(s) => updateChecklistStatusM.mutate({ id: item.id, status: s as any })}
                            >
                              <SelectTrigger className="h-6 text-xs w-36">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="pending">Para Iniciar</SelectItem>
                                <SelectItem value="in_progress">Em Andamento</SelectItem>
                                <SelectItem value="published">Concluído</SelectItem>
                              </SelectContent>
                            </Select>
                          )}
                          {/* Editar datas inline */}
                          {isAdmin && (
                            <div className="flex items-center gap-1 ml-auto">
                              <input
                                type="date"
                                className="h-6 text-xs border border-border rounded px-1 bg-background"
                                title="Data de início"
                                defaultValue={item.startDate ? format(new Date(item.startDate), "yyyy-MM-dd") : ""}
                                onBlur={(e) => {
                                  const val = e.target.value;
                                  updateChecklistM.mutate({ id: item.id, startDate: val || null });
                                }}
                              />
                              <span className="text-muted-foreground/40 text-xs">→</span>
                              <input
                                type="date"
                                className="h-6 text-xs border border-border rounded px-1 bg-background"
                                title="Data de entrega"
                                defaultValue={item.endDate ? format(new Date(item.endDate), "yyyy-MM-dd") : ""}
                                onBlur={(e) => {
                                  const val = e.target.value;
                                  updateChecklistM.mutate({ id: item.id, endDate: val || null });
                                }}
                              />
                            </div>
                          )}
                        </div>
                      </div>
                      {(user?.role === "admin" || user?.role === "leader") && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-destructive hover:text-destructive"
                          onClick={() => { setDeleteChecklistId(item.id); setDeleteChecklistReason(""); }}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </div>
                  );
                })}
                {(user?.role === "admin" || user?.role === "leader") && (
                  <div className="space-y-2 pt-2 border-t">
                    <p className="text-xs font-medium text-muted-foreground pt-1">Novo item</p>
                    <div className="flex gap-2">
                      <Input
                        placeholder="Título do item..."
                        value={newChecklistTitle}
                        onChange={e => setNewChecklistTitle(e.target.value)}
                        onKeyDown={e => {
                          if (e.key === "Enter" && newChecklistTitle.trim()) {
                            addChecklistM.mutate({
                              taskId, title: newChecklistTitle.trim(),
                              assigneeId: newChecklistAssigneeId !== "_none" ? Number(newChecklistAssigneeId) : undefined,
                              startDate: newChecklistStartDate || undefined,
                              endDate: newChecklistEndDate || undefined,
                            });
                          }
                        }}
                      />
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-muted-foreground"
                        onClick={() => setShowChecklistDates(v => !v)}
                        title="Definir datas"
                      >
                        <Calendar className="h-4 w-4" />
                        <ChevronDown className={"h-3 w-3 ml-0.5 transition-transform " + (showChecklistDates ? "rotate-180" : "")} />
                      </Button>
                      <Button
                        size="sm"
                        disabled={!newChecklistTitle.trim() || addChecklistM.isPending}
                        onClick={() => addChecklistM.mutate({
                          taskId, title: newChecklistTitle.trim(),
                          assigneeId: newChecklistAssigneeId !== "_none" ? Number(newChecklistAssigneeId) : undefined,
                          startDate: newChecklistStartDate || undefined,
                          endDate: newChecklistEndDate || undefined,
                        })}
                      >
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>
                    {/* Seletor de responsável para novo item */}
                    <div className="flex items-center gap-2">
                      <User className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                      <span className="text-xs text-muted-foreground">Responsável:</span>
                      <Select value={newChecklistAssigneeId} onValueChange={setNewChecklistAssigneeId}>
                        <SelectTrigger className="h-7 text-xs flex-1">
                          <SelectValue placeholder="Herdar da tarefa" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="_none">Herdar da tarefa ({(usersQ.data ?? []).find((u: any) => u.id === (taskQ.data as any)?.assigneeId)?.name ?? "nenhum"})</SelectItem>
                          {(usersQ.data ?? []).map((u: any) => (
                            <SelectItem key={u.id} value={String(u.id)}>{u.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    {showChecklistDates && (
                      <div className="flex items-center gap-2 pl-1">
                        <Calendar className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <span>Início:</span>
                          <input
                            type="date"
                            className="h-7 text-xs border border-border rounded px-2 bg-background"
                            value={newChecklistStartDate}
                            onChange={e => setNewChecklistStartDate(e.target.value)}
                          />
                        </div>
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <span>Entrega:</span>
                          <input
                            type="date"
                            className="h-7 text-xs border border-border rounded px-2 bg-background"
                            value={newChecklistEndDate}
                            onChange={e => setNewChecklistEndDate(e.target.value)}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="comments">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Comentarios</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {comments.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-4">Nenhum comentario ainda</p>
                )}
                {comments.map((c: any) => (
                  <div key={c.id} className="flex gap-3">
                    <Avatar className="h-8 w-8 shrink-0">
                      <AvatarImage src={c.userAvatar ?? ""} />
                      <AvatarFallback className="text-xs bg-primary text-primary-foreground">
                        {(c.userName ?? "U").slice(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">{c.userName ?? "Usuario"}</span>
                        <span className="text-xs text-muted-foreground">
                          {formatDistanceToNow(new Date(c.createdAt), { addSuffix: true, locale: ptBR })}
                        </span>
                      </div>
                      <p className="text-sm mt-0.5">{c.content}</p>
                    </div>
                    {(user?.id === c.userId || user?.role === "admin") && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-muted-foreground hover:text-destructive shrink-0"
                        onClick={() => deleteCommentM.mutate({ id: c.id })}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                ))}
                <div className="flex gap-2 pt-2">
                  <Textarea
                    placeholder="Adicionar comentario..."
                    value={newComment}
                    onChange={e => setNewComment(e.target.value)}
                    rows={2}
                    className="resize-none"
                  />
                  <Button
                    size="sm"
                    className="self-end"
                    disabled={!newComment.trim() || addCommentM.isPending}
                    onClick={() => addCommentM.mutate({ taskId, content: newComment.trim() })}
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="history">
            <div className="space-y-4">
              {/* Phase history */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <History className="w-4 h-4" />
                    Movimentações de Fase
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {phaseHistory.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">Nenhuma movimentação registrada</p>
                  ) : (
                    <div className="space-y-3">
                      {phaseHistory.map((h: any, idx: number) => (
                        <div key={h.id ?? idx} className="flex gap-3 items-start">
                          <div className="w-2 h-2 rounded-full bg-primary mt-2 shrink-0" />
                          <div>
                            <p className="text-sm">
                              <span className="font-medium">{h.changedByName ?? "Sistema"}</span>
                              {" moveu de "}
                              <Badge variant="outline" className="text-xs">{h.fromPhaseName ?? "início"}</Badge>
                              {" para "}
                              <Badge variant="outline" className="text-xs">{h.toPhaseName ?? "desconhecida"}</Badge>
                            </p>
                            <p className="text-xs text-muted-foreground mt-0.5">
                              {h.changedAt
                                ? formatDistanceToNow(new Date(h.changedAt), { addSuffix: true, locale: ptBR })
                                : ""}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
              {/* Checklist history */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <CheckSquare className="w-4 h-4" />
                    Histórico de Checklist
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {checklistHistory.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">Nenhuma alteração de checklist registrada</p>
                  ) : (
                    <div className="space-y-3">
                      {checklistHistory.map((h: any, idx: number) => {
                        const STATUS_LABEL: Record<string, string> = {
                          pending: "Para Iniciar",
                          in_progress: "Em Andamento",
                          shared: "Em Revisão",
                          published: "Aprovado",
                          archived: "Arquivado",
                          blocked: "Bloqueado",
                        };
                        return (
                          <div key={h.id ?? idx} className="flex gap-3 items-start">
                            <div className="w-2 h-2 rounded-full bg-emerald-500 mt-2 shrink-0" />
                            <div>
                              <p className="text-sm">
                                <span className="font-medium">{h.changedByName ?? "Sistema"}</span>
                                {" alterou status de "}
                                <Badge variant="outline" className="text-xs">{STATUS_LABEL[h.fromStatus] ?? h.fromStatus ?? "—"}</Badge>
                                {" para "}
                                <Badge variant="outline" className="text-xs">{STATUS_LABEL[h.toStatus] ?? h.toStatus}</Badge>
                              </p>
                              <p className="text-xs text-muted-foreground mt-0.5">
                                {h.changedAt
                                  ? formatDistanceToNow(new Date(h.changedAt), { addSuffix: true, locale: ptBR })
                                  : ""}
                              </p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>
      {/* Dialog de exclusão de item do checklist com motivo */}
      <Dialog open={deleteChecklistId !== null} onOpenChange={(o) => { if (!o) setDeleteChecklistId(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Excluir item do checklist</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <p className="text-sm text-muted-foreground">Esta ação não pode ser desfeita. O motivo será registrado no histórico de atividades.</p>
            <div className="space-y-1">
              <label className="text-sm font-medium">Motivo da exclusão</label>
              <textarea
                className="w-full border rounded-md px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
                rows={3}
                placeholder="Informe o motivo (opcional)..."
                value={deleteChecklistReason}
                onChange={e => setDeleteChecklistReason(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteChecklistId(null)}>Cancelar</Button>
            <Button
              variant="destructive"
              disabled={deleteChecklistM.isPending}
              onClick={() => {
                if (deleteChecklistId !== null) {
                  deleteChecklistM.mutate({ id: deleteChecklistId, reason: deleteChecklistReason || undefined }, {
                    onSuccess: () => setDeleteChecklistId(null),
                  });
                }
              }}
            >
              {deleteChecklistM.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Excluir"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
