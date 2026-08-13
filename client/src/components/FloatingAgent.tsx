import { useState } from "react";
import { useLocation } from "wouter";
import { Bot, ChevronRight, Loader2, MessageCircle, Send, Sparkles, X } from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function FloatingAgent() {
  const [, navigate] = useLocation();
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [history, setHistory] = useState<Array<{ role: "user" | "assistant"; content: string }>>([
    { role: "assistant", content: "Olá! Posso te levar até tarefas, pesquisar projetos ou consultar sua agenda." },
  ]);

  const chatM = trpc.floatingAgent.chat.useMutation({
    onSuccess: (data) => {
      setHistory((items) => [...items, { role: "assistant", content: data.reply }]);
      const action = data.action;
      if (action?.type === "navigate" && action.targetUrl) {
        navigate(action.targetUrl);
        setOpen(false);
      } else if (action?.type === "agenda") {
        navigate("/calendar");
      } else if (action?.type === "search" && action.searchTerm) {
        toast.info(`Pesquisa sugerida: ${action.searchTerm}`);
        navigate(`/kanban?search=${encodeURIComponent(action.searchTerm)}`);
      }
    },
    onError: (error) => {
      setHistory((items) => [...items, { role: "assistant", content: `Não consegui concluir: ${error.message}` }]);
    },
  });

  const sendMessage = () => {
    const trimmed = message.trim();
    if (!trimmed || chatM.isPending) return;
    setHistory((items) => [...items, { role: "user", content: trimmed }]);
    setMessage("");
    chatM.mutate({ message: trimmed });
  };

  const quickCommands = [
    "Ir para o Kanban",
    "Ver minha agenda",
    "Abrir os projetos",
  ];

  return (
    <div className="fixed bottom-5 right-5 z-[70] flex flex-col items-end gap-3">
      {open && (
        <div className="w-[min(380px,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-black/10 bg-white shadow-2xl">
          <div className="flex items-center gap-3 bg-black px-4 py-3 text-white">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#ffc30d] text-black">
              <Sparkles className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-semibold">Orbita AI</p>
              <p className="text-xs text-white/70">Navegação e consulta inteligente</p>
            </div>
            <Button variant="ghost" size="icon" className="text-white hover:bg-white/10" onClick={() => setOpen(false)} aria-label="Fechar assistente">
              <X className="h-4 w-4" />
            </Button>
          </div>

          <div className="max-h-72 space-y-3 overflow-y-auto p-4">
            {history.map((item, index) => (
              <div key={`${item.role}-${index}`} className={`flex ${item.role === "user" ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm ${item.role === "user" ? "rounded-br-sm bg-[#ffc30d] text-black" : "rounded-bl-sm bg-slate-100 text-slate-800"}`}>
                  {item.content}
                </div>
              </div>
            ))}
            {chatM.isPending && (
              <div className="flex items-center gap-2 text-xs text-slate-500"><Loader2 className="h-3.5 w-3.5 animate-spin" /> Analisando o Orbita...</div>
            )}
          </div>

          <div className="border-t bg-slate-50 p-3">
            <div className="mb-2 flex flex-wrap gap-1.5">
              {quickCommands.map((command) => (
                <button key={command} type="button" className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[11px] text-slate-600 hover:border-[#ffc30d] hover:text-black" onClick={() => { setMessage(command); }}>
                  {command}
                </button>
              ))}
            </div>
            <div className="flex gap-2">
              <Input
                value={message}
                onChange={(event) => setMessage(event.target.value)}
                onKeyDown={(event) => { if (event.key === "Enter") sendMessage(); }}
                placeholder="Ex.: ir para a tarefa 12"
                disabled={chatM.isPending}
                aria-label="Mensagem para o Orbita AI"
              />
              <Button type="button" size="icon" onClick={sendMessage} disabled={!message.trim() || chatM.isPending} aria-label="Enviar comando">
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      )}

      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="group flex h-14 w-14 items-center justify-center rounded-full bg-black text-[#ffc30d] shadow-xl ring-4 ring-[#ffc30d]/30 transition hover:scale-105 hover:ring-[#ffc30d]/60"
        aria-label={open ? "Fechar Orbita AI" : "Abrir Orbita AI"}
        title="Abrir Orbita AI"
      >
        {open ? <ChevronRight className="h-6 w-6" /> : <Bot className="h-6 w-6 transition group-hover:rotate-6" />}
      </button>
    </div>
  );
}
