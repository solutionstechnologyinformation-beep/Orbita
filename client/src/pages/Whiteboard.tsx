import { useState, useRef, useEffect, useCallback } from "react";
import { trpc } from "@/lib/trpc";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { toast } from "sonner";
import {
  Layout, Pencil, Square, Circle, Minus, Type, Eraser,
  Trash2, Download, Undo2, Redo2, ZoomIn, ZoomOut, Move,
} from "lucide-react";
import AppLayout from "@/components/AppLayout";

type Tool = "pen" | "line" | "rect" | "ellipse" | "text" | "eraser" | "move";

interface DrawAction {
  type: Tool;
  color: string;
  lineWidth: number;
  points?: { x: number; y: number }[];
  x?: number; y?: number; w?: number; h?: number;
  text?: string;
}

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
  const [selectedCrsId, setSelectedCrsId] = useState<string>("");
  const { data: crsList } = trpc.crs.list.useQuery();
  const selectedCrs = crsList?.find((c: any) => c.id === Number(selectedCrsId));

  const canvasRef = useRef<HTMLCanvasElement>(null);
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
  }, [getCtx, saveSnapshot]);

  const exportPNG = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const link = document.createElement("a");
    link.download = `quadro-${selectedCrs?.name ?? "branco"}.png`;
    link.href = canvas.toDataURL("image/png");
    link.click();
  }, [selectedCrs]);

  // Init canvas with white background
  useEffect(() => {
    const ctx = getCtx();
    const canvas = canvasRef.current;
    if (!ctx || !canvas) return;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }, [selectedCrsId, getCtx]);

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
    setIsDrawing(false);
    snapshotRef.current = null;
    currentPathRef.current = [];
  }, []);

  const cursor = tool === "eraser" ? "cell" : tool === "move" ? (isDrawing ? "grabbing" : "grab") : tool === "text" ? "text" : "crosshair";

  return (
    <AppLayout title="Quadro Branco">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <Select value={selectedCrsId} onValueChange={v => { setSelectedCrsId(v); }}>
          <SelectTrigger className="w-64 h-9 bg-white border-gray-200 text-sm">
            <SelectValue placeholder="Selecione um CRS..." />
          </SelectTrigger>
          <SelectContent>
            {crsList?.map((c: any) => (
              <SelectItem key={c.id} value={String(c.id)}>
                {c.code ? `[${c.code}] ` : ""}{c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {selectedCrsId && (
          <>
            {/* Tools */}
            <div className="flex items-center gap-1 bg-white border border-gray-200 rounded-lg p-1">
              {TOOLS.map(t => (
                <Tooltip key={t.id}>
                  <TooltipTrigger asChild>
                    <button
                      onClick={() => setTool(t.id)}
                      className={`p-1.5 rounded-md transition-colors ${tool === t.id ? "bg-blue-100 text-blue-700" : "text-gray-600 hover:bg-gray-100"}`}
                    >
                      <t.icon className="h-4 w-4" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent>{t.label}</TooltipContent>
                </Tooltip>
              ))}
            </div>

            {/* Colors */}
            <div className="flex items-center gap-1 bg-white border border-gray-200 rounded-lg p-1">
              {COLORS.map(c => (
                <button
                  key={c}
                  onClick={() => setColor(c)}
                  className={`w-6 h-6 rounded-full border-2 transition-transform ${color === c ? "border-blue-500 scale-110" : "border-transparent"}`}
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
              <Tooltip>
                <TooltipTrigger asChild>
                  <button onClick={undo} disabled={history.length === 0} className="p-1.5 rounded-md text-gray-600 hover:bg-gray-100 disabled:opacity-40">
                    <Undo2 className="h-4 w-4" />
                  </button>
                </TooltipTrigger>
                <TooltipContent>Desfazer</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button onClick={redo} disabled={redoStack.length === 0} className="p-1.5 rounded-md text-gray-600 hover:bg-gray-100 disabled:opacity-40">
                    <Redo2 className="h-4 w-4" />
                  </button>
                </TooltipTrigger>
                <TooltipContent>Refazer</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button onClick={clearCanvas} className="p-1.5 rounded-md text-red-500 hover:bg-red-50">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </TooltipTrigger>
                <TooltipContent>Limpar tudo</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button onClick={exportPNG} className="p-1.5 rounded-md text-gray-600 hover:bg-gray-100">
                    <Download className="h-4 w-4" />
                  </button>
                </TooltipTrigger>
                <TooltipContent>Exportar PNG</TooltipContent>
              </Tooltip>
            </div>
          </>
        )}
      </div>

      {!selectedCrsId ? (
        <div className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-gray-200 bg-gray-50" style={{ height: "70vh" }}>
          <Layout className="h-16 w-16 mb-4 text-gray-300" />
          <p className="text-lg font-medium text-gray-500">Selecione um CRS</p>
          <p className="text-sm mt-1 text-gray-400">Escolha um CRS para abrir o quadro branco</p>
        </div>
      ) : (
        <div className="rounded-xl border border-gray-200 bg-gray-100 overflow-hidden relative" style={{ height: "70vh" }}>
          <div
            className="absolute inset-0 overflow-hidden"
            style={{ cursor }}
          >
            <canvas
              ref={canvasRef}
              width={2400}
              height={1600}
              style={{
                transform: `translate(${offset.x}px, ${offset.y}px) scale(${zoom})`,
                transformOrigin: "0 0",
                touchAction: "none",
                display: "block",
                background: "#ffffff",
              }}
              onMouseDown={onMouseDown}
              onMouseMove={onMouseMove}
              onMouseUp={onMouseUp}
              onMouseLeave={onMouseUp}
            />
          </div>
          {/* CRS label */}
          <div className="absolute top-3 right-3 bg-white/80 backdrop-blur-sm rounded-lg px-3 py-1.5 text-xs font-medium text-gray-600 border border-gray-200 pointer-events-none">
            {selectedCrs?.name}
          </div>
        </div>
      )}
    </AppLayout>
  );
}
