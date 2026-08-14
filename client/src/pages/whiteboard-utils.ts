export function resolveActivePageIndex(boards: Array<{ pageIndex: number }>, activePage: number): number {
  if (boards.length === 0 || boards.some((board) => board.pageIndex === activePage)) return activePage;
  return [...boards].sort((a, b) => a.pageIndex - b.pageIndex)[0].pageIndex;
}
