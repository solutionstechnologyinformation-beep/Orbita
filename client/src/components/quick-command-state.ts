export const QUICK_COMMAND_HOVER_CLASSES = "transition duration-300 ease-out hover:-translate-y-1 hover:scale-[1.01] hover:border-[#ffc30d] hover:bg-[#fff9dc] hover:shadow-[0_8px_20px_rgba(0,0,0,0.08)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ffc30d] focus-visible:ring-offset-2 motion-reduce:transition-none motion-reduce:hover:translate-y-0 motion-reduce:hover:scale-100 disabled:transform-none disabled:shadow-none";

export type QuickCommandVisualState = {
  isLoading: boolean;
  isDisabled: boolean;
  title: string;
  description: string;
};

export function getQuickCommandVisualState(
  label: string,
  activeQuickCommand: string | null,
  isPending: boolean,
  isClearingHistory: boolean,
  description: string,
): QuickCommandVisualState {
  const isLoading = activeQuickCommand === label;
  return {
    isLoading,
    isDisabled: isPending || isClearingHistory || (activeQuickCommand !== null && !isLoading),
    title: isLoading ? "Consultando..." : label,
    description: isLoading ? "Processando sua solicitação" : description,
  };
}
