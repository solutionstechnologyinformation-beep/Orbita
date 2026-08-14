import { useState, useRef, useEffect, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { useLocation, useSearch } from "wouter";
import { useAuth } from "@/_core/hooks/useAuth";
import AppLayout from "@/components/AppLayout";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Send, MessageSquare, Users, Search, Plus, Lock, Hash } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { PresenceDot } from "@/components/PresenceDot";
import { toast } from "sonner";
import { formatTypingLabel, getChatPollInterval } from "./team-chat-utils";
import { filterDirectConversationsByDiscipline, filterUsersByDiscipline } from "./team-chat-navigation";

export default function TeamChat() {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const queryString = useSearch();
  const disciplineFilter = useMemo(() => new URLSearchParams(queryString).get("discipline")?.trim() ?? "", [queryString]);
  const [selectedConvId, setSelectedConvId] = useState<number | null>(null);
  const [message, setMessage] = useState("");
  const [searchUser, setSearchUser] = useState("");
  const [activeTab, setActiveTab] = useState<"direct" | "groups">("direct");
  const [showCreateGroup, setShowCreateGroup] = useState(false);
  const [groupName, setGroupName] = useState("");
  const [selectedMembers, setSelectedMembers] = useState<number[]>([]);
  const [isPageVisible, setIsPageVisible] = useState(() => typeof document === "undefined" || document.visibilityState === "visible");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const typingStopTimer = useRef<number | null>(null);
  const lastTypingSignalAt = useRef(0);
  const pollInterval = getChatPollInterval(isPageVisible);

  useEffect(() => {
    const handleVisibility = () => setIsPageVisible(document.visibilityState === "visible");
    document.addEventListener("visibilitychange", handleVisibility);
    return () => document.removeEventListener("visibilitychange", handleVisibility);
  }, []);

  const convsQ = trpc.messages.getConversations.useQuery(undefined, { refetchInterval: isPageVisible ? 5000 : 15000 });
  const groupConvsQ = trpc.messages.getGroupConversations.useQuery(undefined, { refetchInterval: isPageVisible ? 5000 : 15000 });
  const msgsQ = trpc.messages.getMessages.useQuery(
    { conversationId: selectedConvId! },
    { enabled: !!selectedConvId, refetchInterval: pollInterval }
  );
  const typingQ = trpc.messages.getTypingUsers.useQuery(
    { conversationId: selectedConvId! },
    { enabled: !!selectedConvId, refetchInterval: pollInterval }
  );
  const membersQ = trpc.messages.getMembers.useQuery(
    { conversationId: selectedConvId! },
    { enabled: !!selectedConvId && activeTab === "groups" }
  );
  const usersQ = trpc.users.list.useQuery();
  const utils = trpc.useUtils();
  const presenceM = trpc.presence.heartbeat.useMutation();
  const markReadM = trpc.messages.markRead.useMutation({
    onSuccess: () => {
      utils.messages.getConversations.invalidate();
      utils.dashboard.chatActivityByDiscipline.invalidate();
    },
  });

  useEffect(() => {
    presenceM.mutate();
    const intervalId = window.setInterval(() => presenceM.mutate(), 60_000);
    return () => window.clearInterval(intervalId);
  }, []);

  const getOrCreateM = trpc.messages.getOrCreate.useMutation({
    onSuccess: (data) => {
      setSelectedConvId(data.id);
      setActiveTab("direct");
      utils.messages.getConversations.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  const createGroupM = trpc.messages.createGroup.useMutation({
    onSuccess: (data) => {
      setSelectedConvId(data.id);
      setActiveTab("groups");
      setShowCreateGroup(false);
      setGroupName("");
      setSelectedMembers([]);
      utils.messages.getGroupConversations.invalidate();
      toast.success("Grupo criado com sucesso!");
    },
    onError: (e) => toast.error(e.message),
  });

  const setTypingM = trpc.messages.setTyping.useMutation();
  const sendM = trpc.messages.send.useMutation({
    onSuccess: () => {
      utils.messages.getMessages.invalidate({ conversationId: selectedConvId! });
      utils.messages.getTypingUsers.invalidate({ conversationId: selectedConvId! });
      utils.messages.getConversations.invalidate();
      utils.messages.getGroupConversations.invalidate();
      setMessage("");
    },
    onError: (e) => toast.error(e.message),
  });

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [msgsQ.data]);
  useEffect(() => {
    if (selectedConvId) markReadM.mutate({ conversationId: selectedConvId });
  }, [selectedConvId]);

  const directConvs = (convsQ.data ?? []) as any[];
  const groupConvs = (groupConvsQ.data ?? []) as any[];
  const allUsers = (usersQ.data ?? []) as any[];
  const visibleDirectConvs = useMemo(
    () => filterDirectConversationsByDiscipline(directConvs, allUsers, disciplineFilter),
    [directConvs, allUsers, disciplineFilter],
  );
  // Only show users registered in the system (not the current user), optionally scoped to the selected discipline.
  const otherUsers = useMemo(
    () => filterUsersByDiscipline(allUsers.filter((u: any) => u.id !== user?.id), disciplineFilter),
    [allUsers, user?.id, disciplineFilter],
  );
  const filteredUsers = searchUser
    ? otherUsers.filter((u: any) => (u.name ?? u.email).toLowerCase().includes(searchUser.toLowerCase()))
    : otherUsers;
  useEffect(() => {
    if (activeTab === "direct" && selectedConvId && !visibleDirectConvs.some((conversation) => conversation.id === selectedConvId)) {
      setSelectedConvId(null);
    }
  }, [activeTab, selectedConvId, visibleDirectConvs]);
  useEffect(() => {
    if (disciplineFilter && activeTab === "direct" && !selectedConvId && visibleDirectConvs.length > 0) {
      setSelectedConvId(visibleDirectConvs[0].id);
    }
  }, [disciplineFilter, activeTab, selectedConvId, visibleDirectConvs]);

  const stopTyping = () => {
    if (!selectedConvId) return;
    if (typingStopTimer.current) window.clearTimeout(typingStopTimer.current);
    typingStopTimer.current = null;
    setTypingM.mutate({ conversationId: selectedConvId, isTyping: false });
  };

  const handleMessageChange = (value: string) => {
    setMessage(value);
    if (!selectedConvId) return;
    const now = Date.now();
    if (value.trim() && now - lastTypingSignalAt.current >= 1500) {
      lastTypingSignalAt.current = now;
      setTypingM.mutate({ conversationId: selectedConvId, isTyping: true });
    }
    if (typingStopTimer.current) window.clearTimeout(typingStopTimer.current);
    if (value.trim()) {
      typingStopTimer.current = window.setTimeout(stopTyping, 3000);
    } else {
      stopTyping();
    }
  };

  const handleSend = () => {
    if (!message.trim() || !selectedConvId) return;
    stopTyping();
    sendM.mutate({ conversationId: selectedConvId, content: message.trim() });
  };

  const handleCreateGroup = () => {
    if (!groupName.trim()) { toast.error("Informe o nome do grupo"); return; }
    if (selectedMembers.length === 0) { toast.error("Selecione ao menos um membro"); return; }
    createGroupM.mutate({ name: groupName.trim(), memberIds: selectedMembers });
  };

  const toggleMember = (id: number) => {
    setSelectedMembers(prev => prev.includes(id) ? prev.filter(m => m !== id) : [...prev, id]);
  };

  const selectedConv = activeTab === "direct"
    ? visibleDirectConvs.find((c: any) => c.id === selectedConvId)
    : groupConvs.find((c: any) => c.id === selectedConvId);

  const convTitle = activeTab === "direct"
    ? (selectedConv?.otherUserName ?? selectedConv?.otherUser?.name ?? "Usuário")
    : (selectedConv?.name ?? "Grupo");

  const convSubtitle = activeTab === "direct"
    ? (selectedConv?.otherUser?.role ?? "membro")
    : `${selectedConv?.memberCount ?? 0} membros`;

  const convAvatar = activeTab === "direct"
    ? (selectedConv?.otherUserAvatar ?? selectedConv?.otherUser?.avatarUrl ?? "")
    : "";

  const messages = (msgsQ.data ?? []) as any[];
  const groupMembers = (membersQ.data ?? []) as any[];
  const typingUsers = (typingQ.data ?? []) as any[];
  const typingLabel = formatTypingLabel(typingUsers);

  return (
    <AppLayout>
      <div className="flex h-[calc(100vh-4rem)] overflow-hidden">
        {/* Sidebar */}
        <div className="w-72 border-r border-border flex flex-col bg-card">
          <div className="p-4 border-b border-border">
            <h2 className="font-semibold text-foreground flex items-center gap-2">
              <MessageSquare className="h-5 w-5 text-primary" /> Chat da Equipe
            </h2>
            {disciplineFilter && (
              <div className="mt-3 flex items-center justify-between gap-2 rounded-lg border border-primary/20 bg-primary/5 px-2.5 py-2" role="status">
                <div className="min-w-0">
                  <p className="text-[10px] font-medium uppercase tracking-wide text-primary">Filtro do Dashboard</p>
                  <p className="truncate text-xs font-semibold text-foreground">Disciplina: {disciplineFilter}</p>
                </div>
                <button type="button" className="shrink-0 text-[10px] font-medium text-primary underline-offset-2 hover:underline" onClick={() => navigate("/team-chat")}>Limpar</button>
              </div>
            )}
          </div>

          {/* Tabs */}
          <div className="flex border-b border-border">
            <button
              className={"flex-1 py-2 text-xs font-medium flex items-center justify-center gap-1 transition-colors " + (activeTab === "direct" ? "text-primary border-b-2 border-primary" : "text-muted-foreground hover:text-foreground")}
              onClick={() => setActiveTab("direct")}
            >
              <Lock className="h-3.5 w-3.5" /> Privado
            </button>
            <button
              className={"flex-1 py-2 text-xs font-medium flex items-center justify-center gap-1 transition-colors " + (activeTab === "groups" ? "text-primary border-b-2 border-primary" : "text-muted-foreground hover:text-foreground") + (disciplineFilter ? " opacity-50" : "")}
              onClick={() => { if (!disciplineFilter) setActiveTab("groups"); }}
              disabled={Boolean(disciplineFilter)}
            >
              <Hash className="h-3.5 w-3.5" /> Grupos{disciplineFilter ? " (selecione sem filtro)" : ""}
            </button>
          </div>

          {activeTab === "direct" && (
            <>
              {/* New direct conversation */}
              <div className="p-3 border-b border-border">
                <p className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1">
                  <Users className="h-3.5 w-3.5" /> Iniciar conversa
                </p>
                <div className="relative mb-2">
                  <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                  <Input
                    placeholder="Buscar membro..."
                    value={searchUser}
                    onChange={e => setSearchUser(e.target.value)}
                    className="pl-8 h-8 text-sm"
                  />
                </div>
                {searchUser && (
                  <div className="max-h-32 overflow-y-auto space-y-1">
                    {filteredUsers.map((u: any) => (
                      <button
                        key={u.id}
                        className="w-full flex items-center gap-2 p-1.5 rounded hover:bg-muted text-left"
                        onClick={() => { getOrCreateM.mutate({ otherUserId: u.id }); setSearchUser(""); }}
                      >
                        <div className="relative shrink-0">
                          <Avatar className="h-6 w-6">
                            <AvatarImage src={u.avatarUrl ?? ""} />
                            <AvatarFallback className="text-xs bg-primary text-primary-foreground">
                              {(u.name ?? u.email).slice(0, 2).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <PresenceDot className="absolute -right-0.5 -bottom-0.5" lastSeenAt={u.lastSeenAt} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm truncate">{u.name ?? u.email}</p>
                          <p className="text-xs text-muted-foreground capitalize">{u.role}</p>
                        </div>
                      </button>
                    ))}
                    {filteredUsers.length === 0 && (
                      <p className="text-xs text-muted-foreground text-center py-2">Nenhum membro encontrado</p>
                    )}
                  </div>
                )}
              </div>

              {/* Direct conversations list */}
              <div className="flex-1 overflow-y-auto">
                {visibleDirectConvs.length === 0 && (
                  <p className="text-xs text-muted-foreground text-center py-8 px-4">
                    {disciplineFilter ? `Nenhuma conversa da disciplina ${disciplineFilter}. Busque um membro abaixo para iniciar.` : "Nenhuma conversa ainda. Busque um membro para iniciar."}
                  </p>
                )}
                {visibleDirectConvs.map((conv: any) => {
                  const name = conv.otherUserName ?? conv.otherUser?.name ?? "Usuário";
                  const avatar = conv.otherUserAvatar ?? conv.otherUser?.avatarUrl ?? "";
                  const isSelected = conv.id === selectedConvId;
                  return (
                    <button
                      key={conv.id}
                      className={"w-full flex items-center gap-3 p-3 hover:bg-muted/50 transition-colors text-left " + (isSelected ? "bg-primary/10 border-r-2 border-primary" : "")}
                      onClick={() => setSelectedConvId(conv.id)}
                    >
                      <div className="relative shrink-0">
                        <Avatar className="h-9 w-9 shrink-0">
                          <AvatarImage src={avatar} />
                          <AvatarFallback className="text-xs bg-primary text-primary-foreground">
                            {name.slice(0, 2).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <PresenceDot className="absolute -right-0.5 -bottom-0.5" lastSeenAt={conv.otherUserLastSeenAt} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{name}</p>
                        {conv.lastMessage && (
                          <p className="text-xs text-muted-foreground truncate">{conv.lastMessage}</p>
                        )}
                      </div>
                      {conv.unreadCount > 0 && (
                        <Badge className="h-5 w-5 p-0 text-xs flex items-center justify-center bg-primary text-primary-foreground">
                          {conv.unreadCount}
                        </Badge>
                      )}
                    </button>
                  );
                })}
              </div>
            </>
          )}

          {activeTab === "groups" && (
            <>
              {/* Create group button */}
              <div className="p-3 border-b border-border">
                <Button
                  size="sm"
                  className="w-full gap-2"
                  onClick={() => setShowCreateGroup(true)}
                >
                  <Plus className="h-3.5 w-3.5" /> Criar Grupo
                </Button>
              </div>

              {/* Group conversations list */}
              <div className="flex-1 overflow-y-auto">
                {groupConvs.length === 0 && (
                  <p className="text-xs text-muted-foreground text-center py-8 px-4">
                    Nenhum grupo ainda. Crie um grupo para colaborar.
                  </p>
                )}
                {groupConvs.map((conv: any) => {
                  const isSelected = conv.id === selectedConvId;
                  return (
                    <button
                      key={conv.id}
                      className={"w-full flex items-center gap-3 p-3 hover:bg-muted/50 transition-colors text-left " + (isSelected ? "bg-primary/10 border-r-2 border-primary" : "")}
                      onClick={() => setSelectedConvId(conv.id)}
                    >
                      <div className="h-9 w-9 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
                        <Hash className="h-4 w-4 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{conv.name}</p>
                        <p className="text-xs text-muted-foreground">{conv.memberCount} membros</p>
                        {conv.lastMessage && (
                          <p className="text-xs text-muted-foreground truncate">{conv.lastMessage}</p>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </>
          )}
        </div>

        {/* Chat area */}
        <div className="flex-1 flex flex-col">
          {!selectedConvId ? (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center">
                <MessageSquare className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
                <p className="text-muted-foreground">Selecione uma conversa ou inicie uma nova</p>
                <p className="text-sm text-muted-foreground/60 mt-1">
                  {activeTab === "groups" ? "Crie um grupo para colaborar com a equipe" : "Busque um membro para iniciar uma conversa privada"}
                </p>
              </div>
            </div>
          ) : (
            <>
              {/* Header */}
              <div className="p-4 border-b border-border bg-card flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  {activeTab === "direct" ? (
                    <Avatar className="h-8 w-8">
                      <AvatarImage src={convAvatar} />
                      <AvatarFallback className="text-xs bg-primary text-primary-foreground">
                        {convTitle.slice(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                  ) : (
                    <div className="h-8 w-8 rounded-full bg-primary/20 flex items-center justify-center">
                      <Hash className="h-4 w-4 text-primary" />
                    </div>
                  )}
                  <div>
                    <p className="font-medium text-sm">{convTitle}</p>
                    <p className={`text-xs capitalize ${typingLabel ? "text-primary font-medium" : "text-muted-foreground"}`}>{typingLabel ?? convSubtitle}</p>
                  </div>
                </div>
                {activeTab === "groups" && groupMembers.length > 0 && (
                  <div className="flex items-center gap-1">
                    {groupMembers.slice(0, 4).map((m: any) => (
                      <Avatar key={m.id} className="h-6 w-6 -ml-1 first:ml-0 border border-background">
                        <AvatarImage src={m.avatarUrl ?? ""} />
                        <AvatarFallback className="text-xs bg-primary/20 text-primary">
                          {(m.name ?? "U").slice(0, 1).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                    ))}
                    {groupMembers.length > 4 && (
                      <span className="text-xs text-muted-foreground ml-1">+{groupMembers.length - 4}</span>
                    )}
                  </div>
                )}
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {msgsQ.isLoading && (
                  <div className="flex justify-center py-8">
                    <div className="text-muted-foreground text-sm">Carregando mensagens...</div>
                  </div>
                )}
                {messages.length === 0 && !msgsQ.isLoading && (
                  <div className="flex justify-center py-8">
                    <p className="text-muted-foreground text-sm">Nenhuma mensagem ainda. Diga olá!</p>
                  </div>
                )}
                {messages.map((msg: any) => {
                  const isMe = msg.senderId === user?.id;
                  return (
                    <div key={msg.id} className={"flex gap-2 " + (isMe ? "flex-row-reverse" : "")}>
                      {!isMe && (
                        <Avatar className="h-7 w-7 shrink-0">
                          <AvatarImage src={msg.senderAvatar ?? ""} />
                          <AvatarFallback className="text-xs bg-primary text-primary-foreground">
                            {(msg.senderName ?? "U").slice(0, 2).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                      )}
                      <div className={"max-w-xs lg:max-w-md " + (isMe ? "items-end" : "items-start") + " flex flex-col"}>
                        {!isMe && activeTab === "groups" && (
                          <p className="text-xs text-muted-foreground mb-0.5 ml-1">{msg.senderName}</p>
                        )}
                        <div className={"px-3 py-2 rounded-2xl text-sm " + (isMe ? "bg-primary text-primary-foreground rounded-tr-sm" : "bg-muted text-foreground rounded-tl-sm")}>
                          {msg.content}
                        </div>
                        <span className="text-xs text-muted-foreground mt-1">
                          {formatDistanceToNow(new Date(msg.createdAt), { addSuffix: true, locale: ptBR })}
                        </span>
                      </div>
                    </div>
                  );
                })}
                <div ref={messagesEndRef} />
              </div>

              {/* Input */}
              <div className="p-4 border-t border-border bg-card">
                <div className="flex gap-2">
                  <Input
                    placeholder="Digite uma mensagem..."
                    value={message}
                    onChange={e => handleMessageChange(e.target.value)}
                    onBlur={stopTyping}
                    onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
                    className="flex-1"
                  />
                  <Button onClick={handleSend} disabled={!message.trim() || sendM.isPending} size="icon">
                    <Send className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Create Group Dialog */}
      <Dialog open={showCreateGroup} onOpenChange={setShowCreateGroup}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Hash className="h-5 w-5 text-primary" /> Criar Grupo
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-foreground mb-1.5 block">Nome do grupo</label>
              <Input
                placeholder="Ex: Equipe Civil, Projeto BR-101..."
                value={groupName}
                onChange={e => setGroupName(e.target.value)}
              />
            </div>
            <div>
              <label className="text-sm font-medium text-foreground mb-2 block">
                Membros ({selectedMembers.length} selecionados)
              </label>
              <div className="max-h-48 overflow-y-auto space-y-1 border border-border rounded-lg p-2">
                {otherUsers.map((u: any) => (
                  <label
                    key={u.id}
                    className="flex items-center gap-3 p-1.5 rounded hover:bg-muted cursor-pointer"
                  >
                    <Checkbox
                      checked={selectedMembers.includes(u.id)}
                      onCheckedChange={() => toggleMember(u.id)}
                    />
                    <Avatar className="h-6 w-6">
                      <AvatarImage src={u.avatarUrl ?? ""} />
                      <AvatarFallback className="text-xs bg-primary text-primary-foreground">
                        {(u.name ?? u.email).slice(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm truncate">{u.name ?? u.email}</p>
                      <p className="text-xs text-muted-foreground capitalize">{u.role}</p>
                    </div>
                  </label>
                ))}
                {otherUsers.length === 0 && (
                  <p className="text-xs text-muted-foreground text-center py-4">Nenhum membro disponível</p>
                )}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateGroup(false)}>Cancelar</Button>
            <Button onClick={handleCreateGroup} disabled={createGroupM.isPending} className="gap-2">
              <Plus className="h-4 w-4" /> Criar Grupo
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
