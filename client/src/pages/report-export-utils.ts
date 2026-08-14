export type PrintWindowLike = Pick<Window, "closed">;

export function resolvePrintWindow<T extends PrintWindowLike>(openWindow: () => T | null): T | null {
  const printWindow = openWindow();
  return printWindow && !printWindow.closed ? printWindow : null;
}
