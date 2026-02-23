import AppLayout from "@/components/AppLayout";
import { useState, useRef, useEffect, useCallback } from "react";
import { trpc } from "@/lib/trpc";
import { useLocation } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  Pencil, Square, Circle, Type, Eraser, Trash2, Save, Download,
  Minus, MousePointer, StickyNote, MessageSquare, Undo2,
} from "lucide-react";
import { toast } from "sonner";

type Tool = "select" | "pen" | "rect" | "circle" | "text" | "eraser" | "line" | "sticky";
type CanvasElement = {
  id: string;
  type: Tool;
  x: number;
  y: number;
  x2?: number;
  y2?: number;
  text?: string;
  color: string;
  strokeWidth: number;
  points?: { x: number; y: number }[];
  fill?: string;
};

const COLORS = ["#1e2d5a", "#6366f1", "#ef4444", "#f59e0b", "#10b981", "#3b82f6", "#8b5cf6", "#000000", "#ffffff"];
const STROKE_WIDTHS = [1, 2, 4, 8];

const TOOLS: { id: Tool; icon: React.ReactNode; label: string }[] = [
  { id: "select", icon: <MousePointer className="h-4 w-4" />, label: "Selecionar" },
  { id: "pen", icon: <Pencil className="h-4 w-4" />, label: "Caneta" },
  { id: "eraser", icon: <Eraser className="h-4 w-4" />, label: "Borracha" },
  { id: "line", icon: <Minus className="h-4 w-4" />, label: "Linha" },
  { id: "rect", icon: <Square className="h-4 w-4" />, label: "Retângulo" },
  { id: "circle", icon: <Circle className="h-4 w-4" />, label: "Círculo" },
  { id: "text", icon: <Type className="h-4 w-4" />, label: "Texto" },
  { id: "sticky", icon: <StickyNote className="h-4 w-4" />, label: "Post-it" },
];

export default function Whiteboard() {
  const [, navigate] = useLocation();
  const [projectId, setProjectId] = useState<number | undefined>(undefined);
  const [taskId, setTaskId] = useState<number | undefined>(undefined);
  const [tool, setTool] = useState<Tool>("pen");
  const [color, setColor] = useState("#1e2d5a");
  const [strokeWidth, setStrokeWidth] = useState(2);
  const [elements, setElements] = useState<CanvasElement[]>([]);
  const [history, setHistory] = useState<CanvasElement[][]>([]);
  const [isDrawing, setIsDrawing] = useState(false);
  const [currentEl, setCurrentEl] = useState<CanvasElement | null>(null);
  const [isDirty, setIsDirty] = useState(false);
  const [canvasReady, setCanvasReady] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number | null>(null);

  const projectsQ = trpc.projects.list.useQuery();
  const tasksQ = trpc.tasks.list.useQuery(
    { projectId: projectId! },
    { enabled: !!projectId }
  );
  const whiteboardQ = trpc.whiteboard.get.useQuery(
    { projectId: projectId! },
    { enabled: !!projectId }
  );
  const saveMut = trpc.whiteboard.save.useMutation({
    onSuccess: () => {
      setIsDirty(false);
      toast.success("Quadro salvo!");
    },
    onError: (e) => toast.error(e.message),
  });

  // Load whiteboard data when project changes
  useEffect(() => {
    if (whiteboardQ.data?.content) {
      try {
        const parsed = JSON.parse(whiteboardQ.data.content);
        if (Array.isArray(parsed)) { setElements(parsed); setHistory([]); }
      } catch { setElements([]); }
    } else if (whiteboardQ.isFetched) {
      setElements([]); setHistory([]);
    }
  }, [whiteboardQ.data, whiteboardQ.isFetched]);

  // Reset task selection when project changes
  useEffect(() => { setTaskId(undefined); }, [projectId]);

  // ── Canvas resize: use RAF to wait for layout, then set logical size ─────────
  const syncCanvasSize = useCallback(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return false;

    const rect = container.getBoundingClientRect();
    const w = Math.floor(rect.width);
    const h = Math.floor(rect.height);
    if (w < 10 || h < 10) return false;

    if (canvas.width !== w || canvas.height !== h) {
      // Save current drawing before resizing
      const tempCanvas = document.createElement("canvas");
      tempCanvas.width = canvas.width;
      tempCanvas.height = canvas.height;
      const tempCtx = tempCanvas.getContext("2d");
      if (tempCtx && canvas.width > 0 && canvas.height > 0) {
        tempCtx.drawImage(canvas, 0, 0);
      }
      canvas.width = w;
      canvas.height = h;
      // Restore drawing
      const ctx = canvas.getContext("2d");
      if (ctx && tempCanvas.width > 0 && tempCanvas.height > 0) {
        ctx.drawImage(tempCanvas, 0, 0);
      }
    }
    return true;
  }, []);

  useEffect(() => {
    // Use RAF to ensure DOM has been laid out
    const init = () => {
      const ready = syncCanvasSize();
      if (ready) {
        setCanvasReady(true);
      } else {
        // Retry if container not ready yet
        rafRef.current = requestAnimationFrame(init);
      }
    };
    rafRef.current = requestAnimationFrame(init);

    const ro = new ResizeObserver(() => {
      syncCanvasSize();
    });
    if (containerRef.current) ro.observe(containerRef.current);

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      ro.disconnect();
    };
  }, [syncCanvasSize]);

  // ── Redraw canvas ──────────────────────────────────────────────────────────
  const redraw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !canvasReady) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const allEls = currentEl ? [...elements, currentEl] : elements;
    allEls.forEach(el => drawElement(ctx, el));
  }, [elements, currentEl, canvasReady]);

  useEffect(() => { redraw(); }, [redraw]);

  function drawElement(ctx: CanvasRenderingContext2D, el: CanvasElement) {
    ctx.strokeStyle = el.color;
    ctx.lineWidth = el.strokeWidth;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    switch (el.type) {
      case "pen":
      case "eraser": {
        if (!el.points || el.points.length < 2) return;
        ctx.globalCompositeOperation = el.type === "eraser" ? "destination-out" : "source-over";
        ctx.beginPath();
        ctx.moveTo(el.points[0].x, el.points[0].y);
        el.points.slice(1).forEach(p => ctx.lineTo(p.x, p.y));
        ctx.stroke();
        ctx.globalCompositeOperation = "source-over";
        break;
      }
      case "line":
        if (el.x2 === undefined || el.y2 === undefined) return;
        ctx.beginPath();
        ctx.moveTo(el.x, el.y);
        ctx.lineTo(el.x2, el.y2);
        ctx.stroke();
        break;
      case "rect":
        if (el.x2 === undefined || el.y2 === undefined) return;
        ctx.strokeRect(el.x, el.y, el.x2 - el.x, el.y2 - el.y);
        break;
      case "circle": {
        if (el.x2 === undefined || el.y2 === undefined) return;
        const cx = (el.x + el.x2) / 2;
        const cy = (el.y + el.y2) / 2;
        const rx = Math.abs(el.x2 - el.x) / 2;
        const ry = Math.abs(el.y2 - el.y) / 2;
        ctx.beginPath();
        ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
        ctx.stroke();
        break;
      }
      case "text":
        ctx.fillStyle = el.color;
        ctx.font = `${Math.max(14, el.strokeWidth * 4)}px Inter, sans-serif`;
        ctx.fillText(el.text ?? "", el.x, el.y);
        break;
      case "sticky": {
        if (el.x2 === undefined || el.y2 === undefined) return;
        const w = el.x2 - el.x;
        const h = el.y2 - el.y;
        ctx.fillStyle = "#fef08a";
        ctx.fillRect(el.x, el.y, w, h);
        ctx.strokeStyle = "#ca8a04";
        ctx.lineWidth = 1;
        ctx.strokeRect(el.x, el.y, w, h);
        if (el.text) {
          ctx.fillStyle = "#713f12";
          ctx.font = "13px Inter, sans-serif";
          const words = el.text.split(" ");
          let line = "", ly = el.y + 20;
          words.forEach(word => {
            const test = line + word + " ";
            if (ctx.measureText(test).width > w - 10 && line) {
              ctx.fillText(line, el.x + 5, ly);
              line = word + " ";
              ly += 18;
            } else { line = test; }
          });
          ctx.fillText(line, el.x + 5, ly);
        }
        break;
      }
    }
  }

  // ── Pointer coordinate fix: account for canvas scale ──────────────────────
  function getPos(e: React.MouseEvent<HTMLCanvasElement>): { x: number; y: number } {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    // Since canvas logical size == displayed size (we sync them), scale is 1:1
    // But keep scale calculation for safety
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    };
  }

  function handleMouseDown(e: React.MouseEvent<HTMLCanvasElement>) {
    if (!canvasReady) return;
    const pos = getPos(e);
    if (tool === "text") {
      const text = prompt("Digite o texto:");
      if (text) {
        pushHistory();
        setElements(els => [...els, { id: Date.now().toString(), type: "text", x: pos.x, y: pos.y, text, color, strokeWidth }]);
        setIsDirty(true);
      }
      return;
    }
    if (tool === "sticky") {
      const text = prompt("Texto do post-it (opcional):");
      pushHistory();
      const el: CanvasElement = { id: Date.now().toString(), type: "sticky", x: pos.x, y: pos.y, x2: pos.x + 150, y2: pos.y + 100, text: text ?? "", color, strokeWidth };
      setElements(els => [...els, el]);
      setIsDirty(true);
      return;
    }
    if (tool === "select") return;
    setIsDrawing(true);
    const el: CanvasElement = {
      id: Date.now().toString(),
      type: tool,
      x: pos.x,
      y: pos.y,
      color,
      strokeWidth,
      points: tool === "pen" || tool === "eraser" ? [pos] : undefined,
    };
    setCurrentEl(el);
  }

  function handleMouseMove(e: React.MouseEvent<HTMLCanvasElement>) {
    if (!isDrawing || !currentEl || !canvasReady) return;
    const pos = getPos(e);
    if (tool === "pen" || tool === "eraser") {
      setCurrentEl(el => el ? { ...el, points: [...(el.points ?? []), pos] } : el);
    } else {
      setCurrentEl(el => el ? { ...el, x2: pos.x, y2: pos.y } : el);
    }
  }

  function handleMouseUp() {
    if (!isDrawing || !currentEl) return;
    pushHistory();
    setIsDrawing(false);
    setElements(els => [...els, currentEl]);
    setCurrentEl(null);
    setIsDirty(true);
  }

  function pushHistory() {
    setHistory(h => [...h.slice(-19), elements]);
  }

  function handleUndo() {
    setHistory(h => {
      if (h.length === 0) return h;
      const prev = h[h.length - 1];
      setElements(prev);
      setIsDirty(true);
      return h.slice(0, -1);
    });
  }

  function handleSave() {
    if (!projectId) { toast.error("Selecione um projeto."); return; }
    saveMut.mutate({ projectId, content: JSON.stringify(elements) });
  }

  function handleSaveAndComment() {
    if (!projectId) { toast.error("Selecione um projeto."); return; }
    if (!taskId) { toast.error("Selecione uma atividade para comentar."); return; }
    saveMut.mutate(
      { projectId, content: JSON.stringify(elements) },
      { onSuccess: () => navigate(`/tasks/${taskId}`) }
    );
  }

  function handleClear() {
    if (confirm("Limpar o quadro? Esta ação não pode ser desfeita.")) {
      pushHistory();
      setElements([]);
      setIsDirty(true);
    }
  }

  function handleDownload() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const link = document.createElement("a");
    link.download = "quadro-branco.png";
    link.href = canvas.toDataURL();
    link.click();
  }

  const tasks = (tasksQ.data ?? []) as any[];

  return (
    <AppLayout title="Quadro Branco">
      <div className="h-[calc(100vh-4rem)] flex flex-col gap-3">
        {/* ── Top bar ── */}
        <div className="flex items-center justify-between flex-shrink-0 flex-wrap gap-2">
          <div className="flex items-center gap-2 flex-wrap">
            {/* Project filter */}
            <Select value={projectId?.toString() ?? ""} onValueChange={v => setProjectId(Number(v))}>
              <SelectTrigger className="w-48 h-9 text-sm">
                <SelectValue placeholder="Selecionar projeto" />
              </SelectTrigger>
              <SelectContent>
                {(projectsQ.data ?? []).map((p: any) => (
                  <SelectItem key={p.id} value={p.id.toString()}>{p.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Task filter */}
            <Select
              value={taskId?.toString() ?? ""}
              onValueChange={v => setTaskId(v ? Number(v) : undefined)}
              disabled={!projectId}
            >
              <SelectTrigger className="w-56 h-9 text-sm">
                <SelectValue placeholder={projectId ? "Filtrar por atividade" : "Selecione um projeto"} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">Nenhuma atividade</SelectItem>
                {tasks.map((t: any) => (
                  <SelectItem key={t.id} value={t.id.toString()}>
                    <span className="truncate max-w-[180px]">{t.title}</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {isDirty && <Badge variant="outline" className="text-orange-600 border-orange-300 text-xs">Não salvo</Badge>}
          </div>

          <div className="flex items-center gap-2">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="outline" size="icon" className="h-9 w-9" onClick={handleUndo} disabled={history.length === 0}>
                  <Undo2 className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Desfazer</TooltipContent>
            </Tooltip>
            <Button variant="outline" size="sm" className="h-9" onClick={handleDownload}>
              <Download className="h-4 w-4 mr-1" /> Exportar
            </Button>
            <Button variant="outline" size="sm" className="h-9 text-red-500 hover:text-red-700" onClick={handleClear}>
              <Trash2 className="h-4 w-4 mr-1" /> Limpar
            </Button>
            <Button variant="outline" size="sm" className="h-9" onClick={handleSave} disabled={saveMut.isPending || !projectId}>
              <Save className="h-4 w-4 mr-1" /> {saveMut.isPending ? "Salvando..." : "Salvar"}
            </Button>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  size="sm"
                  className="h-9 bg-indigo-600 hover:bg-indigo-700 text-white"
                  onClick={handleSaveAndComment}
                  disabled={saveMut.isPending || !projectId || !taskId}
                >
                  <MessageSquare className="h-4 w-4 mr-1" />
                  Salvar e comentar
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom">
                {!taskId ? "Selecione uma atividade para comentar" : "Salva o quadro e abre o detalhe da tarefa"}
              </TooltipContent>
            </Tooltip>
          </div>
        </div>

        {/* ── Main area ── */}
        <div className="flex gap-3 flex-1 min-h-0">
          {/* Toolbar */}
          <Card className="w-14 flex-shrink-0 shadow-sm">
            <CardContent className="p-2 flex flex-col gap-1 items-center">
              {TOOLS.map(t => (
                <Tooltip key={t.id}>
                  <TooltipTrigger asChild>
                    <button
                      onClick={() => setTool(t.id)}
                      className={`w-10 h-10 rounded-lg flex items-center justify-center transition-colors ${
                        tool === t.id ? "bg-yellow-100 text-yellow-700" : "text-gray-500 hover:bg-gray-100"
                      }`}
                    >
                      {t.icon}
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="right">{t.label}</TooltipContent>
                </Tooltip>
              ))}

              <div className="border-t w-full my-1" />

              {/* Colors */}
              {COLORS.map(c => (
                <Tooltip key={c}>
                  <TooltipTrigger asChild>
                    <button
                      onClick={() => setColor(c)}
                      className={`w-7 h-7 rounded-full border-2 transition-transform ${
                        color === c ? "scale-125 border-yellow-500" : "border-gray-200 hover:scale-110"
                      }`}
                      style={{ backgroundColor: c }}
                    />
                  </TooltipTrigger>
                  <TooltipContent side="right">{c}</TooltipContent>
                </Tooltip>
              ))}

              <div className="border-t w-full my-1" />

              {/* Stroke widths */}
              {STROKE_WIDTHS.map(w => (
                <Tooltip key={w}>
                  <TooltipTrigger asChild>
                    <button
                      onClick={() => setStrokeWidth(w)}
                      className={`w-10 h-7 rounded flex items-center justify-center ${
                        strokeWidth === w ? "bg-yellow-100" : "hover:bg-gray-100"
                      }`}
                    >
                      <div className="rounded-full bg-gray-700" style={{ width: w * 3, height: w * 3 }} />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="right">Espessura {w}px</TooltipContent>
                </Tooltip>
              ))}
            </CardContent>
          </Card>

          {/* Canvas container — fills remaining space */}
          <div
            ref={containerRef}
            className="flex-1 bg-white rounded-xl border shadow-inner overflow-hidden relative"
            style={{ minHeight: 300 }}
          >
            {!projectId && (
              <div className="absolute inset-0 flex flex-col items-center justify-center text-center bg-gray-50/80 z-10 pointer-events-none">
                <StickyNote className="w-12 h-12 text-gray-300 mb-3" />
                <p className="font-medium text-gray-400">Selecione um projeto para começar</p>
              </div>
            )}
            {!canvasReady && (
              <div className="absolute inset-0 flex items-center justify-center bg-white z-5">
                <div className="text-gray-400 text-sm">Carregando quadro...</div>
              </div>
            )}
            <canvas
              ref={canvasRef}
              style={{
                display: "block",
                width: "100%",
                height: "100%",
                cursor: tool === "eraser" ? "cell" : tool === "text" ? "text" : tool === "select" ? "default" : "crosshair",
                touchAction: "none",
              }}
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
            />
          </div>
        </div>

        {/* Status bar */}
        <div className="flex items-center gap-4 text-xs text-gray-400 flex-shrink-0">
          <span>Ferramenta: <strong className="text-gray-600">{TOOLS.find(t => t.id === tool)?.label}</strong></span>
          {taskId && (
            <span>Atividade: <strong className="text-yellow-600">{tasks.find((t: any) => t.id === taskId)?.title ?? `#${taskId}`}</strong></span>
          )}
          <span className="ml-auto">{elements.length} elemento(s) no quadro</span>
        </div>
      </div>
    </AppLayout>
  );
}
