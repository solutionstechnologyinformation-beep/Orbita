import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Zap, Shield, Globe, ArrowRight, Wifi, WifiOff, HardDrive } from "lucide-react";
import { useLocation } from "wouter";

export default function SplashScreen() {
  const [, navigate] = useLocation();
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [cachedDataCount, setCachedDataCount] = useState(0);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    try {
      const keys = Object.keys(localStorage);
      const orbitaKeys = keys.filter(k => k.includes("orbita") || k.includes("trpc"));
      setCachedDataCount(orbitaKeys.length);
    } catch {
      setCachedDataCount(0);
    }

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-center p-6 relative overflow-hidden">
      {/* Background glow effects */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-10 right-10 w-[400px] h-[400px] bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />

      {/* Connectivity & Offline status bar */}
      <div className="absolute top-6 right-6 flex items-center gap-2 rounded-full border border-slate-800 bg-slate-900/80 px-3.5 py-1.5 text-xs font-medium backdrop-blur-md">
        {isOnline ? (
          <>
            <Wifi className="h-3.5 w-3.5 text-emerald-400 animate-pulse" />
            <span className="text-emerald-400">Online — Sincronizado</span>
          </>
        ) : (
          <>
            <WifiOff className="h-3.5 w-3.5 text-amber-400" />
            <span className="text-amber-400">Modo Offline (Dados locais disponíveis)</span>
          </>
        )}
      </div>

      <div className="max-w-xl w-full text-center relative z-10 space-y-6">
        <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-400 to-amber-600 shadow-2xl shadow-amber-500/20">
          <Zap className="h-10 w-10 text-slate-950" />
        </div>

        <div className="space-y-2">
          <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight text-white">
            Orbita <span className="text-amber-400">Enterprise</span>
          </h1>
          <p className="text-sm md:text-base text-slate-400 max-w-md mx-auto">
            Plataforma corporativa de gerenciamento de projetos com inteligência operacional, isolamento multi-tenant e suporte offline resiliente.
          </p>
        </div>

        {cachedDataCount > 0 && !isOnline && (
          <div className="mx-auto max-w-sm rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-300 flex items-center justify-center gap-2">
            <HardDrive className="h-4 w-4 shrink-0" />
            <span>{cachedDataCount} registros em cache local prontos para uso offline.</span>
          </div>
        )}

        <div className="pt-4 flex flex-col sm:flex-row gap-3 justify-center">
          <Button
            size="lg"
            onClick={() => navigate("/dashboard")}
            className="bg-amber-500 text-slate-950 hover:bg-amber-400 font-semibold gap-2 shadow-lg shadow-amber-500/20"
          >
            Acessar Sistema
            <ArrowRight className="h-4 w-4" />
          </Button>
          <Button
            size="lg"
            variant="outline"
            onClick={() => navigate("/")}
            className="border-slate-800 bg-slate-900/50 text-slate-300 hover:bg-slate-800 hover:text-white"
          >
            Conhecer Plataforma
          </Button>
        </div>

        <div className="pt-8 grid grid-cols-3 gap-4 text-left text-xs text-slate-400 border-t border-slate-900">
          <div className="flex items-center gap-2">
            <Shield className="h-4 w-4 text-amber-400 shrink-0" />
            <span>Autenticação 2FA Segura</span>
          </div>
          <div className="flex items-center gap-2">
            <Globe className="h-4 w-4 text-blue-400 shrink-0" />
            <span>Multi-Tenant Blindado</span>
          </div>
          <div className="flex items-center gap-2">
            <HardDrive className="h-4 w-4 text-emerald-400 shrink-0" />
            <span>Cache Offline Resiliente</span>
          </div>
        </div>
      </div>
    </div>
  );
}
