import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { X, ChevronRight, ChevronLeft, Sparkles, Shield, Globe, Palette } from "lucide-react";

interface TourStep {
  title: string;
  description: string;
  icon: React.ReactNode;
  targetId?: string;
}

const TOUR_STEPS: TourStep[] = [
  {
    title: "Bem-vindo ao Painel Administrativo",
    description: "Este tour guiado vai apresentar as principais ferramentas de personalização de marca, domínios personalizados e segurança do Orbita.",
    icon: <Sparkles className="h-6 w-6 text-amber-500" />,
  },
  {
    title: "Personalização de Branding",
    description: "Altere cores, nome da empresa e logotipos em tempo real. O painel inclui preview interativo e feedback visual com suporte a acessibilidade.",
    icon: <Palette className="h-6 w-6 text-indigo-600" />,
    targetId: "branding-tab",
  },
  {
    title: "Domínios Personalizados e SSL",
    description: "Configure domínios customizados para sua empresa com verificação automática de DNS TXT, redirecionamento 301 e certificados SSL.",
    icon: <Globe className="h-6 w-6 text-emerald-600" />,
    targetId: "domains-tab",
  },
  {
    title: "Segurança e Logs de Auditoria",
    description: "Monitore acessos, gerencie permissões multi-tenant e exporte relatórios detalhados de auditoria e conformidade em formato CSV.",
    icon: <Shield className="h-6 w-6 text-blue-600" />,
    targetId: "security-tab",
  },
];

export function AdminOnboardingTour({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const [currentStep, setCurrentStep] = useState(0);

  useEffect(() => {
    if (!isOpen) setCurrentStep(0);
  }, [isOpen]);

  if (!isOpen) return null;

  const step = TOUR_STEPS[currentStep];
  const isLast = currentStep === TOUR_STEPS.length - 1;

  const handleNext = () => {
    if (isLast) {
      onClose();
    } else {
      setCurrentStep((s) => s + 1);
    }
  };

  const handlePrev = () => {
    if (currentStep > 0) setCurrentStep((s) => s - 1);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg rounded-2xl bg-white dark:bg-slate-900 p-6 shadow-2xl border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100">
        <button
          onClick={onClose}
          className="absolute right-4 top-4 rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          aria-label="Fechar tour"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="flex items-center gap-3 mb-4">
          <div className="rounded-xl bg-indigo-50 dark:bg-indigo-950/50 p-3">{step.icon}</div>
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
              Passo {currentStep + 1} de {TOUR_STEPS.length}
            </span>
            <h3 className="text-xl font-bold">{step.title}</h3>
          </div>
        </div>

        <p className="text-slate-600 dark:text-slate-300 text-sm leading-relaxed mb-6">{step.description}</p>

        <div className="flex items-center justify-between border-t border-slate-100 dark:border-slate-800 pt-4">
          <div className="flex gap-1.5">
            {TOUR_STEPS.map((_, idx) => (
              <span
                key={idx}
                className={`h-2 rounded-full transition-all duration-300 ${
                  idx === currentStep ? "w-6 bg-indigo-600 dark:bg-indigo-500" : "w-2 bg-slate-200 dark:bg-slate-700"
                }`}
              />
            ))}
          </div>

          <div className="flex items-center gap-2">
            {currentStep > 0 && (
              <Button variant="outline" size="sm" onClick={handlePrev} className="gap-1">
                <ChevronLeft className="h-4 w-4" /> Anterior
              </Button>
            )}
            <Button size="sm" onClick={handleNext} className="gap-1 bg-indigo-600 hover:bg-indigo-700 text-white">
              {isLast ? "Concluir" : "Próximo"} <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
