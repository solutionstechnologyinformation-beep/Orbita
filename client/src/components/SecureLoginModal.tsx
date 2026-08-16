import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  KeyRound,
  Loader2,
  Lock,
  Mail,
  ShieldCheck,
  Sparkles,
  TriangleAlert,
} from "lucide-react";
import { toast } from "sonner";
import { getLoginUrl } from "@/const";
import { trpc } from "@/lib/trpc";

type AuthStage = "credentials" | "2fa" | "forgot";
type AuthFeedback = "idle" | "loading" | "info" | "error" | "success";
type TransitionDirection = "forward" | "backward" | "neutral";

export const getAuthStageClass = (stage: AuthStage, direction: TransitionDirection) =>
  `secure-login-stage secure-login-stage-${stage} secure-login-stage-${direction}`;

export const getAuthFeedbackClass = (feedback: AuthFeedback) =>
  `secure-login-feedback secure-login-feedback-${feedback}`;

const wait = (duration: number) => new Promise((resolve) => window.setTimeout(resolve, duration));

export function SecureLoginModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const [name, setName] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [totpCode, setTotpCode] = useState("");
  const [requires2fa, setRequires2fa] = useState(false);
  const [userId, setUserId] = useState<number | null>(null);
  const [mode, setMode] = useState<"login" | "register" | "forgot">("login");
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState<AuthFeedback>("idle");
  const [feedbackMessage, setFeedbackMessage] = useState("");
  const [transitionDirection, setTransitionDirection] = useState<TransitionDirection>("neutral");
  const totpInputRef = useRef<HTMLInputElement>(null);

  const loginMutation = trpc.auth.loginWithCredentials.useMutation();
  const registerMutation = trpc.auth.registerLocalAccount.useMutation();
  const verifyTotpMutation = trpc.auth.verifyTotpLogin.useMutation();

  const stage: AuthStage = mode === "forgot" ? "forgot" : requires2fa ? "2fa" : "credentials";

  useEffect(() => {
    if (!requires2fa) return;
    const focusFrame = window.requestAnimationFrame(() => totpInputRef.current?.focus());
    return () => window.cancelAnimationFrame(focusFrame);
  }, [requires2fa]);

  if (!isOpen) return null;

  const setFeedbackState = (nextFeedback: AuthFeedback, message: string) => {
    setFeedback(nextFeedback);
    setFeedbackMessage(message);
  };

  const goToCredentials = () => {
    setTransitionDirection("backward");
    setRequires2fa(false);
    setTotpCode("");
    setUserId(null);
    setFeedbackState("idle", "");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setFeedbackState("loading", requires2fa ? "Validando o segundo fator..." : "Autenticando credenciais...");

    try {
      if (mode === "forgot") {
        await wait(350);
        toast.success("Se o e-mail estiver cadastrado, as instruções de recuperação foram enviadas.");
        setMode("login");
        setTransitionDirection("backward");
        setFeedbackState("success", "Solicitação enviada com segurança.");
        return;
      }

      if (mode === "register") {
        if (!name.trim() || !companyName.trim() || !email || !password) {
          setLoading(false);
          setFeedbackState("error", "Preencha nome, empresa, e-mail e senha para criar o ambiente local.");
          toast.error("Preencha todos os campos do cadastro.");
          return;
        }

        const res = await registerMutation.mutateAsync({
          name: name.trim(),
          companyName: companyName.trim(),
          email: email.toLowerCase(),
          password,
        });
        if (res.success) {
          setFeedbackState("success", "Empresa e administrador criados. Redirecionando para o painel...");
          toast.success("Ambiente local criado com sucesso!");
          await wait(550);
          window.location.href = "/dashboard";
          return;
        }
      }

      if (requires2fa) {
        if (!totpCode || totpCode.length < 6) {
          setLoading(false);
          setFeedbackState("error", "Informe o código de 6 dígitos para continuar.");
          toast.error("Informe o código do autenticador de 6 dígitos.");
          return;
        }

        if (userId === null) {
          setLoading(false);
          setFeedbackState("error", "Sessão de 2FA expirada. Refaça o login.");
          toast.error("Sessão de 2FA expirada.");
          return;
        }

        const res = await verifyTotpMutation.mutateAsync({ userId, token: totpCode });
        if (res.success) {
          setFeedbackState("success", "Código confirmado. Acesso seguro liberado.");
          toast.success("Autenticação 2FA verificada com sucesso!");
          await wait(600);
          window.location.href = "/dashboard";
          return;
        }
      }

      if (!email || !password) {
        setLoading(false);
        setFeedbackState("error", "Preencha o e-mail e a senha.");
        toast.error("Preencha o e-mail e a senha.");
        return;
      }

      const res = await loginMutation.mutateAsync({ email, password });
      if (res.requires2fa && res.userId) {
        setUserId(res.userId);
        setTransitionDirection("forward");
        setRequires2fa(true);
        setFeedbackState("info", "Credenciais confirmadas. Insira o código TOTP ou de backup.");
        toast.info("Insira o código do seu aplicativo autenticador (TOTP).");
      } else if (res.success) {
        setFeedbackState("success", "Login efetuado com segurança. Redirecionando...");
        toast.success("Login efetuado com segurança!");
        await wait(550);
        window.location.href = "/dashboard";
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Erro desconhecido";
      setLoading(false);
      setFeedbackState("error", `Falha na autenticação: ${message}`);
      toast.error(`Falha na autenticação: ${message}`);
    } finally {
      if (!requires2fa) {
        setLoading(false);
      }
    }
  };

  const is2faStage = stage === "2fa";
  const isForgotStage = stage === "forgot";
  const stageClass = getAuthStageClass(stage, transitionDirection);
  const feedbackClass = getAuthFeedbackClass(feedback);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="secure-login-title"
        className="secure-login-modal w-full max-w-md overflow-hidden rounded-2xl border border-amber-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-900"
      >
        <div className="bg-gradient-to-r from-amber-500 via-amber-600 to-yellow-600 p-6 text-slate-950">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/20 backdrop-blur-md">
                <ShieldCheck className="h-6 w-6 text-slate-950" />
              </div>
              <div>
                <h2 id="secure-login-title" className="text-lg font-bold">Assistente de Acesso Orbita</h2>
                <p className="text-xs font-medium opacity-90">Ambiente blindado e isolado por empresa</p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Fechar autenticação"
              className="rounded-lg p-1.5 text-slate-950/70 transition-colors hover:bg-white/20 hover:text-slate-950"
            >
              ✕
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-6">
          <div className="secure-login-steps" aria-label="Etapas da autenticação">
            <div className={`secure-login-step ${!is2faStage ? "secure-login-step-active" : "secure-login-step-complete"}`}>
              <span className="secure-login-step-icon">
                {is2faStage ? <Check className="h-3.5 w-3.5" aria-hidden="true" /> : "1"}
              </span>
              <span>Credenciais</span>
            </div>
            <span className={`secure-login-step-line ${is2faStage ? "secure-login-step-line-active" : ""}`} aria-hidden="true" />
            <div className={`secure-login-step ${is2faStage ? "secure-login-step-active" : ""}`}>
              <span className="secure-login-step-icon">2</span>
              <span>Verificação 2FA</span>
            </div>
          </div>

          {feedback !== "idle" && feedbackMessage && (
            <div
              key={`${feedback}-${feedbackMessage}`}
              role={feedback === "error" ? "alert" : "status"}
              aria-live="polite"
              className={`${feedbackClass} mt-4`}
            >
              {feedback === "loading" && <Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden="true" />}
              {feedback === "info" && <KeyRound className="h-4 w-4 shrink-0" aria-hidden="true" />}
              {feedback === "error" && <TriangleAlert className="h-4 w-4 shrink-0" aria-hidden="true" />}
              {feedback === "success" && <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden="true" />}
              <span>{feedbackMessage}</span>
            </div>
          )}

          <div key={stage} className={`${stageClass} secure-login-stage-shell mt-4`}>
            {isForgotStage ? (
              <div className="space-y-3">
                <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-3 text-xs text-slate-700 dark:border-amber-900/50 dark:bg-amber-950/20 dark:text-amber-200">
                  Digite o seu e-mail cadastrado. Enviaremos um link criptografado para redefinição segura da senha.
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="forgot-email" className="text-xs font-semibold text-slate-700 dark:text-slate-300">E-mail corporativo</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-3 h-4 w-4 text-slate-400" aria-hidden="true" />
                    <Input id="forgot-email" type="email" placeholder="nome@empresa.com.br" value={email} onChange={(e) => setEmail(e.target.value)} className="pl-9 text-xs" required />
                  </div>
                </div>
                <Button type="submit" className="w-full bg-amber-500 font-semibold text-slate-950 hover:bg-amber-400" disabled={loading}>
                  {loading && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" aria-hidden="true" />}
                  {loading ? "Enviando..." : "Enviar instruções de recuperação"}
                </Button>
                <button type="button" onClick={() => { setMode("login"); setTransitionDirection("backward"); setFeedbackState("idle", ""); }} className="flex w-full items-center justify-center gap-1.5 pt-2 text-xs text-slate-500 transition-colors hover:text-slate-800 dark:hover:text-slate-200">
                  <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" /> Voltar ao login
                </button>
              </div>
            ) : is2faStage ? (
              <div className="space-y-4 py-2 text-center">
                <div className="secure-login-2fa-icon mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-amber-100 text-amber-600 dark:bg-amber-950 dark:text-amber-400">
                  <KeyRound className="h-7 w-7" aria-hidden="true" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">Verificação em Duas Etapas (2FA)</h3>
                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Insira o código TOTP de 6 dígitos ou um código de backup de uso único.</p>
                </div>
                <div className="space-y-1.5 text-left">
                  <Label htmlFor="totp" className="text-xs font-semibold text-slate-700 dark:text-slate-300">Código de Autenticação</Label>
                  <Input
                    ref={totpInputRef}
                    id="totp"
                    type="text"
                    inputMode="text"
                    autoComplete="one-time-code"
                    maxLength={12}
                    placeholder="000 000"
                    value={totpCode}
                    onChange={(e) => setTotpCode(e.target.value)}
                    className={`text-center text-lg font-mono tracking-widest ${feedback === "error" ? "secure-login-input-error" : feedback === "success" ? "secure-login-input-success" : ""}`}
                    required
                    aria-describedby="totp-help"
                  />
                  <p id="totp-help" className="text-center text-[11px] text-slate-400">Insira o código do app autenticador ou código de backup.</p>
                </div>
                <Button type="submit" className="w-full bg-amber-500 font-semibold text-slate-950 hover:bg-amber-400" disabled={loading || feedback === "success"}>
                  {loading ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" aria-hidden="true" /> : feedback === "success" ? <CheckCircle2 className="mr-1.5 h-4 w-4" aria-hidden="true" /> : null}
                  {loading ? "Verificando código..." : feedback === "success" ? "Acesso confirmado" : "Confirmar acesso seguro"}
                </Button>
                <button type="button" onClick={goToCredentials} className="inline-flex items-center gap-1.5 text-xs text-slate-500 transition-colors hover:text-slate-800 dark:hover:text-slate-200">
                  <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" /> Voltar e usar outra credencial
                </button>
              </div>
            ) : (
              <div className="space-y-3.5">
                {mode === "register" && (
                  <>
                    <div className="rounded-xl border border-amber-200 bg-amber-50/60 p-3 text-xs text-slate-700 dark:border-amber-900/50 dark:bg-amber-950/20 dark:text-amber-200">
                      Crie o primeiro administrador e o ambiente isolado da sua empresa para testar o Órbita localmente.
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="register-name" className="text-xs font-semibold text-slate-700 dark:text-slate-300">Nome do administrador</Label>
                      <Input id="register-name" type="text" placeholder="Luiz Otávio Souza" value={name} onChange={(e) => setName(e.target.value)} className="text-xs" required />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="register-company" className="text-xs font-semibold text-slate-700 dark:text-slate-300">Nome da empresa</Label>
                      <Input id="register-company" type="text" placeholder="Minha Empresa de Engenharia" value={companyName} onChange={(e) => setCompanyName(e.target.value)} className="text-xs" required />
                    </div>
                  </>
                )}
                <div className="space-y-1.5">
                  <Label htmlFor="login-email" className="text-xs font-semibold text-slate-700 dark:text-slate-300">E-mail</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-3 h-4 w-4 text-slate-400" aria-hidden="true" />
                    <Input id="login-email" type="email" placeholder="nome@empresa.com.br" value={email} onChange={(e) => setEmail(e.target.value)} className="pl-9 text-xs" required />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                                          <Label htmlFor="login-pass" className="text-xs font-semibold text-slate-700 dark:text-slate-300">{mode === "register" ? "Senha forte (mínimo de 8 caracteres)" : "Senha forte"}</Label>

                    <button type="button" onClick={() => { setMode("forgot"); setTransitionDirection("forward"); setFeedbackState("idle", ""); }} className="text-[11px] text-amber-600 hover:underline">Esqueceu a senha?</button>
                  </div>
                  <div className="relative">
                    <Lock className="absolute left-3 top-3 h-4 w-4 text-slate-400" aria-hidden="true" />
                    <Input id="login-pass" type="password" placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} className="pl-9 text-xs" required />
                  </div>
                </div>

                <Button type="submit" className="w-full bg-amber-500 font-semibold text-slate-950 shadow-md hover:bg-amber-400" disabled={loading}>
                  {loading && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" aria-hidden="true" />}
                  {loading ? "Protegendo acesso..." : mode === "register" ? "Criar conta e iniciar" : "Entrar com segurança"}
                  {!loading && <ArrowRight className="ml-1.5 h-4 w-4" aria-hidden="true" />}
                </Button>

                <div className="relative my-4">
                  <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-slate-200 dark:border-slate-800" /></div>
                  <div className="relative flex justify-center text-[10px] uppercase"><span className="bg-white px-2 text-slate-400 dark:bg-slate-900">ou acesso alternativo</span></div>
                </div>

                <Button type="button" variant="outline" className="w-full border-slate-200 text-xs text-slate-700 hover:bg-slate-50 dark:border-slate-800 dark:text-slate-300 dark:hover:bg-slate-800/50" onClick={() => { window.location.href = getLoginUrl(); }}>
                  <Sparkles className="mr-2 h-4 w-4 text-amber-500" aria-hidden="true" /> Entrar com OAuth do Sistema
                </Button>

                <div className="pt-2 text-center">
                  {mode === "login" ? (
                    <p className="text-xs text-slate-500">
                      Não tem uma conta? <button type="button" onClick={() => { setMode("register"); setTransitionDirection("forward"); setFeedbackState("idle", ""); }} className="font-semibold text-amber-600 hover:underline">Cadastre-se</button>
                    </p>
                  ) : (
                    <p className="text-xs text-slate-500">
                      Já possui acesso? <button type="button" onClick={() => { setMode("login"); setTransitionDirection("backward"); setFeedbackState("idle", ""); }} className="font-semibold text-amber-600 hover:underline">Faça login</button>
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
