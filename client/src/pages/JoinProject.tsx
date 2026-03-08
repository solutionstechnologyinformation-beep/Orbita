import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { Loader2, CheckCircle2, XCircle, LogIn } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getLoginUrl } from "@/const";

export default function JoinProject() {
  const [, navigate] = useLocation();
  const { user, loading: authLoading } = useAuth();
  const [token, setToken] = useState<string | null>(null);
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const [projectId, setProjectId] = useState<number | null>(null);

  const acceptMutation = trpc.invites.accept.useMutation({
    onSuccess: (data) => {
      setProjectId(data.projectId);
      setStatus("success");
    },
    onError: (e) => {
      setErrorMsg(e.message ?? "Convite inválido ou expirado.");
      setStatus("error");
    },
  });

  // Extract token from URL on mount
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const t = params.get("token");
    setToken(t);
  }, []);

  // Auto-accept once user is authenticated and token is ready
  useEffect(() => {
    if (!authLoading && user && token && status === "idle") {
      setStatus("loading");
      acceptMutation.mutate({ token });
    }
  }, [authLoading, user, token, status]);

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  // Not logged in — redirect to login preserving the invite URL
  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
              <LogIn className="w-8 h-8 text-primary" />
            </div>
            <CardTitle>Convite para Projeto</CardTitle>
          </CardHeader>
          <CardContent className="text-center space-y-4">
            <p className="text-muted-foreground text-sm">
              Você recebeu um convite para participar de um projeto no <strong>Orbita</strong>.
              Faça login para aceitar o convite.
            </p>
            <Button
              className="w-full gap-2 bg-primary hover:bg-primary/90"
              onClick={() => {
                // Store the return path in sessionStorage so OAuth callback can redirect back
              sessionStorage.setItem("invite_return", window.location.pathname + window.location.search);
              window.location.href = getLoginUrl();
              }}
            >
              <LogIn className="w-4 h-4" />
              Fazer Login para Aceitar
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (status === "loading" || status === "idle") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-3">
          <Loader2 className="w-10 h-10 animate-spin text-primary mx-auto" />
          <p className="text-muted-foreground text-sm">Processando convite...</p>
        </div>
      </div>
    );
  }

  if (status === "success") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-4">
              <CheckCircle2 className="w-8 h-8 text-emerald-600" />
            </div>
            <CardTitle className="text-emerald-700">Convite Aceito!</CardTitle>
          </CardHeader>
          <CardContent className="text-center space-y-4">
            <p className="text-muted-foreground text-sm">
              Você foi adicionado ao projeto com sucesso. Bem-vindo à equipe!
            </p>
            <div className="flex gap-3 justify-center">
              {projectId && (
                <Button
                  className="gap-2 bg-primary hover:bg-primary/90"
                  onClick={() => navigate(`/projects/${projectId}`)}
                >
                  Ver Projeto
                </Button>
              )}
              <Button variant="outline" onClick={() => navigate("/projects")}>
                Meus Projetos
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Error state
  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
            <XCircle className="w-8 h-8 text-red-600" />
          </div>
          <CardTitle className="text-red-700">Convite Inválido</CardTitle>
        </CardHeader>
        <CardContent className="text-center space-y-4">
          <p className="text-muted-foreground text-sm">
            {errorMsg || "Este convite é inválido ou já expirou."}
          </p>
          <Button variant="outline" onClick={() => navigate("/projects")}>
            Ir para Meus Projetos
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
