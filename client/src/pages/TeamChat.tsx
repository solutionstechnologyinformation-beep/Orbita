import AppLayout from "@/components/AppLayout";
import { useState, useRef, useEffect, useCallback } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { MessageSquare, Send, AtSign } from "lucide-react";
import { toast } from "sonner";

export default function TeamChat() {
  const { user } = useAuth();
  const [projectId, setProjectId] = useState<number | undefined>(undefined);
  const [taskId, setTaskId] = useState<number | undefined>(undefined);
  const [message, setMessage] = useState("");
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const [mentionStart, setMentionStart] = useState<number>(-1);
  const [showMentions, setShowMentions] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const projectsQ = trpc.projects.list.useQuery();
  const tasksQ = trpc.tasks.list.useQuery(
    { projectId: projectId! },
    { enabled: !!projectId, retry: false }
  );
  const messagesQ = trpc.taskChat.messages.useQuery(
    { taskId: taskId! },
    { enabled: !!taskId, refetchInterval: 5000 }
  );
  const membersQ = trpc.projects.members.useQuery(
    { projectId: projectId! },
    { enabled: !!projectId }
  );

  const utils = trpc.useUtils();
  const sendMut = trpc.taskChat.send.useMutation({
    onSuccess: () => {
      utils.taskChat.messages.invalidate({ taskId });
      setMessage("");
      setShowMentions(false);
    },
    onError: (e) => toast.error(e.message),
  });

  const messages = messagesQ.data ?? [];
  const tasks = tasksQ.data ?? [];
  const members = membersQ.data ?? [];
  const selectedTask = tasks.find(t => t.id === taskId);

  // Filter members by mention query
  const filteredMembers = mentionQuery !== null
    ? members.filter((m: any) =>
        m.userName?.toLowerCase().includes(mentionQuery.toLowerCase()) ||
        m.userEmail?.toLowerCase().includes(mentionQuery.toLowerCase())
      ).slice(0, 6)
    : [];

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  function handleSend() {
    if (!taskId || !message.trim()) return;
    sendMut.mutate({ taskId, message: message.trim() });
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (showMentions && filteredMembers.length > 0) {
      if (e.key === "Escape") {
        setShowMentions(false);
        return;
      }
    }
    if (e.key === "Enter" && !e.shiftKey && !showMentions) {
      e.preventDefault();
      handleSend();
    }
  }

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const val = e.target.value;
    setMessage(val);

    // Detect @ trigger
    const cursor = e.target.selectionStart ?? val.length;
    const textBefore = val.slice(0, cursor);
    const atIdx = textBefore.lastIndexOf("@");
    if (atIdx !== -1) {
      const afterAt = textBefore.slice(atIdx + 1);
      // Only show if no space after @
      if (!afterAt.includes(" ")) {
        setMentionStart(atIdx);
        setMentionQuery(afterAt);
        setShowMentions(true);
        return;
      }
    }
    setShowMentions(false);
    setMentionQuery(null);
  }

  function insertMention(member: any) {
    const name = member.userName ?? member.userEmail;
    const before = message.slice(0, mentionStart);
    const after = message.slice(inputRef.current?.selectionStart ?? message.length);
    const newMsg = `${before}@${name} ${after}`;
    setMessage(newMsg);
    setShowMentions(false);
    setMentionQuery(null);
    setTimeout(() => {
      inputRef.current?.focus();
      const pos = before.length + name.length + 2;
      inputRef.current?.setSelectionRange(pos, pos);
    }, 0);
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

  // Render message with @mention highlighting
  function renderMessage(text: string) {
    const parts = text.split(/(@\S+)/g);
    return parts.map((part, i) =>
      part.startsWith("@") ? (
        <span key={i} className="font-semibold text-indigo-300 bg-indigo-900/30 rounded px-0.5">
          {part}
        </span>
      ) : (
        <span key={i}>{part}</span>
      )
    );
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
    <AppLayout title="Chat de Tarefas">
      <div className="p-6 h-[calc(100vh-4rem)] flex flex-col gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Chat de Tarefas</h1>
          <p className="text-gray-500 text-sm mt-1">Discussões por tarefa com @menções a membros</p>
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
                {(projectsQ.data ?? []).map((p: any) => (
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
                  tasks.map((task: any) => (
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
                            task.status === "pending" ? "Para Iniciar" :
                            task.status === "blocked" ? "Bloqueado" : "Arquivado"}
                        </Badge>
                      </div>
                    </button>
                  ))
                )}
              </CardContent>
            </Card>

            {/* Members list */}
            {members.length > 0 && (
              <Card>
                <CardHeader className="pb-2 px-3 pt-3">
                  <CardTitle className="text-xs text-gray-500 uppercase tracking-wide flex items-center gap-1">
                    <AtSign className="h-3 w-3" /> Membros
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-2">
                  <div className="flex flex-wrap gap-1">
                    {members.map((m: any) => (
                      <button
                        key={m.id}
                        className="text-xs bg-indigo-50 text-indigo-700 rounded-full px-2 py-0.5 hover:bg-indigo-100 transition-colors"
                        onClick={() => {
                          const name = m.userName ?? m.userEmail;
                          const newMsg = message + `@${name} `;
                          setMessage(newMsg);
                          inputRef.current?.focus();
                        }}
                        title={`Mencionar ${m.userName ?? m.userEmail}`}
                      >
                        @{m.userName ?? m.userEmail}
                      </button>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
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
                      <p className="text-xs mt-1">Seja o primeiro a comentar! Use @ para mencionar membros.</p>
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
                          {group.items.map((msg: any) => {
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
                                    {renderMessage(msg.message)}
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

                {/* Input with @mention autocomplete */}
                <div className="p-3 border-t flex-shrink-0 relative">
                  {/* Mention dropdown */}
                  {showMentions && filteredMembers.length > 0 && (
                    <div className="absolute bottom-full left-3 right-3 mb-1 bg-white border rounded-lg shadow-lg z-50 overflow-hidden">
                      <div className="px-3 py-1.5 text-xs text-gray-400 border-b bg-gray-50 flex items-center gap-1">
                        <AtSign className="h-3 w-3" /> Mencionar membro
                      </div>
                      {filteredMembers.map((m: any) => (
                        <button
                          key={m.id}
                          className="w-full text-left px-3 py-2 hover:bg-indigo-50 flex items-center gap-2 transition-colors"
                          onMouseDown={e => { e.preventDefault(); insertMention(m); }}
                        >
                          <div className="w-6 h-6 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center text-xs font-bold flex-shrink-0">
                            {getInitials(m.userName)}
                          </div>
                          <div>
                            <p className="text-sm font-medium text-gray-800">{m.userName ?? m.userEmail}</p>
                            {m.userName && <p className="text-xs text-gray-400">{m.userEmail}</p>}
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                  <div className="flex gap-2 items-center">
                    <div className="flex-1 relative">
                      <input
                        ref={inputRef}
                        value={message}
                        onChange={handleInputChange}
                        onKeyDown={handleKeyDown}
                        placeholder="Digite uma mensagem... Use @ para mencionar"
                        className="w-full h-10 px-3 py-2 text-sm border rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                      />
                    </div>
                    <Button
                      onClick={handleSend}
                      disabled={!message.trim() || sendMut.isPending}
                      size="icon"
                    >
                      <Send className="h-4 w-4" />
                    </Button>
                  </div>
                  <p className="text-xs text-gray-400 mt-1">Enter para enviar · @ para mencionar membros</p>
                </div>
              </>
            )}
          </Card>
        </div>
      </div>
    </AppLayout>
  );
}
