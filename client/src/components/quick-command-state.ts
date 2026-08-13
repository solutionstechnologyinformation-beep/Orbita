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
