import AppLayout from "@/components/AppLayout";
import { trpc } from "@/lib/trpc";
import { useParams } from "wouter";
import { toast } from "sonner";
import { useState, useRef } from "react";
import {
  MessageSquare, Paperclip, Flag, Calendar, User2,
  Send, Upload, Trash2, Download, FileText, Image,
  CheckCircle2, Clock, ListTodo, Edit2, Save, X,
} from "lucide-react";
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
  todo: "A Fazer", in_progress: "Em Progresso", done: "Concluído",
};

function FileIcon({ mimeType }: { mimeType?: string | null }) {
  if (mimeType?.startsWith("image/")) return <Image className="w-4 h-4 text-blue-400" />;
  return <FileText className="w-4 h-4 text-muted-foreground" />;
}

export default function TaskDetail() {
  const { id } = useParams<{ id: string }>();
  const taskId = parseInt(id ?? "0");
  const utils = trpc.useUtils();

  const [comment, setComment] = useState("");
  const [editingStatus, setEditingStatus] = useState(false);
  const [editingPriority, setEditingPriority] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: task, isLoading } = trpc.tasks.get.useQuery({ id: taskId });

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
      toast.success("Tarefa atualizada!");
    },
    onError: (e) => toast.error(e.message),
  });

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
            <h2 className={`text-xl font-bold mb-4 ${task.status === "done" ? "line-through text-muted-foreground" : ""}`}>
              {task.title}
            </h2>

            {task.description && (
              <p className="text-muted-foreground mb-6 leading-relaxed">{task.description}</p>
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
                      <SelectItem value="todo">A Fazer</SelectItem>
                      <SelectItem value="in_progress">Em Progresso</SelectItem>
                      <SelectItem value="done">Concluído</SelectItem>
                    </SelectContent>
                  </Select>
                ) : (
                  <button
                    onClick={() => setEditingStatus(true)}
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium border status-${task.status} hover:opacity-80 transition-opacity`}
                  >
                    {task.status === "done" && <CheckCircle2 className="w-3 h-3" />}
                    {task.status === "in_progress" && <Clock className="w-3 h-3" />}
                    {task.status === "todo" && <ListTodo className="w-3 h-3" />}
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

              {/* Due Date */}
              <div className="space-y-1.5">
                <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Vencimento</p>
                {task.dueDate ? (
                  <Badge className={`text-xs px-2.5 py-1 border ${new Date(task.dueDate) < new Date() && task.status !== "done" ? "bg-red-500/15 text-red-400 border-red-500/30" : "bg-secondary text-foreground border-border"}`}>
                    <Calendar className="w-3 h-3 mr-1" />
                    {new Date(task.dueDate).toLocaleDateString("pt-BR")}
                  </Badge>
                ) : (
                  <span className="text-xs text-muted-foreground">Sem data</span>
                )}
              </div>

              {/* Assignee */}
              <div className="space-y-1.5">
                <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Responsável</p>
                {task.assigneeName ? (
                  <div className="flex items-center gap-2">
                    <Avatar className="w-6 h-6">
                      <AvatarFallback className="text-[10px] bg-primary/20 text-primary">
                        {task.assigneeName.split(" ").map((n: string) => n[0]).join("").slice(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <span className="text-xs font-medium truncate">{task.assigneeName}</span>
                  </div>
                ) : (
                  <span className="text-xs text-muted-foreground">Não atribuído</span>
                )}
              </div>
            </div>
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
      </div>
    </AppLayout>
  );
}
