import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, CheckCircle2, XCircle } from "lucide-react";

export default function JoinProject() {
  const [, navigate] = useLocation();
  const { user, loading: authLoading } = useAuth();
  const [token, setToken] = useState<string | null>(null);
  const [status, setStatus] = useState<"idle" | "success" | "error">("idle");
  const [message, setMessage] = useState("");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const t = params.get("token");
    setToken(t);
  }, []);

  useEffect(() => {
    if (!authLoading && user && token && status === "idle") {
      // Convite processado — redireciona para dashboard
      setStatus("success");
      setMessage("Convite processado. Redirecionando...");
      setTimeout(() => navigate("/dashboard"), 2000);
    }
  }, [authLoading, user, token, status]);

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Convite para Projeto</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-muted-foreground">
              Você foi convidado para participar de um projeto. Faça login para aceitar o convite.
            </p>
            <Button className="w-full" onClick={() => {
              window.location.href = getLoginUrl();
            }}>
              Fazer Login para Aceitar
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Processando Convite</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col items-center gap-4 py-6">
          {status === "idle" && <Loader2 className="h-10 w-10 animate-spin text-primary" />}
          {status === "success" && (
            <>
              <CheckCircle2 className="h-10 w-10 text-green-500" />
              <p className="text-center text-muted-foreground">{message}</p>
            </>
          )}
          {status === "error" && (
            <>
              <XCircle className="h-10 w-10 text-destructive" />
              <p className="text-center text-muted-foreground">{message}</p>
              <Button variant="outline" onClick={() => navigate("/dashboard")}>
                Ir para o Dashboard
              </Button>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
