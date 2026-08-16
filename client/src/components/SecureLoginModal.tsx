import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ShieldCheck, KeyRound, Mail, Lock, Sparkles, ArrowRight, ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { getLoginUrl } from "@/const";

export function SecureLoginModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [totpCode, setTotpCode] = useState("");
  const [requires2fa, setRequires2fa] = useState(false);
  const [mode, setMode] = useState<"login" | "register" | "forgot">("login");
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (mode === "forgot") {
        toast.success("Se o e-mail estiver cadastrado, as instruções de recuperação foram enviadas.");
        setMode("login");
        return;
      }
      if (requires2fa) {
        if (!totpCode || totpCode.length < 6) {
          toast.error("Informe o código do autenticador de 6 dígitos.");
          return;
        }
        toast.success("Autenticação 2FA verificada com sucesso!");
        window.location.href = "/dashboard";
        return;
      }

      if (!email || !password) {
        toast.error("Preencha o e-mail e a senha.");
        return;
      }

      // Simulação de login seguro estruturado com suporte a 2FA se habilitado
      if (email.includes("admin")) {
        setRequires2fa(true);
        toast.info("Insira o código do seu aplicativo autenticador (TOTP).");
      } else {
        toast.success("Login efetuado com segurança!");
        window.location.href = "/dashboard";
      }
    } catch (err: any) {
      toast.error(`Falha na autenticação: ${err.message || "Erro desconhecido"}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="w-full max-w-md overflow-hidden rounded-2xl border border-amber-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-900">
        <div className="bg-gradient-to-r from-amber-500 via-amber-600 to-yellow-600 p-6 text-slate-950">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/20 backdrop-blur-md">
                <ShieldCheck className="h-6 w-6 text-slate-950" />
              </div>
              <div>
                <h2 className="text-lg font-bold">Assistente de Acesso Orbita</h2>
                <p className="text-xs font-medium opacity-90">Ambiente blindado e isolado por empresa</p>
              </div>
            </div>
            <button onClick={onClose} className="rounded-lg p-1.5 text-slate-950/70 hover:bg-white/20 hover:text-slate-950 transition-colors">
              ✕
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {mode === "forgot" ? (
            <div className="space-y-3">
              <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-3 text-xs text-slate-700 dark:border-amber-900/50 dark:bg-amber-950/20 dark:text-amber-200">
                Digite o seu e-mail cadastrado. Enviaremos um link criptografado para redefinição segura da senha.
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="forgot-email" className="text-xs font-semibold text-slate-700 dark:text-slate-300">E-mail corporativo</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                  <Input id="forgot-email" type="email" placeholder="nome@empresa.com.br" value={email} onChange={(e) => setEmail(e.target.value)} className="pl-9 text-xs" required />
                </div>
              </div>
              <Button type="submit" className="w-full bg-amber-500 text-slate-950 hover:bg-amber-400 font-semibold" disabled={loading}>
                {loading ? "Enviando..." : "Enviar instruções de recuperação"}
              </Button>
              <button type="button" onClick={() => setMode("login")} className="flex items-center justify-center gap-1.5 w-full text-xs text-slate-500 hover:text-slate-800 pt-2">
                <ArrowLeft className="h-3.5 w-3.5" /> Voltar ao login
              </button>
            </div>
          ) : requires2fa ? (
            <div className="space-y-4 text-center py-2">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-amber-100 text-amber-600 dark:bg-amber-950 dark:text-amber-400">
                <KeyRound className="h-7 w-7" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">Verificação em Duas Etapas (2FA)</h3>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Insira o código de 6 dígitos gerado pelo seu aplicativo autenticador (Google Authenticator, Authy ou 1Password).</p>
              </div>
              <div className="space-y-1.5 text-left">
                <Label htmlFor="totp" className="text-xs font-semibold text-slate-700 dark:text-slate-300">Código TOTP</Label>
                <Input id="totp" type="text" maxLength={6} placeholder="000 000" value={totpCode} onChange={(e) => setTotpCode(e.target.value)} className="text-center text-lg font-mono tracking-widest" required autoFocus />
              </div>
              <Button type="submit" className="w-full bg-amber-500 text-slate-950 hover:bg-amber-400 font-semibold" disabled={loading}>
                {loading ? "Verificando..." : "Confirmar acesso seguro"}
              </Button>
              <button type="button" onClick={() => setRequires2fa(false)} className="text-xs text-slate-500 hover:text-slate-800">
                Usar outra credencial
              </button>
            </div>
          ) : (
            <div className="space-y-3.5">
              <div className="space-y-1.5">
                <Label htmlFor="login-email" className="text-xs font-semibold text-slate-700 dark:text-slate-300">E-mail</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                  <Input id="login-email" type="email" placeholder="nome@empresa.com.br" value={email} onChange={(e) => setEmail(e.target.value)} className="pl-9 text-xs" required />
                </div>
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label htmlFor="login-pass" className="text-xs font-semibold text-slate-700 dark:text-slate-300">Senha forte</Label>
                  <button type="button" onClick={() => setMode("forgot")} className="text-[11px] text-amber-600 hover:underline">Esqueceu a senha?</button>
                </div>
                <div className="relative">
                  <Lock className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                  <Input id="login-pass" type="password" placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} className="pl-9 text-xs" required />
                </div>
              </div>

              <Button type="submit" className="w-full bg-amber-500 text-slate-950 hover:bg-amber-400 font-semibold shadow-md" disabled={loading}>
                {loading ? "Entrando..." : mode === "register" ? "Criar conta e iniciar" : "Entrar com segurança"}
                <ArrowRight className="ml-1.5 h-4 w-4" />
              </Button>

              <div className="relative my-4">
                <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-slate-200 dark:border-slate-800" /></div>
                <div className="relative flex justify-center text-[10px] uppercase"><span className="bg-white px-2 text-slate-400 dark:bg-slate-900">ou acesso alternativo</span></div>
              </div>

              <Button type="button" variant="outline" className="w-full border-slate-200 text-slate-700 hover:bg-slate-50 dark:border-slate-800 dark:text-slate-300 dark:hover:bg-slate-800/50 text-xs" onClick={() => { window.location.href = getLoginUrl(); }}>
                <Sparkles className="mr-2 h-4 w-4 text-amber-500" /> Entrar com OAuth do Sistema
              </Button>

              <div className="text-center pt-2">
                {mode === "login" ? (
                  <p className="text-xs text-slate-500">
                    Não tem uma conta? <button type="button" onClick={() => setMode("register")} className="font-semibold text-amber-600 hover:underline">Cadastre-se</button>
                  </p>
                ) : (
                  <p className="text-xs text-slate-500">
                    Já possui acesso? <button type="button" onClick={() => setMode("login")} className="font-semibold text-amber-600 hover:underline">Faça login</button>
                  </p>
                )}
              </div>
            </div>
          )}
        </form>
      </div>
    </div>
  );
}
