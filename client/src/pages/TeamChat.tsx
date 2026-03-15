import { useState, useEffect, useRef } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import AppLayout from "@/components/AppLayout";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Send, MessageSquare, Users, Search } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";

export default function TeamChat() {
  const { user } = useAuth();
  const [selectedConvId, setSelectedConvId] = useState<number | null>(null);
  const [message, setMessage] = useState("");
  const [searchUser, setSearchUser] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const convsQ = trpc.messages.getConversations.useQuery(undefined, { refetchInterval: 3000 });
  const msgsQ = trpc.messages.getMessages.useQuery(
    { conversationId: selectedConvId! },
    { enabled: !!selectedConvId, refetchInterval: 2000 }
  );
  const usersQ = trpc.users.list.useQuery();
  const utils = trpc.useUtils();

  const getOrCreateM = trpc.messages.getOrCreate.useMutation({
    onSuccess: (data) => {
      setSelectedConvId(data.id);
      utils.messages.getConversations.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  const sendM = trpc.messages.send.useMutation({
    onSuccess: () => {
      utils.messages.getMessages.invalidate({ conversationId: selectedConvId! });
      utils.messages.getConversations.invalidate();
      setMessage("");
    },
    onError: (e) => toast.error(e.message),
  });

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [msgsQ.data]);

  const conversations = (convsQ.data ?? []) as any[];
  const messages = (msgsQ.data ?? []) as any[];
  const allUsers = (usersQ.data ?? []) as any[];
  const otherUsers = allUsers.filter((u: any) => u.id !== user?.id);
  const filteredUsers = searchUser
    ? otherUsers.filter((u: any) => (u.name ?? u.email).toLowerCase().includes(searchUser.toLowerCase()))
    : otherUsers;

  const handleSend = () => {
    if (!message.trim() || !selectedConvId) return;
    sendM.mutate({ conversationId: selectedConvId, content: message.trim() });
  };

  const selectedConv = conversations.find((c: any) => c.id === selectedConvId);

  return (
    <AppLayout>
      <div className="flex h-[calc(100vh-4rem)] overflow-hidden">
        {/* Sidebar */}
        <div className="w-72 border-r border-border flex flex-col bg-card">
          <div className="p-4 border-b border-border">
            <h2 className="font-semibold text-foreground flex items-center gap-2">
              <MessageSquare className="h-5 w-5 text-primary" /> Chat da Equipe
            </h2>
          </div>

          {/* New conversation */}
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
                    <Avatar className="h-6 w-6">
                      <AvatarImage src={u.avatarUrl ?? ""} />
                      <AvatarFallback className="text-xs bg-primary text-primary-foreground">
                        {(u.name ?? u.email).slice(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <span className="text-sm truncate">{u.name ?? u.email}</span>
                  </button>
                ))}
                {filteredUsers.length === 0 && (
                  <p className="text-xs text-muted-foreground text-center py-2">Nenhum membro encontrado</p>
                )}
              </div>
            )}
          </div>

          {/* Conversations list */}
          <div className="flex-1 overflow-y-auto">
            {conversations.length === 0 && (
              <p className="text-xs text-muted-foreground text-center py-8 px-4">
                Nenhuma conversa ainda. Busque um membro para iniciar.
              </p>
            )}
            {conversations.map((conv: any) => {
              const other = conv.otherUser ?? conv;
              const isSelected = conv.id === selectedConvId;
              return (
                <button
                  key={conv.id}
                  className={"w-full flex items-center gap-3 p-3 hover:bg-muted/50 transition-colors text-left " + (isSelected ? "bg-primary/10 border-r-2 border-primary" : "")}
                  onClick={() => setSelectedConvId(conv.id)}
                >
                  <Avatar className="h-9 w-9 shrink-0">
                    <AvatarImage src={other.avatarUrl ?? ""} />
                    <AvatarFallback className="text-xs bg-primary text-primary-foreground">
                      {(other.name ?? other.email ?? "U").slice(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{other.name ?? other.email ?? "Usuario"}</p>
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
        </div>

        {/* Chat area */}
        <div className="flex-1 flex flex-col">
          {!selectedConvId ? (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center">
                <MessageSquare className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
                <p className="text-muted-foreground">Selecione uma conversa ou inicie uma nova</p>
              </div>
            </div>
          ) : (
            <>
              {/* Header */}
              <div className="p-4 border-b border-border bg-card flex items-center gap-3">
                {selectedConv && (
                  <>
                    <Avatar className="h-8 w-8">
                      <AvatarImage src={selectedConv.otherUser?.avatarUrl ?? ""} />
                      <AvatarFallback className="text-xs bg-primary text-primary-foreground">
                        {(selectedConv.otherUser?.name ?? selectedConv.otherUser?.email ?? "U").slice(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="font-medium text-sm">{selectedConv.otherUser?.name ?? selectedConv.otherUser?.email ?? "Usuario"}</p>
                      <p className="text-xs text-muted-foreground capitalize">{selectedConv.otherUser?.role ?? "membro"}</p>
                    </div>
                  </>
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
                    <p className="text-muted-foreground text-sm">Nenhuma mensagem ainda. Diga ola!</p>
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
                    onChange={e => setMessage(e.target.value)}
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
    </AppLayout>
  );
}
