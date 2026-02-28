import AppLayout from "@/components/AppLayout";
import { useState, useRef, useEffect, useCallback } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

import {
  MessageSquare, Send, AtSign, Users, Lock, Plus, Search, Check
} from "lucide-react";
import { toast } from "sonner";

// Optimized polling: 2s when tab is visible, 15s when hidden
function useSmartInterval(visibleMs: number, hiddenMs: number) {
  const [interval, setInt] = useState(visibleMs);
  useEffect(() => {
    const update = () => setInt(document.hidden ? hiddenMs : visibleMs);
    document.addEventListener("visibilitychange", update);
    return () => document.removeEventListener("visibilitychange", update);
  }, [visibleMs, hiddenMs]);
  return interval;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
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
function renderMessage(text: string) {
  const parts = text.split(/(@\S+)/g);
  return parts.map((part, i) =>
    part.startsWith("@") ? (
      <span key={i} className="font-semibold text-indigo-300 bg-indigo-900/30 rounded px-0.5">{part}</span>
    ) : (
      <span key={i}>{part}</span>
    )
  );
}

// ─── Avatar ───────────────────────────────────────────────────────────────────
function Avatar({ name, url, size = "sm" }: { name?: string | null; url?: string | null; size?: "sm" | "md" }) {
  const cls = size === "md" ? "h-9 w-9 text-sm" : "h-7 w-7 text-xs";
  if (url) return <img src={url} alt={name ?? ""} className={`${cls} rounded-full object-cover flex-shrink-0`} />;
  return (
    <div className={`${cls} rounded-full bg-indigo-100 text-indigo-700 font-semibold flex items-center justify-center flex-shrink-0`}>
      {getInitials(name)}
    </div>
  );
}

// ─── Task Chat Tab ─────────────────────────────────────────────────────────────
function TaskChatTab({ currentUserId }: { currentUserId: number }) {
  const [projectId, setProjectId] = useState<number | undefined>();
  const [taskId, setTaskId] = useState<number | undefined>();
  const [message, setMessage] = useState("");
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const [mentionStart, setMentionStart] = useState(-1);
  const [showMentions, setShowMentions] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const chatInterval = useSmartInterval(2000, 15000);

  const projectsQ = trpc.projects.list.useQuery();
  const tasksQ = trpc.tasks.list.useQuery({ projectId: projectId! }, { enabled: !!projectId, retry: false });
  const messagesQ = trpc.taskChat.messages.useQuery({ taskId: taskId! }, { enabled: !!taskId, refetchInterval: chatInterval });
  const membersQ = trpc.projects.members.useQuery({ projectId: projectId! }, { enabled: !!projectId });

  const utils = trpc.useUtils();
  const sendMut = trpc.taskChat.send.useMutation({
    onSuccess: () => { utils.taskChat.messages.invalidate({ taskId }); setMessage(""); setShowMentions(false); },
    onError: (e) => toast.error(e.message),
  });

  const messages = messagesQ.data ?? [];
  const tasks = tasksQ.data ?? [];
  const members = membersQ.data ?? [];

  const filteredMembers = mentionQuery !== null
    ? members.filter((m: any) =>
        m.userName?.toLowerCase().includes(mentionQuery.toLowerCase()) ||
        m.userEmail?.toLowerCase().includes(mentionQuery.toLowerCase())
      ).slice(0, 6)
    : [];

  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  function handleSend() {
    if (!taskId || !message.trim()) return;
    sendMut.mutate({ taskId, message: message.trim() });
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (showMentions && e.key === "Escape") { setShowMentions(false); return; }
    if (e.key === "Enter" && !e.shiftKey && !showMentions) { e.preventDefault(); handleSend(); }
  }

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const val = e.target.value;
    setMessage(val);
    const cursor = e.target.selectionStart ?? val.length;
    const textBefore = val.slice(0, cursor);
    const atIdx = textBefore.lastIndexOf("@");
    if (atIdx !== -1) {
      const afterAt = textBefore.slice(atIdx + 1);
      if (!afterAt.includes(" ")) { setMentionStart(atIdx); setMentionQuery(afterAt); setShowMentions(true); return; }
    }
    setShowMentions(false); setMentionQuery(null);
  }

  function insertMention(member: any) {
    const name = member.userName ?? member.userEmail;
    const before = message.slice(0, mentionStart);
    const after = message.slice(inputRef.current?.selectionStart ?? message.length);
    setMessage(`${before}@${name} ${after}`);
    setShowMentions(false); setMentionQuery(null);
    setTimeout(() => { inputRef.current?.focus(); const pos = before.length + name.length + 2; inputRef.current?.setSelectionRange(pos, pos); }, 0);
  }

  const groupedMessages: { date: string; items: typeof messages }[] = [];
  messages.forEach(msg => {
    const date = formatDate(msg.createdAt);
    const last = groupedMessages[groupedMessages.length - 1];
    if (last && last.date === date) last.items.push(msg);
    else groupedMessages.push({ date, items: [msg] });
  });

  return (
    <div className="flex gap-4 flex-1 min-h-0">
      {/* Left: selector */}
      <div className="w-64 flex-shrink-0 flex flex-col gap-3">
        <Select value={projectId?.toString() ?? "none"} onValueChange={v => { if (v !== "none") { setProjectId(Number(v)); setTaskId(undefined); } }}>
          <SelectTrigger><SelectValue placeholder="Selecione um projeto" /></SelectTrigger>
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
              <p className="text-xs text-gray-400 p-3">Nenhuma tarefa.</p>
            ) : (
              tasks.map((task: any) => (
                <button key={task.id}
                  className={`w-full text-left px-3 py-2.5 hover:bg-gray-50 transition-colors border-b last:border-0 ${taskId === task.id ? "bg-indigo-50 border-l-2 border-l-indigo-500" : ""}`}
                  onClick={() => setTaskId(task.id)}>
                  <div className="flex items-center gap-2">
                    <MessageSquare className="h-3 w-3 text-gray-400 flex-shrink-0" />
                    <span className="text-sm font-medium truncate">{task.title}</span>
                  </div>
                </button>
              ))
            )}
          </CardContent>
        </Card>
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
                  <button key={m.id}
                    className="text-xs bg-indigo-50 text-indigo-700 rounded-full px-2 py-0.5 hover:bg-indigo-100"
                    onClick={() => { setMessage(message + `@${m.userName ?? m.userEmail} `); inputRef.current?.focus(); }}>
                    @{m.userName ?? m.userEmail}
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Right: chat */}
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
                <span className="font-semibold text-sm">{tasks.find((t: any) => t.id === taskId)?.title}</span>
              </div>
            </CardHeader>
            <CardContent className="flex-1 overflow-y-auto p-4 space-y-4">
              {groupedMessages.map(group => (
                <div key={group.date}>
                  <div className="flex items-center gap-2 mb-3">
                    <div className="flex-1 h-px bg-gray-100" />
                    <span className="text-xs text-gray-400 font-medium">{group.date}</span>
                    <div className="flex-1 h-px bg-gray-100" />
                  </div>
                  {group.items.map((msg: any) => {
                    const isMe = msg.userId === currentUserId;
                    return (
                      <div key={msg.id} className={`flex gap-2 ${isMe ? "flex-row-reverse" : ""}`}>
                        <Avatar name={msg.userName} url={msg.userAvatar} />
                        <div className={`max-w-[70%] ${isMe ? "items-end" : "items-start"} flex flex-col`}>
                          {!isMe && <span className="text-xs text-gray-500 mb-0.5 ml-1">{msg.userName ?? "Usuário"}</span>}
                          <div className={`rounded-2xl px-3 py-2 text-sm ${isMe ? "bg-indigo-600 text-white rounded-tr-sm" : "bg-gray-100 text-gray-800 rounded-tl-sm"}`}>
                            {renderMessage(msg.message)}
                          </div>
                          <span className="text-xs text-gray-400 mt-0.5 mx-1">{formatTime(msg.createdAt)}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ))}
              <div ref={messagesEndRef} />
            </CardContent>
            <div className="p-3 border-t flex-shrink-0">
              <div className="relative flex gap-2">
                {showMentions && filteredMembers.length > 0 && (
                  <div className="absolute bottom-full left-0 mb-1 w-48 bg-white border rounded-lg shadow-lg z-50 overflow-hidden">
                    {filteredMembers.map((m: any) => (
                      <button key={m.id} className="w-full text-left px-3 py-2 hover:bg-indigo-50 text-sm flex items-center gap-2"
                        onMouseDown={e => { e.preventDefault(); insertMention(m); }}>
                        <AtSign className="h-3 w-3 text-indigo-400" />
                        {m.userName ?? m.userEmail}
                      </button>
                    ))}
                  </div>
                )}
                <Input ref={inputRef} value={message} onChange={handleInputChange} onKeyDown={handleKeyDown}
                  placeholder="Digite uma mensagem... (@ para mencionar)" className="flex-1" />
                <Button onClick={handleSend} disabled={!message.trim() || sendMut.isPending} size="icon" className="bg-indigo-600 hover:bg-indigo-700">
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </>
        )}
      </Card>
    </div>
  );
}

// ─── Direct / Group Chat Tab ───────────────────────────────────────────────────
function DirectChatTab({ currentUserId }: { currentUserId: number }) {
  const [selectedConvId, setSelectedConvId] = useState<number | undefined>();
  const [message, setMessage] = useState("");
  const [searchUser, setSearchUser] = useState("");
  const [showNewDirect, setShowNewDirect] = useState(false);
  const [showNewGroup, setShowNewGroup] = useState(false);
  const [groupName, setGroupName] = useState("");
  const [selectedMembers, setSelectedMembers] = useState<number[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const utils = trpc.useUtils();
  const convsInterval = useSmartInterval(3000, 15000);
  const msgsInterval = useSmartInterval(2000, 15000);
  const convsQ = trpc.directChat.listConversations.useQuery(undefined, { refetchInterval: convsInterval });
  const msgsQ = trpc.directChat.getMessages.useQuery(
    { conversationId: selectedConvId! },
    { enabled: !!selectedConvId, refetchInterval: msgsInterval }
  );
  const usersQ = trpc.directChat.listUsers.useQuery();

  const sendMut = trpc.directChat.sendMessage.useMutation({
    onSuccess: () => {
      utils.directChat.getMessages.invalidate({ conversationId: selectedConvId });
      utils.directChat.listConversations.invalidate();
      setMessage("");
    },
    onError: (e) => toast.error(e.message),
  });

  const startDirectMut = trpc.directChat.startDirect.useMutation({
    onSuccess: (data) => {
      utils.directChat.listConversations.invalidate();
      setSelectedConvId(data.conversationId);
      setShowNewDirect(false);
      setSearchUser("");
    },
    onError: (e) => toast.error(e.message),
  });

  const createGroupMut = trpc.directChat.createGroup.useMutation({
    onSuccess: (data) => {
      utils.directChat.listConversations.invalidate();
      setSelectedConvId(data.conversationId);
      setShowNewGroup(false);
      setGroupName("");
      setSelectedMembers([]);
    },
    onError: (e) => toast.error(e.message),
  });

  const markReadMut = trpc.directChat.markRead.useMutation();

  const conversations = convsQ.data ?? [];
  const messages = msgsQ.data ?? [];
  const allUsers = usersQ.data ?? [];

  const filteredUsers = allUsers.filter((u: any) =>
    u.name?.toLowerCase().includes(searchUser.toLowerCase()) ||
    u.email?.toLowerCase().includes(searchUser.toLowerCase())
  );

  const selectedConv = conversations.find((c: any) => c.id === selectedConvId);

  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  useEffect(() => {
    if (selectedConvId) markReadMut.mutate({ conversationId: selectedConvId });
  }, [selectedConvId, messages.length]);

  function handleSend() {
    if (!selectedConvId || !message.trim()) return;
    sendMut.mutate({ conversationId: selectedConvId, content: message.trim() });
  }

  function getConvName(conv: any) {
    if (conv.type === "group") return conv.name ?? "Grupo";
    const other = conv.participants?.find((p: any) => p.userId !== currentUserId);
    return other?.userName ?? other?.userEmail ?? "Usuário";
  }

  function getConvAvatar(conv: any) {
    if (conv.type === "group") return null;
    const other = conv.participants?.find((p: any) => p.userId !== currentUserId);
    return other?.avatarUrl ?? null;
  }

  const groupedMessages: { date: string; items: typeof messages }[] = [];
  messages.forEach((msg: any) => {
    const date = formatDate(msg.createdAt);
    const last = groupedMessages[groupedMessages.length - 1];
    if (last && last.date === date) last.items.push(msg);
    else groupedMessages.push({ date, items: [msg] });
  });

  return (
    <div className="flex gap-4 flex-1 min-h-0">
      {/* Left: conversation list */}
      <div className="w-64 flex-shrink-0 flex flex-col gap-2">
        <div className="flex gap-2">
          <Button size="sm" variant="outline" className="flex-1 text-xs" onClick={() => setShowNewDirect(true)}>
            <Lock className="h-3 w-3 mr-1" /> Privado
          </Button>
          <Button size="sm" variant="outline" className="flex-1 text-xs" onClick={() => setShowNewGroup(true)}>
            <Users className="h-3 w-3 mr-1" /> Grupo
          </Button>
        </div>

        <Card className="flex-1 overflow-hidden">
          <CardContent className="p-0 overflow-y-auto h-full">
            {conversations.length === 0 ? (
              <div className="p-4 text-center text-xs text-gray-400">
                <MessageSquare className="h-8 w-8 mx-auto mb-2 opacity-30" />
                <p>Nenhuma conversa ainda.</p>
                <p className="mt-1">Inicie uma conversa privada ou crie um grupo.</p>
              </div>
            ) : (
              conversations.map((conv: any) => (
                <button key={conv.id}
                  className={`w-full text-left px-3 py-3 hover:bg-gray-50 transition-colors border-b last:border-0 ${selectedConvId === conv.id ? "bg-indigo-50 border-l-2 border-l-indigo-500" : ""}`}
                  onClick={() => setSelectedConvId(conv.id)}>
                  <div className="flex items-center gap-2">
                    {conv.type === "group" ? (
                      <div className="h-8 w-8 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center flex-shrink-0">
                        <Users className="h-4 w-4" />
                      </div>
                    ) : (
                      <Avatar name={getConvName(conv)} url={getConvAvatar(conv)} size="md" />
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium truncate">{getConvName(conv)}</span>
                        {conv.unreadCount > 0 && (
                          <Badge className="bg-indigo-600 text-white text-xs px-1.5 py-0 ml-1 flex-shrink-0">
                            {conv.unreadCount}
                          </Badge>
                        )}
                      </div>
                      {conv.lastMessage && (
                        <p className="text-xs text-gray-400 truncate mt-0.5">{conv.lastMessage.content}</p>
                      )}
                    </div>
                  </div>
                </button>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      {/* Right: messages */}
      <Card className="flex-1 flex flex-col min-h-0">
        {!selectedConvId ? (
          <CardContent className="flex-1 flex items-center justify-center text-gray-400">
            <div className="text-center">
              <MessageSquare className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p>Selecione uma conversa ou inicie uma nova.</p>
            </div>
          </CardContent>
        ) : (
          <>
            <CardHeader className="pb-2 border-b flex-shrink-0">
              <div className="flex items-center gap-2">
                {selectedConv?.type === "group" ? (
                  <div className="h-7 w-7 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center">
                    <Users className="h-4 w-4" />
                  </div>
                ) : (
                  <Avatar name={getConvName(selectedConv)} url={getConvAvatar(selectedConv)} />
                )}
                <div>
                  <span className="font-semibold text-sm">{getConvName(selectedConv)}</span>
                  {selectedConv?.type === "group" && (
                    <p className="text-xs text-gray-400">{selectedConv.participants?.length ?? 0} participantes</p>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent className="flex-1 overflow-y-auto p-4 space-y-4">
              {groupedMessages.map(group => (
                <div key={group.date}>
                  <div className="flex items-center gap-2 mb-3">
                    <div className="flex-1 h-px bg-gray-100" />
                    <span className="text-xs text-gray-400 font-medium">{group.date}</span>
                    <div className="flex-1 h-px bg-gray-100" />
                  </div>
                  {group.items.map((msg: any) => {
                    const isMe = msg.senderId === currentUserId;
                    return (
                      <div key={msg.id} className={`flex gap-2 ${isMe ? "flex-row-reverse" : ""}`}>
                        <Avatar name={msg.senderName} url={msg.senderAvatar} />
                        <div className={`max-w-[70%] flex flex-col ${isMe ? "items-end" : "items-start"}`}>
                          {!isMe && <span className="text-xs text-gray-500 mb-0.5 ml-1">{msg.senderName ?? "Usuário"}</span>}
                          <div className={`rounded-2xl px-3 py-2 text-sm ${isMe ? "bg-indigo-600 text-white rounded-tr-sm" : "bg-gray-100 text-gray-800 rounded-tl-sm"}`}>
                            {msg.content}
                          </div>
                          <span className="text-xs text-gray-400 mt-0.5 mx-1">{formatTime(msg.createdAt)}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ))}
              <div ref={messagesEndRef} />
            </CardContent>
            <div className="p-3 border-t flex-shrink-0 flex gap-2">
              <Input value={message} onChange={e => setMessage(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
                placeholder="Digite uma mensagem..." className="flex-1" />
              <Button onClick={handleSend} disabled={!message.trim() || sendMut.isPending} size="icon" className="bg-indigo-600 hover:bg-indigo-700">
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </>
        )}
      </Card>

      {/* New Direct Dialog */}
      <Dialog open={showNewDirect} onOpenChange={setShowNewDirect}>
        <DialogContent>
          <DialogHeader><DialogTitle>Nova Conversa Privada</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input value={searchUser} onChange={e => setSearchUser(e.target.value)}
                placeholder="Buscar usuário..." className="pl-9" />
            </div>
            <div className="max-h-60 overflow-y-auto space-y-1">
              {filteredUsers.map((u: any) => (
                <button key={u.id}
                  className="w-full flex items-center gap-3 p-2 hover:bg-gray-50 rounded-lg transition-colors text-left"
                  onClick={() => startDirectMut.mutate({ targetUserId: u.id })}>
                  <Avatar name={u.name} url={u.avatarUrl} size="md" />
                  <div>
                    <p className="text-sm font-medium">{u.name ?? "Usuário"}</p>
                    <p className="text-xs text-gray-400">{u.email}</p>
                  </div>
                </button>
              ))}
              {filteredUsers.length === 0 && <p className="text-sm text-gray-400 text-center py-4">Nenhum usuário encontrado.</p>}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* New Group Dialog */}
      <Dialog open={showNewGroup} onOpenChange={setShowNewGroup}>
        <DialogContent>
          <DialogHeader><DialogTitle>Criar Grupo</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <Input value={groupName} onChange={e => setGroupName(e.target.value)} placeholder="Nome do grupo" />
            <p className="text-xs text-gray-500 font-medium">Selecionar membros:</p>
            <div className="max-h-52 overflow-y-auto space-y-1">
              {allUsers.map((u: any) => {
                const selected = selectedMembers.includes(u.id);
                return (
                  <button key={u.id}
                    className={`w-full flex items-center gap-3 p-2 rounded-lg transition-colors text-left ${selected ? "bg-indigo-50" : "hover:bg-gray-50"}`}
                    onClick={() => setSelectedMembers(prev => selected ? prev.filter(id => id !== u.id) : [...prev, u.id])}>
                    <Avatar name={u.name} url={u.avatarUrl} size="md" />
                    <div className="flex-1">
                      <p className="text-sm font-medium">{u.name ?? "Usuário"}</p>
                      <p className="text-xs text-gray-400">{u.email}</p>
                    </div>
                    {selected && <Check className="h-4 w-4 text-indigo-600" />}
                  </button>
                );
              })}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNewGroup(false)}>Cancelar</Button>
            <Button
              disabled={!groupName.trim() || selectedMembers.length === 0 || createGroupMut.isPending}
              onClick={() => createGroupMut.mutate({ name: groupName.trim(), memberIds: selectedMembers })}
              className="bg-indigo-600 hover:bg-indigo-700">
              <Plus className="h-4 w-4 mr-1" /> Criar Grupo
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Main Component ────────────────────────────────────────────────────────────
export default function TeamChat() {
  const { user } = useAuth();

  return (
    <AppLayout title="Chat">
      <div className="p-6 h-[calc(100vh-4rem)] flex flex-col gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Chat</h1>
          <p className="text-gray-500 text-sm mt-1">Chat de tarefas, conversas privadas e grupos</p>
        </div>

        <Tabs defaultValue="direct" className="flex-1 flex flex-col min-h-0">
          <TabsList className="flex-shrink-0 w-fit">
            <TabsTrigger value="direct" className="flex items-center gap-2">
              <Lock className="h-4 w-4" /> Privado / Grupos
            </TabsTrigger>
            <TabsTrigger value="tasks" className="flex items-center gap-2">
              <MessageSquare className="h-4 w-4" /> Chat de Tarefas
            </TabsTrigger>
          </TabsList>

          <TabsContent value="direct" className="flex-1 min-h-0 mt-3">
            {user && <DirectChatTab currentUserId={user.id} />}
          </TabsContent>

          <TabsContent value="tasks" className="flex-1 min-h-0 mt-3">
            {user && <TaskChatTab currentUserId={user.id} />}
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}
