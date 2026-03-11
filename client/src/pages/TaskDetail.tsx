import AppLayout from "@/components/AppLayout";
import { trpc } from "@/lib/trpc";
import { useParams } from "wouter";
import { toast } from "sonner";
import { useState, useRef, useEffect } from "react";
import {
  MessageSquare, Paperclip, Flag, Calendar, User2,
  Send, Upload, Trash2, Download, FileText, Image,
  CheckCircle2, Clock, ListTodo, Edit2, Save, X, TrendingUp, Share2, Pencil, Eye, History, ArrowRight,
} from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

const PRIORITY_LABELS: Record<string, string> = {
  low: "Baixa", medium: "Média", high: "Alta", urgent: "Urgente",
};
const STATUS_LABELS: Record<string, string> = {
  pending: "Para Iniciar",
  in_progress: "Em Andamento",
  shared: "Compartilhado",
  published: "Publicado",
  archived: "Arquivado",
};

const STATUS_COLORS: Record<string, string> = {
  pending: "bg-slate-500/20 text-slate-400 border-slate-500/30",
  in_progress: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  shared: "bg-purple-500/20 text-purple-400 border-purple-500/30",
  published: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
  archived: "bg-gray-500/20 text-gray-400 border-gray-500/30",
  blocked: "bg-red-500/20 text-red-400 border-red-500/30",
};

function StatusHistorySection({ taskId }: { taskId: number }) {
  const { data: history, isLoading } = trpc.statusHistory.list.useQuery({ taskId });
  if (isLoading) return <div className="space-y-2">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div>;
  if (!history?.length) return (
    <div className="flex flex-col items-center py-6 text-center">
      <History className="w-8 h-8 text-muted-foreground/20 mb-2" />
      <p className="text-sm text-muted-foreground">Nenhuma alteração de status registrada.</p>
    </div>
  );
  return (
    <div className="space-y-3">
      {history.map((h: any) => (
        <div key={h.id} className="flex items-start gap-3">
          <div className="w-2 h-2 rounded-full bg-primary/60 mt-2 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              {h.fromStatus && (
                <Badge variant="outline" className={`text-xs border ${STATUS_COLORS[h.fromStatus] ?? ""}`}>
                  {STATUS_LABELS[h.fromStatus] ?? h.fromStatus}
                </Badge>
              )}
              {h.fromStatus && <ArrowRight className="w-3 h-3 text-muted-foreground flex-shrink-0" />}
              <Badge variant="outline" className={`text-xs border ${STATUS_COLORS[h.toStatus] ?? ""}`}>
                {STATUS_LABELS[h.toStatus] ?? h.toStatus}
              </Badge>
            </div>
            {h.blockReason && (
              <p className="text-xs text-muted-foreground mt-1">Motivo: {h.blockReason}</p>
            )}
            <p className="text-xs text-muted-foreground mt-0.5">
              {h.changedByName ?? "Usuário"} · {new Date(h.changedAt).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}

function FileIcon({ mimeType }: { mimeType?: string | null }) {
  if (mimeType?.startsWith("image/")) return <Image className="w-4 h-4 text-blue-400" />;
  return <FileText className="w-4 h-4 text-muted-foreground" />;
}

function AssigneeSelect({
  projectId,
  taskId,
  currentAssigneeId,
  currentAssigneeName,
}: {
  projectId: number;
  taskId: number;
  currentAssigneeId?: number | null;
  currentAssigneeName?: string | null;
}) {
  const utils = trpc.useUtils();
  const { data: members, isLoading } = trpc.projects.members.useQuery(
    { projectId },
    { enabled: !!projectId }
  );

  const updateMutation = trpc.tasks.update.useMutation({
    onSuccess: () => {
      utils.tasks.get.invalidate({ id: taskId });
      toast.success("Responsável atualizado!");
    },
    onError: (e) => toast.error(e.message),
  });

  if (isLoading) return <span className="text-xs text-muted-foreground">Carregando...</span>;

  const currentValue = currentAssigneeId ? String(currentAssigneeId) : "none";

  return (
    <div className="flex items-center gap-2">
      {currentAssigneeName && (
        <Avatar className="w-6 h-6 flex-shrink-0">
          <AvatarFallback className="text-[10px] bg-primary/20 text-primary">
            {currentAssigneeName.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()}
          </AvatarFallback>
        </Avatar>
      )}
      <Select
        value={currentValue}
        onValueChange={(v) =>
          updateMutation.mutate({
            id: taskId,
            assigneeId: v === "none" ? null : parseInt(v),
          })
        }
      >
        <SelectTrigger className="h-8 bg-input border-border text-xs flex-1">
          <SelectValue placeholder="Atribuir responsável">
            {currentAssigneeName ?? (
              <span className="flex items-center gap-1.5 text-muted-foreground">
                <User2 className="w-3 h-3" /> Não atribuído
              </span>
            )}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="none">
            <span className="flex items-center gap-1.5 text-muted-foreground">
              <User2 className="w-3 h-3" /> Sem responsável
            </span>
          </SelectItem>
          {(members ?? []).map((m: any) => (
            <SelectItem key={m.userId} value={String(m.userId)}>
              <span className="flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-primary/20 text-primary text-[10px] flex items-center justify-center font-medium">
                  {(m.userName ?? "?").slice(0, 2).toUpperCase()}
                </span>
                {m.userName ?? `Usuário ${m.userId}`}
              </span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

export default function TaskDetail() {
  const { id } = useParams<{ id: string }>();
  const taskId = parseInt(id ?? "0");
  const utils = trpc.useUtils();

  const [comment, setComment] = useState("");
  const [editingStatus, setEditingStatus] = useState(false);
  const [editingPriority, setEditingPriority] = useState(false);

  // Inline title/description editing
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleInput, setTitleInput] = useState("");
  const [editingDescription, setEditingDescription] = useState(false);
  const [descriptionInput, setDescriptionInput] = useState("");
  const titleInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editingTitle && titleInputRef.current) titleInputRef.current.focus();
  }, [editingTitle]);
  const [editingDates, setEditingDates] = useState(false);
  const [startDateInput, setStartDateInput] = useState("");
  const [endDateInput, setEndDateInput] = useState("");
  const [dueDateInput, setDueDateInput] = useState("");
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [previewAttachment, setPreviewAttachment] = useState<{ url: string; filename: string; mimeType?: string | null } | null>(null);

  const { data: task, isLoading } = trpc.tasks.get.useQuery({ id: taskId });
  const { data: disciplinesList = [] } = trpc.disciplines.list.useQuery({ activeOnly: true });

  const addCommentMutation = trpc.tasks.addComment.useMutation({
    onSuccess: () => {
      utils.tasks.get.invalidate({ id: taskId });
      setComment("");
      toast.success("Comentário adicionado!");
    },
    onError: (e) => toast.error(e.message),
  });

  const deleteCommentMutation = trpc.tasks.deleteComment.useMutation({
    onSuccess: () => {
      utils.tasks.get.invalidate({ id: taskId });
      toast.success("Comentário removido.");
    },
  });

  const updateMutation = trpc.tasks.update.useMutation({
    onSuccess: () => {
      utils.tasks.get.invalidate({ id: taskId });
      setEditingStatus(false);
      setEditingPriority(false);
      setEditingTitle(false);
      setEditingDescription(false);
      toast.success("Tarefa atualizada!");
    },
    onError: (e) => toast.error(e.message),
  });

  function saveTitle() {
    const trimmed = titleInput.trim();
    if (!trimmed || trimmed === task?.title) { setEditingTitle(false); return; }
    updateMutation.mutate({ id: taskId, title: trimmed });
  }

  function saveDescription() {
    const trimmed = descriptionInput.trim();
    if (trimmed === (task?.description ?? "")) { setEditingDescription(false); return; }
    updateMutation.mutate({ id: taskId, description: trimmed });
  }

  const deleteAttachmentMutation = trpc.tasks.deleteAttachment.useMutation({
    onSuccess: () => {
      utils.tasks.get.invalidate({ id: taskId });
      toast.success("Anexo removido.");
    },
  });

  const uploadAttachmentMutation = trpc.tasks.getUploadUrl.useMutation({
    onSuccess: () => {
      utils.tasks.get.invalidate({ id: taskId });
      toast.success("Arquivo anexado!");
    },
    onError: (e) => toast.error(e.message),
  });

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 16 * 1024 * 1024) {
      toast.error("Arquivo muito grande. Máximo 16MB.");
      return;
    }
    setUploading(true);
    try {
      const reader = new FileReader();
      reader.onload = async (ev) => {
        const base64 = (ev.target?.result as string).split(",")[1];
        await uploadAttachmentMutation.mutateAsync({
          taskId,
          filename: file.name,
          mimeType: file.type,
          fileSize: file.size,
          fileData: base64,
        });
        setUploading(false);
        if (fileInputRef.current) fileInputRef.current.value = "";
      };
      reader.readAsDataURL(file);
    } catch {
      toast.error("Erro ao fazer upload do arquivo.");
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  if (isLoading) {
    return (
      <AppLayout title="Tarefa">
        <div className="max-w-3xl mx-auto space-y-4">
          <Skeleton className="h-40 w-full" />
          <Skeleton className="h-60 w-full" />
        </div>
      </AppLayout>
    );
  }

  if (!task) {
    return (
      <AppLayout title="Tarefa não encontrada">
        <p className="text-muted-foreground">Tarefa não encontrada.</p>
      </AppLayout>
    );
  }

  return (
    <AppLayout title={task.title} backHref={`/projects/${task.projectId}/kanban`}>
      <div className="max-w-3xl mx-auto space-y-6">
        {/* Task Header */}
        <Card className="bg-card border-border">
          <CardContent className="p-6">
            {/* Editable Title */}
            {editingTitle ? (
              <div className="flex items-center gap-2 mb-4">
                <Input
                  ref={titleInputRef}
                  value={titleInput}
                  onChange={e => setTitleInput(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter") saveTitle(); if (e.key === "Escape") setEditingTitle(false); }}
                  className="text-xl font-bold h-10 border-primary/50 focus-visible:ring-primary/30"
                  disabled={updateMutation.isPending}
                />
                <Button size="icon" variant="ghost" className="h-8 w-8 text-green-600 hover:text-green-700" onClick={saveTitle} disabled={updateMutation.isPending}>
                  <Save className="w-4 h-4" />
                </Button>
                <Button size="icon" variant="ghost" className="h-8 w-8 text-muted-foreground" onClick={() => setEditingTitle(false)}>
                  <X className="w-4 h-4" />
                </Button>
              </div>
            ) : (
              <div className="group flex items-start gap-2 mb-4">
                <h2 className={`text-xl font-bold flex-1 ${task.status === "archived" ? "line-through text-muted-foreground" : ""}`}>
                  {task.title}
                </h2>
                <button
                  onClick={() => { setTitleInput(task.title); setEditingTitle(true); }}
                  className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground mt-0.5"
                  title="Editar nome"
                >
                  <Pencil className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            {/* Editable Description */}
            {editingDescription ? (
              <div className="mb-6 space-y-2">
                <Textarea
                  value={descriptionInput}
                  onChange={e => setDescriptionInput(e.target.value)}
                  onKeyDown={e => { if (e.key === "Escape") setEditingDescription(false); }}
                  placeholder="Adicione uma descrição..."
                  className="min-h-[100px] resize-y text-sm"
                  disabled={updateMutation.isPending}
                  autoFocus
                />
                <div className="flex gap-2">
                  <Button size="sm" onClick={saveDescription} disabled={updateMutation.isPending} className="h-7 text-xs">
                    <Save className="w-3 h-3 mr-1" />
                    {updateMutation.isPending ? "Salvando..." : "Salvar"}
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setEditingDescription(false)} className="h-7 text-xs">
                    <X className="w-3 h-3 mr-1" /> Cancelar
                  </Button>
                </div>
              </div>
            ) : (
              <div
                className="group relative mb-6 cursor-pointer rounded-md p-2 -mx-2 hover:bg-muted/50 transition-colors"
                onClick={() => { setDescriptionInput(task.description ?? ""); setEditingDescription(true); }}
                title="Clique para editar a descrição"
              >
                {task.description ? (
                  <p className="text-muted-foreground leading-relaxed text-sm">{task.description}</p>
                ) : (
                  <p className="text-muted-foreground/50 italic text-sm">Clique para adicionar uma descrição...</p>
                )}
                <span className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Pencil className="w-3 h-3 text-muted-foreground" />
                </span>
              </div>
            )}

            {/* Meta */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {/* Status */}
              <div className="space-y-1.5">
                <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Status</p>
                {editingStatus ? (
                  <Select
                    value={task.status}
                    onValueChange={(v) => updateMutation.mutate({ id: taskId, status: v as any })}
                  >
                    <SelectTrigger className="h-8 bg-input border-border text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pending">Para Iniciar</SelectItem>
                      <SelectItem value="in_progress">Em Andamento</SelectItem>
                      <SelectItem value="shared">Compartilhado</SelectItem>
                      <SelectItem value="published">Publicado</SelectItem>
                      <SelectItem value="archived">Arquivado</SelectItem>
                    </SelectContent>
                  </Select>
                ) : (
                  <button
                    onClick={() => setEditingStatus(true)}
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium border status-${task.status} hover:opacity-80 transition-opacity`}
                  >
                    {(task.status === "published" || task.status === "archived") && <CheckCircle2 className="w-3 h-3" />}
                    {task.status === "in_progress" && <Clock className="w-3 h-3" />}
                    {task.status === "shared" && <Share2 className="w-3 h-3" />}
                    {task.status === "pending" && <ListTodo className="w-3 h-3" />}
                    {STATUS_LABELS[task.status]}
                  </button>
                )}
              </div>

              {/* Priority */}
              <div className="space-y-1.5">
                <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Prioridade</p>
                {editingPriority ? (
                  <Select
                    value={task.priority}
                    onValueChange={(v) => updateMutation.mutate({ id: taskId, priority: v as any })}
                  >
                    <SelectTrigger className="h-8 bg-input border-border text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">Baixa</SelectItem>
                      <SelectItem value="medium">Média</SelectItem>
                      <SelectItem value="high">Alta</SelectItem>
                      <SelectItem value="urgent">Urgente</SelectItem>
                    </SelectContent>
                  </Select>
                ) : (
                  <button
                    onClick={() => setEditingPriority(true)}
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium border priority-${task.priority} hover:opacity-80 transition-opacity`}
                  >
                    <Flag className="w-3 h-3" />
                    {PRIORITY_LABELS[task.priority]}
                  </button>
                )}
              </div>

              {/* Dates — editable */}
              <div className="space-y-1.5 col-span-full">
                <div className="flex items-center justify-between">
                  <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Datas</p>
                  {!editingDates ? (
                    <button
                      onClick={() => {
                        setStartDateInput((task as any).startDate ? new Date((task as any).startDate).toISOString().slice(0, 10) : "");
                        setEndDateInput((task as any).endDate ? new Date((task as any).endDate).toISOString().slice(0, 10) : "");
                        setDueDateInput(task.dueDate ? new Date(task.dueDate).toISOString().slice(0, 10) : "");
                        setEditingDates(true);
                      }}
                      className="text-xs text-primary hover:underline flex items-center gap-1"
                    >
                      <Edit2 className="w-3 h-3" /> Editar
                    </button>
                  ) : (
                    <div className="flex gap-1">
                      <button
                        onClick={() => {
                          updateMutation.mutate({
                            id: taskId,
                            startDate: startDateInput ? new Date(startDateInput + "T12:00:00") : null,
                            endDate: endDateInput ? new Date(endDateInput + "T12:00:00") : null,
                            dueDate: dueDateInput ? new Date(dueDateInput + "T12:00:00") : null,
                          });
                          setEditingDates(false);
                        }}
                        className="text-xs text-green-600 hover:underline flex items-center gap-1"
                      >
                        <Save className="w-3 h-3" /> Salvar
                      </button>
                      <button onClick={() => setEditingDates(false)} className="text-xs text-muted-foreground hover:underline flex items-center gap-1">
                        <X className="w-3 h-3" /> Cancelar
                      </button>
                    </div>
                  )}
                </div>
                {editingDates ? (
                  <div className="grid grid-cols-1 gap-2 mt-1">
                    <div>
                      <label className="text-xs text-muted-foreground block mb-0.5">Início</label>
                      <input
                        type="date"
                        value={startDateInput}
                        onChange={e => setStartDateInput(e.target.value)}
                        className="w-full h-8 px-2 text-xs border rounded-md bg-input border-border focus:outline-none focus:ring-1 focus:ring-primary"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground block mb-0.5">Término</label>
                      <input
                        type="date"
                        value={endDateInput}
                        onChange={e => setEndDateInput(e.target.value)}
                        className="w-full h-8 px-2 text-xs border rounded-md bg-input border-border focus:outline-none focus:ring-1 focus:ring-primary"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground block mb-0.5">Vencimento</label>
                      <input
                        type="date"
                        value={dueDateInput}
                        onChange={e => setDueDateInput(e.target.value)}
                        className="w-full h-8 px-2 text-xs border rounded-md bg-input border-border focus:outline-none focus:ring-1 focus:ring-primary"
                      />
                    </div>
                  </div>
                ) : (
                  <div className="space-y-1">
                    {(task as any).startDate && (
                      <div className="flex items-center gap-1.5 text-xs">
                        <span className="text-muted-foreground w-16">Início:</span>
                        <Badge variant="outline" className="text-xs px-2 py-0.5">
                          <Calendar className="w-3 h-3 mr-1" />
                          {new Date((task as any).startDate).toLocaleDateString("pt-BR")}
                        </Badge>
                      </div>
                    )}
                    {(task as any).endDate && (
                      <div className="flex items-center gap-1.5 text-xs">
                        <span className="text-muted-foreground w-16">Término:</span>
                        <Badge variant="outline" className="text-xs px-2 py-0.5">
                          <Calendar className="w-3 h-3 mr-1" />
                          {new Date((task as any).endDate).toLocaleDateString("pt-BR")}
                        </Badge>
                      </div>
                    )}
                    {task.dueDate ? (
                      <div className="flex items-center gap-1.5 text-xs">
                        <span className="text-muted-foreground w-16">Vencimento:</span>
                        <Badge className={`text-xs px-2 py-0.5 border ${
                          new Date(task.dueDate) < new Date() && task.status !== "published" && task.status !== "archived"
                            ? "bg-red-500/15 text-red-400 border-red-500/30"
                            : "bg-secondary text-foreground border-border"
                        }`}>
                          <Calendar className="w-3 h-3 mr-1" />
                          {new Date(task.dueDate).toLocaleDateString("pt-BR")}
                        </Badge>
                      </div>
                    ) : (
                      !((task as any).startDate) && !((task as any).endDate) && (
                        <span className="text-xs text-muted-foreground">Sem datas definidas</span>
                      )
                    )}
                  </div>
                )}
              </div>

              {/* Assignee — editable */}
              <div className="space-y-1.5">
                <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Responsável</p>
                <AssigneeSelect
                  projectId={(task as any).projectId}
                  taskId={taskId}
                  currentAssigneeId={(task as any).assigneeId}
                  currentAssigneeName={(task as any).assigneeName}
                />
              </div>
            </div>
            {/* Setor row */}
            <div className="mt-4 pt-4 border-t border-border grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Setor / Disciplina</p>
                <Select
                  value={(task as any).setor ?? "none"}
                  onValueChange={(v) => updateMutation.mutate({ id: taskId, setor: v === "none" ? null : v })}
                >
                  <SelectTrigger className="h-8 bg-input border-border text-xs">
                    <SelectValue placeholder="Sem setor" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Sem setor</SelectItem>
                    {(disciplinesList as any[]).map((d: any) => (
                      <SelectItem key={d.id} value={d.name}>
                        <span className="flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full inline-block" style={{ backgroundColor: d.color }} />
                          {d.name}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Metrics Panel */}
        <Card className="border border-border shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-primary" />
              Métricas de Desempenho
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="space-y-1">
                <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">Aberta em</p>
                <p className="text-sm font-semibold text-foreground">
                  {(task as any).openedAt
                    ? new Date((task as any).openedAt).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" })
                    : <span className="text-muted-foreground font-normal">—</span>}
                </p>
                {(task as any).openedAt && (
                  <p className="text-[10px] text-muted-foreground">
                    {new Date((task as any).openedAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                  </p>
                )}
              </div>
              <div className="space-y-1">
                <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">Última alteração de status</p>
                <p className="text-sm font-semibold text-foreground">
                  {(task as any).statusChangedAt
                    ? new Date((task as any).statusChangedAt).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" })
                    : <span className="text-muted-foreground font-normal">—</span>}
                </p>
                {(task as any).statusChangedAt && (
                  <p className="text-[10px] text-muted-foreground">
                    {new Date((task as any).statusChangedAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                  </p>
                )}
              </div>
              <div className="space-y-1">
                <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">Concluída em</p>
                {(task as any).completedAt ? (
                  <>
                    <p className="text-sm font-semibold text-emerald-600">
                      {new Date((task as any).completedAt).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" })}
                    </p>
                    <p className="text-[10px] text-muted-foreground">
                      {new Date((task as any).completedAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                    </p>
                  </>
                ) : (
                  <p className="text-sm text-muted-foreground">—</p>
                )}
              </div>
              <div className="space-y-1">
                <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">Revisões</p>
                <div className="flex items-baseline gap-1">
                  <p className="text-2xl font-bold text-foreground">{(task as any).revisionsCount ?? 0}</p>
                  <p className="text-xs text-muted-foreground">alterações</p>
                </div>
                {((task as any).revisionsCount ?? 0) > 5 && (
                  <Badge className="text-[10px] px-1.5 py-0 h-4 bg-amber-50 text-amber-700 border border-amber-200">Alta revisão</Badge>
                )}
              </div>
            </div>
            {(task as any).openedAt && (task as any).completedAt && (
              <div className="mt-4 pt-3 border-t border-border">
                <p className="text-xs text-muted-foreground">
                  <span className="font-medium text-foreground">Lead time: </span>
                  {(() => {
                    const ms = new Date((task as any).completedAt).getTime() - new Date((task as any).openedAt).getTime();
                    const days = Math.floor(ms / (1000 * 60 * 60 * 24));
                    const hours = Math.floor((ms % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
                    return days > 0 ? `${days}d ${hours}h` : `${hours}h`;
                  })()} — do início à conclusão
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Attachments */}
        <Card className="bg-card border-border">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <Paperclip className="w-4 h-4 text-primary" />
                Anexos ({task.attachments?.length ?? 0})
              </CardTitle>
              <div>
                <input
                  ref={fileInputRef}
                  type="file"
                  className="hidden"
                  onChange={handleFileUpload}
                  accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt,.zip"
                />
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-2 border-border"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                >
                  <Upload className="w-3.5 h-3.5" />
                  {uploading ? "Enviando..." : "Anexar"}
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {!task.attachments?.length ? (
              <div className="flex flex-col items-center py-6 text-center">
                <Paperclip className="w-8 h-8 text-muted-foreground/20 mb-2" />
                <p className="text-sm text-muted-foreground">Nenhum anexo ainda.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {task.attachments.map((att) => (
                  <div key={att.id} className="flex items-center gap-3 p-3 rounded-lg bg-secondary/30 hover:bg-secondary/50 transition-colors group">
                    <FileIcon mimeType={att.mimeType} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{att.filename}</p>
                      <p className="text-xs text-muted-foreground">
                        {att.fileSize ? `${(att.fileSize / 1024).toFixed(1)} KB` : ""}
                        {att.createdAt && ` · ${new Date(att.createdAt).toLocaleDateString("pt-BR")}`}
                      </p>
                    </div>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      {(att.mimeType?.startsWith("image/") || att.mimeType === "application/pdf") && (
                        <Button variant="ghost" size="icon" className="h-7 w-7"
                          onClick={() => setPreviewAttachment({ url: att.fileUrl, filename: att.filename, mimeType: att.mimeType })}>
                          <Eye className="w-3.5 h-3.5" />
                        </Button>
                      )}
                      <a href={att.fileUrl} target="_blank" rel="noopener noreferrer">
                        <Button variant="ghost" size="icon" className="h-7 w-7">
                          <Download className="w-3.5 h-3.5" />
                        </Button>
                      </a>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 hover:text-destructive"
                        onClick={() => deleteAttachmentMutation.mutate({ id: att.id })}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Comments */}
        <Card className="bg-card border-border">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-primary" />
              Comentários ({task.comments?.length ?? 0})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Comment Input */}
            <div className="flex gap-3">
              <Avatar className="w-8 h-8 flex-shrink-0 mt-1">
                <AvatarFallback className="bg-primary/20 text-primary text-xs">Eu</AvatarFallback>
              </Avatar>
              <div className="flex-1 space-y-2">
                <Textarea
                  placeholder="Escreva um comentário..."
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  className="bg-input border-border resize-none text-sm"
                  rows={3}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
                      if (comment.trim()) addCommentMutation.mutate({ taskId, content: comment });
                    }
                  }}
                />
                <div className="flex justify-end">
                  <Button
                    size="sm"
                    onClick={() => {
                      if (!comment.trim()) return;
                      addCommentMutation.mutate({ taskId, content: comment });
                    }}
                    disabled={addCommentMutation.isPending || !comment.trim()}
                    className="gap-2 bg-primary hover:bg-primary/90"
                  >
                    <Send className="w-3.5 h-3.5" />
                    Comentar
                  </Button>
                </div>
              </div>
            </div>

            {/* Comments List */}
            {task.comments?.length ? (
              <div className="space-y-4 pt-2 border-t border-border">
                {task.comments.map((c) => {
                  const initials = c.userName
                    ? c.userName.split(" ").map((n: string) => n[0]).join("").slice(0, 2).toUpperCase()
                    : "U";
                  return (
                    <div key={c.id} className="flex gap-3 group">
                      <Avatar className="w-8 h-8 flex-shrink-0">
                        <AvatarFallback className="bg-secondary text-foreground text-xs font-semibold">
                          {initials}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-sm font-medium">{c.userName ?? "Usuário"}</span>
                          <span className="text-xs text-muted-foreground">
                            {new Date(c.createdAt).toLocaleDateString("pt-BR", {
                              day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit",
                            })}
                          </span>
                        </div>
                        <p className="text-sm text-foreground/90 leading-relaxed">{c.content}</p>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity hover:text-destructive flex-shrink-0"
                        onClick={() => deleteCommentMutation.mutate({ id: c.id })}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="flex flex-col items-center py-6 text-center border-t border-border pt-6">
                <MessageSquare className="w-8 h-8 text-muted-foreground/20 mb-2" />
                <p className="text-sm text-muted-foreground">Nenhum comentário ainda.</p>
              </div>
            )}
          </CardContent>
        </Card>
      {/* Status History */}
      <Card className="bg-card border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <History className="w-4 h-4 text-primary" />
            Histórico de Status
          </CardTitle>
        </CardHeader>
        <CardContent>
          <StatusHistorySection taskId={taskId} />
        </CardContent>
      </Card>
      </div>

      {/* File Preview Modal */}
      <Dialog open={!!previewAttachment} onOpenChange={() => setPreviewAttachment(null)}>
        <DialogContent className="max-w-4xl w-full">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Paperclip className="w-4 h-4" />
              {previewAttachment?.filename}
            </DialogTitle>
          </DialogHeader>
          <div className="flex items-center justify-center min-h-[400px] max-h-[70vh] overflow-auto">
            {previewAttachment?.mimeType?.startsWith("image/") ? (
              <img
                src={previewAttachment.url}
                alt={previewAttachment.filename}
                className="max-w-full max-h-full object-contain rounded-lg"
              />
            ) : previewAttachment?.mimeType === "application/pdf" ? (
              <iframe
                src={previewAttachment.url}
                title={previewAttachment.filename}
                className="w-full h-[65vh] rounded-lg border"
              />
            ) : null}
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <a href={previewAttachment?.url} target="_blank" rel="noopener noreferrer">
              <Button variant="outline" size="sm" className="gap-2">
                <Download className="w-3.5 h-3.5" /> Baixar
              </Button>
            </a>
            <Button size="sm" onClick={() => setPreviewAttachment(null)}>Fechar</Button>
          </div>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
