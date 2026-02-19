import { useState, useRef, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { MessageSquare, Send, User } from "lucide-react";
import { toast } from "sonner";

export default function TeamChat() {
  const { user } = useAuth();
  const [projectId, setProjectId] = useState<number | undefined>(undefined);
  const [taskId, setTaskId] = useState<number | undefined>(undefined);
  const [message, setMessage] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const projectsQ = trpc.projects.list.useQuery();
  const tasksQ = trpc.tasks.list.useQuery(
    { projectId: projectId! },
    { enabled: !!projectId, retry: false }
  );
  const messagesQ = trpc.taskChat.messages.useQuery(
    { taskId: taskId! },
    { enabled: !!taskId, refetchInterval: 5000 }
  );

  const utils = trpc.useUtils();
  const sendMut = trpc.taskChat.send.useMutation({
    onSuccess: () => {
      utils.taskChat.messages.invalidate({ taskId });
      setMessage("");
    },
    onError: (e) => toast.error(e.message),
  });

  const messages = messagesQ.data ?? [];
  const tasks = tasksQ.data ?? [];
  const selectedTask = tasks.find(t => t.id === taskId);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  function handleSend() {
    if (!taskId || !message.trim()) return;
    sendMut.mutate({ taskId, message: message.trim() });
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  function getInitials(name: string | null | undefined) {
    if (!name) return "?";
    return name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2);
  }

  function formatTime(date: Date | string) {
    return new Date(date).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  }

  function formatDate(date: Date | string) {
    const d = new Date(date);
    const today = new Date();
    if (d.toDateString() === today.toDateString()) return "Hoje";
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    if (d.toDateString() === yesterday.toDateString()) return "Ontem";
    return d.toLocaleDateString("pt-BR");
  }

  // Group messages by date
  const groupedMessages: { date: string; items: typeof messages }[] = [];
  messages.forEach(msg => {
    const date = formatDate(msg.createdAt);
    const last = groupedMessages[groupedMessages.length - 1];
    if (last && last.date === date) {
      last.items.push(msg);
    } else {
      groupedMessages.push({ date, items: [msg] });
    }
  });

  return (
    <div className="p-6 h-[calc(100vh-4rem)] flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Chat de Tarefas</h1>
        <p className="text-gray-500 text-sm mt-1">Discussões informais por tarefa com histórico completo</p>
      </div>

      <div className="flex gap-4 flex-1 min-h-0">
        {/* Left: Task selector */}
        <div className="w-72 flex-shrink-0 flex flex-col gap-3">
          <Select
            value={projectId?.toString() ?? ""}
            onValueChange={v => { setProjectId(Number(v)); setTaskId(undefined); }}
          >
            <SelectTrigger>
              <SelectValue placeholder="Selecione um projeto" />
            </SelectTrigger>
            <SelectContent>
              {(projectsQ.data ?? []).map(p => (
                <SelectItem key={p.id} value={p.id.toString()}>{p.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Card className="flex-1 overflow-hidden">
            <CardHeader className="pb-2 px-3 pt-3">
              <CardTitle className="text-xs text-gray-500 uppercase tracking-wide">Tarefas</CardTitle>
            </CardHeader>
            <CardContent className="p-0 overflow-y-auto">
              {!projectId ? (
                <p className="text-xs text-gray-400 p-3">Selecione um projeto.</p>
              ) : tasksQ.isLoading ? (
                <p className="text-xs text-gray-400 p-3">Carregando...</p>
              ) : tasks.length === 0 ? (
                <p className="text-xs text-gray-400 p-3">Nenhuma tarefa encontrada.</p>
              ) : (
                tasks.map(task => (
                  <button
                    key={task.id}
                    className={`w-full text-left px-3 py-2.5 hover:bg-gray-50 transition-colors border-b last:border-0 ${
                      taskId === task.id ? "bg-indigo-50 border-l-2 border-l-indigo-500" : ""
                    }`}
                    onClick={() => setTaskId(task.id)}
                  >
                    <div className="flex items-center gap-2">
                      <MessageSquare className="h-3 w-3 text-gray-400 flex-shrink-0" />
                      <span className="text-sm font-medium truncate">{task.title}</span>
                    </div>
                    <div className="flex items-center gap-1 mt-0.5">
                      <Badge
                        variant="outline"
                        className="text-xs py-0"
                        style={{
                          borderColor: task.status === "published" ? "#10b981" :
                            task.status === "in_progress" ? "#3b82f6" : "#94a3b8",
                          color: task.status === "published" ? "#10b981" :
                            task.status === "in_progress" ? "#3b82f6" : "#94a3b8",
                        }}
                      >
                        {task.status === "published" ? "Publicado" :
                          task.status === "in_progress" ? "Em Andamento" :
                          task.status === "shared" ? "Compartilhado" :
                          task.status === "pending" ? "Para Iniciar" : "Arquivado"}
                      </Badge>
                    </div>
                  </button>
                ))
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right: Chat area */}
        <Card className="flex-1 flex flex-col min-h-0">
          {!taskId ? (
            <CardContent className="flex-1 flex items-center justify-center text-gray-400">
              <div className="text-center">
                <MessageSquare className="h-12 w-12 mx-auto mb-3 opacity-30" />
                <p>Selecione uma tarefa para ver o chat.</p>
              </div>
            </CardContent>
          ) : (
            <>
              <CardHeader className="pb-2 border-b flex-shrink-0">
                <div className="flex items-center gap-2">
                  <MessageSquare className="h-4 w-4 text-indigo-500" />
                  <CardTitle className="text-base">{selectedTask?.title ?? "Tarefa"}</CardTitle>
                </div>
              </CardHeader>

              {/* Messages */}
              <CardContent className="flex-1 overflow-y-auto p-4 space-y-4">
                {messagesQ.isLoading ? (
                  <div className="text-center text-gray-400 text-sm">Carregando mensagens...</div>
                ) : messages.length === 0 ? (
                  <div className="text-center text-gray-400 text-sm py-8">
                    <MessageSquare className="h-8 w-8 mx-auto mb-2 opacity-30" />
                    <p>Nenhuma mensagem ainda.</p>
                    <p className="text-xs mt-1">Seja o primeiro a comentar!</p>
                  </div>
                ) : (
                  groupedMessages.map(group => (
                    <div key={group.date}>
                      <div className="flex items-center gap-2 mb-3">
                        <div className="flex-1 h-px bg-gray-200" />
                        <span className="text-xs text-gray-400 px-2">{group.date}</span>
                        <div className="flex-1 h-px bg-gray-200" />
                      </div>
                      <div className="space-y-3">
                        {group.items.map(msg => {
                          const isMe = msg.userId === user?.id;
                          return (
                            <div key={msg.id} className={`flex gap-2 ${isMe ? "flex-row-reverse" : ""}`}>
                              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                                isMe ? "bg-indigo-100 text-indigo-700" : "bg-gray-100 text-gray-700"
                              }`}>
                                {getInitials(msg.userName)}
                              </div>
                              <div className={`max-w-[70%] ${isMe ? "items-end" : "items-start"} flex flex-col`}>
                                <div className="flex items-center gap-1 mb-0.5">
                                  {!isMe && (
                                    <span className="text-xs font-medium text-gray-700">{msg.userName ?? "Usuário"}</span>
                                  )}
                                  <span className="text-xs text-gray-400">{formatTime(msg.createdAt)}</span>
                                </div>
                                <div className={`px-3 py-2 rounded-2xl text-sm ${
                                  isMe
                                    ? "bg-indigo-600 text-white rounded-tr-sm"
                                    : "bg-gray-100 text-gray-800 rounded-tl-sm"
                                }`}>
                                  {msg.message}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))
                )}
                <div ref={messagesEndRef} />
              </CardContent>

              {/* Input */}
              <div className="p-3 border-t flex-shrink-0">
                <div className="flex gap-2">
                  <Input
                    value={message}
                    onChange={e => setMessage(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Digite uma mensagem... (Enter para enviar)"
                    className="flex-1"
                  />
                  <Button
                    onClick={handleSend}
                    disabled={!message.trim() || sendMut.isPending}
                    size="icon"
                  >
                    <Send className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </>
          )}
        </Card>
      </div>
    </div>
  );
}
