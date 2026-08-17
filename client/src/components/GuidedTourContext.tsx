import { createContext, useCallback, useContext, useMemo, useState } from "react";

interface GuidedTourContextValue {
  isOpen: boolean;
  openGuidedTour: () => void;
  closeGuidedTour: () => void;
}

const GuidedTourContext = createContext<GuidedTourContextValue | null>(null);

export function GuidedTourProvider({ children }: { children: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const openGuidedTour = useCallback(() => setIsOpen(true), []);
  const closeGuidedTour = useCallback(() => setIsOpen(false), []);
  const value = useMemo(() => ({ isOpen, openGuidedTour, closeGuidedTour }), [isOpen, openGuidedTour, closeGuidedTour]);

  return <GuidedTourContext.Provider value={value}>{children}</GuidedTourContext.Provider>;
}

export function useGuidedTour() {
  const context = useContext(GuidedTourContext);
  if (!context) throw new Error("useGuidedTour deve ser usado dentro de GuidedTourProvider");
  return context;
}
