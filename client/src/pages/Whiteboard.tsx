import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import {
  Pencil, Square, Circle, Minus, Type, Eraser,
  Trash2, Download, Undo2, Redo2, ZoomIn, ZoomOut, Move,
  Plus, X, Check, Edit2, Save,
} from "lucide-react";
import AppLayout from "@/components/AppLayout";
import { resolveActivePageIndex } from "./whiteboard-utils";

type Tool = "pen" | "line" | "rect" | "ellipse" | "text" | "eraser" | "move";

const COLORS = [
  "#1e293b", "#ef4444", "#f97316", "#eab308",
  "#22c55e", "#3b82f6", "#8b5cf6", "#ec4899",
  "#ffffff",
];

const TOOLS: { id: Tool; icon: React.ElementType; label: string }[] = [
  { id: "pen",     icon: Pencil,  label: "Caneta" },
  { id: "line",    icon: Minus,   label: "Linha" },
  { id: "rect",    icon: Square,  label: "Retângulo" },
  { id: "ellipse", icon: Circle,  label: "Elipse" },
  { id: "text",    icon: Type,    label: "Texto" },
  { id: "eraser",  icon: Eraser,  label: "Borracha" },
  { id: "move",    icon: Move,    label: "Mover" },
];

export default function Whiteboard() {
  // ── Pages ──────────────────────────────────────────────────────────────────
  const utils = trpc.useUtils();
  const boardsQ = trpc.whiteboard.list.useQuery();
  const boards = useMemo(() => (boardsQ.data ?? []) as any[], [boardsQ.data]);
  const sortedBoards = useMemo(() => [...boards].sort((a: any, b: any) => a.pageIndex - b.pageIndex), [boards]);

  const [activePage, setActivePage] = useState(0);
  const [editingTitle, setEditingTitle] = useState<number | null>(null);
  const [editTitleVal, setEditTitleVal] = useState("");
  const [pendingNewPage, setPendingNewPage] = useState(false);
  const [newPageTitle, setNewPageTitle] = useState("");

  const saveMut = trpc.whiteboard.save.useMutation({ onSuccess: () => utils.whiteboard.list.invalidate() });
  const deleteMut = trpc.whiteboard.delete.useMutation({ onSuccess: () => utils.whiteboard.list.invalidate() });
  const renameMut = trpc.whiteboard.rename.useMutation({ onSuccess: () => utils.whiteboard.list.invalidate() });

  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const scheduleAutoSave = useCallback((dataUrl: string) => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      const board = boards.find((b: any) => b.pageIndex === activePage);
      const title = board?.title ?? `Página ${activePage + 1}`;
      saveMut.mutate({ pageIndex: activePage, title, dataUrl });
    }, 1500);
  }, [activePage, boards, saveMut]);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [canvasNode, setCanvasNode] = useState<HTMLCanvasElement | null>(null);
  const setCanvasElement = useCallback((node: HTMLCanvasElement | null) => {
    canvasRef.current = node;
    setCanvasNode(node);
  }, []);
  const [tool, setTool] = useState<Tool>("pen");
  const [color, setColor] = useState("#1e293b");
  const [lineWidth, setLineWidth] = useState(3);
  const [isDrawing, setIsDrawing] = useState(false);
  const [startPos, setStartPos] = useState({ x: 0, y: 0 });
  const [history, setHistory] = useState<ImageData[]>([]);
  const [redoStack, setRedoStack] = useState<ImageData[]>([]);
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  const currentPathRef = useRef<{ x: number; y: number }[]>([]);
  const snapshotRef = useRef<ImageData | null>(null);

  const getCtx = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    return canvas.getContext("2d");
  }, []);

  const getPos = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    return {
      x: (e.clientX - rect.left - offset.x) / zoom,
      y: (e.clientY - rect.top - offset.y) / zoom,
    };
  }, [zoom, offset]);

  const saveSnapshot = useCallback(() => {
    const ctx = getCtx();
    const canvas = canvasRef.current;
    if (!ctx || !canvas) return;
    const snap = ctx.getImageData(0, 0, canvas.width, canvas.height);
    setHistory(h => [...h.slice(-29), snap]);
    setRedoStack([]);
  }, [getCtx]);

  // Reconcile the active page with persisted pages after the list loads.
  useEffect(() => {
    const resolvedPage = resolveActivePageIndex(sortedBoards, activePage);
    if (resolvedPage !== activePage) setActivePage(resolvedPage);
  }, [sortedBoards, activePage]);

  // Load board data when the page or the canvas node changes. The callback ref is
  // essential because the first effect pass can happen before the canvas mounts.
  useEffect(() => {
    const ctx = getCtx();
    const canvas = canvasNode ?? canvasRef.current;
    if (!ctx || !canvas) return;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    setHistory([]);
    setRedoStack([]);
    const board = boards.find((b: any) => b.pageIndex === activePage);
    let cancelled = false;
    if (board?.dataUrl) {
      const img = new Image();
      img.onload = () => { if (!cancelled) ctx.drawImage(img, 0, 0); };
      img.src = board.dataUrl;
    }
    return () => {
      cancelled = true;
    };
  }, [activePage, boards, canvasNode, getCtx]);

  useEffect(() => () => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
  }, []);

  const undo = useCallback(() => {
    const ctx = getCtx();
    const canvas = canvasRef.current;
    if (!ctx || !canvas || history.length === 0) return;
    const prev = history[history.length - 1];
    setRedoStack(r => [ctx.getImageData(0, 0, canvas.width, canvas.height), ...r.slice(0, 9)]);
    ctx.putImageData(prev, 0, 0);
    setHistory(h => h.slice(0, -1));
  }, [getCtx, history]);

  const redo = useCallback(() => {
    const ctx = getCtx();
    const canvas = canvasRef.current;
    if (!ctx || !canvas || redoStack.length === 0) return;
    const next = redoStack[0];
    setHistory(h => [...h, ctx.getImageData(0, 0, canvas.width, canvas.height)]);
    ctx.putImageData(next, 0, 0);
    setRedoStack(r => r.slice(1));
  }, [getCtx, redoStack]);

  const clearCanvas = useCallback(() => {
    const ctx = getCtx();
    const canvas = canvasRef.current;
    if (!ctx || !canvas) return;
    saveSnapshot();
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    scheduleAutoSave(canvas.toDataURL("image/png"));
  }, [getCtx, saveSnapshot, scheduleAutoSave]);

  const exportPNG = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const board = boards.find((b: any) => b.pageIndex === activePage);
    const link = document.createElement("a");
    link.download = `quadro-${board?.title ?? activePage + 1}.png`;
    link.href = canvas.toDataURL("image/png");
    link.click();
  }, [boards, activePage]);



  const onMouseDown = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const ctx = getCtx();
    if (!ctx) return;
    const pos = getPos(e);

    if (tool === "move") {
      setPanStart({ x: e.clientX - offset.x, y: e.clientY - offset.y });
      setIsDrawing(true);
      return;
    }

    if (tool === "text") {
      const text = window.prompt("Digite o texto:");
      if (!text) return;
      saveSnapshot();
      ctx.save();
      ctx.font = `${lineWidth * 6}px Inter, sans-serif`;
      ctx.fillStyle = color;
      ctx.fillText(text, pos.x, pos.y);
      ctx.restore();
      const canvas2 = canvasRef.current;
      if (canvas2) scheduleAutoSave(canvas2.toDataURL("image/png"));
      return;
    }

    saveSnapshot();
    setIsDrawing(true);
    setStartPos(pos);
    currentPathRef.current = [pos];

    const canvas = canvasRef.current!;
    snapshotRef.current = ctx.getImageData(0, 0, canvas.width, canvas.height);

    ctx.save();
    ctx.strokeStyle = tool === "eraser" ? "#ffffff" : color;
    ctx.lineWidth = tool === "eraser" ? lineWidth * 6 : lineWidth;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    if (tool === "pen" || tool === "eraser") {
      ctx.beginPath();
      ctx.moveTo(pos.x, pos.y);
    }
    ctx.restore();
  }, [tool, color, lineWidth, getPos, getCtx, saveSnapshot, offset]);

  const onMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    const ctx = getCtx();
    const canvas = canvasRef.current;
    if (!ctx || !canvas) return;
    const pos = getPos(e);

    if (tool === "move") {
      setOffset({ x: e.clientX - panStart.x, y: e.clientY - panStart.y });
      return;
    }

    if (tool === "pen" || tool === "eraser") {
      ctx.save();
      ctx.strokeStyle = tool === "eraser" ? "#ffffff" : color;
      ctx.lineWidth = tool === "eraser" ? lineWidth * 6 : lineWidth;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.beginPath();
      const prev = currentPathRef.current[currentPathRef.current.length - 1] ?? pos;
      ctx.moveTo(prev.x, prev.y);
      ctx.lineTo(pos.x, pos.y);
      ctx.stroke();
      ctx.restore();
      currentPathRef.current.push(pos);
      return;
    }

    // Shape preview: restore snapshot, then draw shape
    if (snapshotRef.current) ctx.putImageData(snapshotRef.current, 0, 0);
    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = lineWidth;
    ctx.lineCap = "round";
    ctx.beginPath();

    if (tool === "line") {
      ctx.moveTo(startPos.x, startPos.y);
      ctx.lineTo(pos.x, pos.y);
      ctx.stroke();
    } else if (tool === "rect") {
      ctx.strokeRect(startPos.x, startPos.y, pos.x - startPos.x, pos.y - startPos.y);
    } else if (tool === "ellipse") {
      const rx = Math.abs(pos.x - startPos.x) / 2;
      const ry = Math.abs(pos.y - startPos.y) / 2;
      const cx = startPos.x + (pos.x - startPos.x) / 2;
      const cy = startPos.y + (pos.y - startPos.y) / 2;
      ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();
  }, [isDrawing, tool, color, lineWidth, startPos, getPos, getCtx, panStart]);

  const onMouseUp = useCallback(() => {
    if (!isDrawing) return;
    setIsDrawing(false);
    snapshotRef.current = null;
    currentPathRef.current = [];
    const canvas = canvasRef.current;
    if (canvas) scheduleAutoSave(canvas.toDataURL("image/png"));
  }, [isDrawing, scheduleAutoSave]);

  const cursor = tool === "move" ? "grab" : tool === "eraser" ? "cell" : "crosshair";

  // ── Page management ────────────────────────────────────────────────────────
  const maxPage = boards.length > 0 ? Math.max(...boards.map((b: any) => b.pageIndex)) : -1;

  function addPage() { setPendingNewPage(true); setNewPageTitle(`Página ${maxPage + 2}`); }

  function confirmAddPage() {
    const newIndex = maxPage + 1;
    saveMut.mutate(
      { pageIndex: newIndex, title: newPageTitle || `Página ${newIndex + 1}`, dataUrl: "" },
      { onSuccess: () => { setActivePage(newIndex); setPendingNewPage(false); setNewPageTitle(""); } }
    );
  }

  function deletePage(board: any) {
    if (boards.length <= 1) { toast.error("Não é possível excluir a única página."); return; }
    deleteMut.mutate({ id: board.id }, {
      onSuccess: () => {
        if (activePage === board.pageIndex)
          setActivePage(boards.find((b: any) => b.pageIndex !== board.pageIndex)?.pageIndex ?? 0);
      }
    });
  }

  function startRename(board: any) { setEditingTitle(board.id); setEditTitleVal(board.title); }
  function confirmRename(board: any) { renameMut.mutate({ id: board.id, title: editTitleVal || board.title }); setEditingTitle(null); }

  return (
    <AppLayout title="Quadro Branco">
      <div className="flex flex-col h-[calc(100vh-64px)]">
        {/* Toolbar */}
        <div className="flex flex-wrap items-center gap-2 px-4 py-2 bg-gray-50 border-b">
          <>
            {/* Tools */}
            <div className="flex items-center gap-0.5 bg-white border border-gray-200 rounded-lg p-1">
              {TOOLS.map(t => (
                <Tooltip key={t.id}>
                  <TooltipTrigger asChild>
                    <button
                      onClick={() => setTool(t.id)}
                      className={`p-1.5 rounded-md transition-colors ${tool === t.id ? "bg-indigo-100 text-indigo-700" : "text-gray-600 hover:bg-gray-100"}`}
                    >
                      <t.icon className="h-4 w-4" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent>{t.label}</TooltipContent>
                </Tooltip>
              ))}
            </div>

            {/* Colors */}
            <div className="flex items-center gap-1 bg-white border border-gray-200 rounded-lg px-2 py-1">
              {COLORS.map(c => (
                <button
                  key={c}
                  onClick={() => setColor(c)}
                  className={`w-5 h-5 rounded-full border-2 transition-transform ${color === c ? "scale-125 border-indigo-500" : "border-transparent hover:scale-110"}`}
                  style={{ backgroundColor: c, boxShadow: c === "#ffffff" ? "inset 0 0 0 1px #e2e8f0" : undefined }}
                />
              ))}
              <input type="color" value={color} onChange={e => setColor(e.target.value)} className="w-6 h-6 rounded cursor-pointer border-0 p-0" title="Cor personalizada" />
            </div>

            {/* Line width */}
            <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-lg px-2 py-1">
              <span className="text-xs text-gray-500">Espessura</span>
              <input type="range" min={1} max={20} value={lineWidth} onChange={e => setLineWidth(Number(e.target.value))} className="w-20 h-1.5 accent-blue-600" />
              <span className="text-xs font-mono w-4 text-gray-600">{lineWidth}</span>
            </div>

            {/* Zoom */}
            <div className="flex items-center gap-1 bg-white border border-gray-200 rounded-lg p-1">
              <Tooltip>
                <TooltipTrigger asChild>
                  <button onClick={() => setZoom(z => Math.max(0.25, z - 0.25))} className="p-1.5 rounded-md text-gray-600 hover:bg-gray-100">
                    <ZoomOut className="h-4 w-4" />
                  </button>
                </TooltipTrigger>
                <TooltipContent>Diminuir zoom</TooltipContent>
              </Tooltip>
              <span className="text-xs font-mono w-10 text-center text-gray-600">{Math.round(zoom * 100)}%</span>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button onClick={() => setZoom(z => Math.min(4, z + 0.25))} className="p-1.5 rounded-md text-gray-600 hover:bg-gray-100">
                    <ZoomIn className="h-4 w-4" />
                  </button>
                </TooltipTrigger>
                <TooltipContent>Aumentar zoom</TooltipContent>
              </Tooltip>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-1 bg-white border border-gray-200 rounded-lg p-1">
              <Tooltip><TooltipTrigger asChild>
                <button onClick={undo} disabled={history.length === 0} className="p-1.5 rounded-md text-gray-600 hover:bg-gray-100 disabled:opacity-40"><Undo2 className="h-4 w-4" /></button>
              </TooltipTrigger><TooltipContent>Desfazer</TooltipContent></Tooltip>
              <Tooltip><TooltipTrigger asChild>
                <button onClick={redo} disabled={redoStack.length === 0} className="p-1.5 rounded-md text-gray-600 hover:bg-gray-100 disabled:opacity-40"><Redo2 className="h-4 w-4" /></button>
              </TooltipTrigger><TooltipContent>Refazer</TooltipContent></Tooltip>
              <Tooltip><TooltipTrigger asChild>
                <button onClick={clearCanvas} className="p-1.5 rounded-md text-red-500 hover:bg-red-50"><Trash2 className="h-4 w-4" /></button>
              </TooltipTrigger><TooltipContent>Limpar página</TooltipContent></Tooltip>
              <Tooltip><TooltipTrigger asChild>
                <button onClick={exportPNG} className="p-1.5 rounded-md text-gray-600 hover:bg-gray-100"><Download className="h-4 w-4" /></button>
              </TooltipTrigger><TooltipContent>Exportar PNG</TooltipContent></Tooltip>
            </div>
          </>
          {saveMut.isPending && (
            <div className="flex items-center gap-1.5 text-xs text-gray-400 ml-auto">
              <Save className="h-3.5 w-3.5 animate-pulse" /> Salvando...
            </div>
          )}
        </div>

        {/* Canvas area */}
        <div className="flex-1 relative overflow-hidden bg-gray-100" style={{ cursor }}>
          <canvas
            ref={setCanvasElement}
            width={2400}
            height={1600}
            style={{
              transform: `translate(${offset.x}px, ${offset.y}px) scale(${zoom})`,
              transformOrigin: "0 0",
              touchAction: "none",
              display: "block",
              background: "#ffffff",
              boxShadow: "0 2px 16px rgba(0,0,0,0.10)",
            }}
            onMouseDown={onMouseDown}
            onMouseMove={onMouseMove}
            onMouseUp={onMouseUp}
            onMouseLeave={onMouseUp}
          />
          {sortedBoards.length > 0 && (
            <div className="absolute top-3 right-3 bg-white/80 backdrop-blur-sm rounded-lg px-3 py-1.5 text-xs font-medium text-gray-600 border border-gray-200 pointer-events-none">
              {sortedBoards.find(b => b.pageIndex === activePage)?.title ?? `Página ${activePage + 1}`}
            </div>
          )}
        </div>

        {/* Page tabs */}
        <div className="flex items-center gap-1 px-4 py-2 bg-white border-t overflow-x-auto">
          {sortedBoards.map((board: any) => (
            <div
              key={board.id}
              className={`flex items-center gap-1 px-3 py-1.5 rounded-t-md text-sm cursor-pointer border-b-2 transition-colors flex-shrink-0 ${
                activePage === board.pageIndex
                  ? "border-indigo-500 bg-indigo-50 text-indigo-700 font-medium"
                  : "border-transparent text-gray-600 hover:bg-gray-100"
              }`}
              onClick={() => setActivePage(board.pageIndex)}
            >
              {editingTitle === board.id ? (
                <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
                  <Input
                    value={editTitleVal}
                    onChange={e => setEditTitleVal(e.target.value)}
                    onKeyDown={e => { if (e.key === "Enter") confirmRename(board); if (e.key === "Escape") setEditingTitle(null); }}
                    className="h-6 text-xs w-28 px-1"
                    autoFocus
                  />
                  <button onClick={() => confirmRename(board)} className="text-green-600 hover:text-green-700"><Check className="h-3.5 w-3.5" /></button>
                  <button onClick={() => setEditingTitle(null)} className="text-gray-400 hover:text-gray-600"><X className="h-3.5 w-3.5" /></button>
                </div>
              ) : (
                <>
                  <span className="max-w-[120px] truncate">{board.title}</span>
                  {activePage === board.pageIndex && (
                    <div className="flex items-center gap-0.5 ml-1">
                      <button onClick={e => { e.stopPropagation(); startRename(board); }} className="text-gray-400 hover:text-indigo-600 p-0.5 rounded"><Edit2 className="h-3 w-3" /></button>
                      {sortedBoards.length > 1 && (
                        <button onClick={e => { e.stopPropagation(); deletePage(board); }} className="text-gray-400 hover:text-red-500 p-0.5 rounded"><X className="h-3 w-3" /></button>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>
          ))}
          {pendingNewPage ? (
            <div className="flex items-center gap-1 px-2 py-1 border border-indigo-300 rounded-md bg-indigo-50 flex-shrink-0">
              <Input
                value={newPageTitle}
                onChange={e => setNewPageTitle(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter") confirmAddPage(); if (e.key === "Escape") setPendingNewPage(false); }}
                placeholder="Nome da página"
                className="h-6 text-xs w-28 px-1"
                autoFocus
              />
              <button onClick={confirmAddPage} className="text-green-600 hover:text-green-700"><Check className="h-3.5 w-3.5" /></button>
              <button onClick={() => setPendingNewPage(false)} className="text-gray-400 hover:text-gray-600"><X className="h-3.5 w-3.5" /></button>
            </div>
          ) : (
            <button onClick={addPage} className="flex items-center gap-1 px-2 py-1.5 text-xs text-gray-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-md transition-colors flex-shrink-0">
              <Plus className="h-3.5 w-3.5" /> Nova página
            </button>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
