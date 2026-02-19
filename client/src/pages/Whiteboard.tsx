import AppLayout from "@/components/AppLayout";
import { useState, useRef, useEffect, useCallback } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  Pencil, Square, Circle, Type, Eraser, Trash2, Save, Download,
  Minus, MousePointer, StickyNote,
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

export default function Whiteboard() {
  const [projectId, setProjectId] = useState<number | undefined>(undefined);
  const [tool, setTool] = useState<Tool>("pen");
  const [color, setColor] = useState("#1e2d5a");
  const [strokeWidth, setStrokeWidth] = useState(2);
  const [elements, setElements] = useState<CanvasElement[]>([]);
  const [isDrawing, setIsDrawing] = useState(false);
  const [currentEl, setCurrentEl] = useState<CanvasElement | null>(null);
  const [isDirty, setIsDirty] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const projectsQ = trpc.projects.list.useQuery();
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
        if (Array.isArray(parsed)) setElements(parsed);
      } catch {
        setElements([]);
      }
    } else if (whiteboardQ.isFetched) {
      setElements([]);
    }
  }, [whiteboardQ.data, whiteboardQ.isFetched]);

  // Redraw canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const allEls = currentEl ? [...elements, currentEl] : elements;
    allEls.forEach(el => drawElement(ctx, el));
  }, [elements, currentEl]);

  function drawElement(ctx: CanvasRenderingContext2D, el: CanvasElement) {
    ctx.strokeStyle = el.color;
    ctx.lineWidth = el.strokeWidth;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    switch (el.type) {
      case "pen":
      case "eraser":
        if (!el.points || el.points.length < 2) return;
        ctx.beginPath();
        ctx.strokeStyle = el.type === "eraser" ? "#ffffff" : el.color;
        ctx.lineWidth = el.type === "eraser" ? el.strokeWidth * 4 : el.strokeWidth;
        ctx.moveTo(el.points[0].x, el.points[0].y);
        el.points.slice(1).forEach(p => ctx.lineTo(p.x, p.y));
        ctx.stroke();
        break;
      case "rect":
        if (el.x2 === undefined || el.y2 === undefined) return;
        ctx.beginPath();
        if (el.fill) { ctx.fillStyle = el.fill; ctx.fillRect(el.x, el.y, el.x2 - el.x, el.y2 - el.y); }
        ctx.strokeRect(el.x, el.y, el.x2 - el.x, el.y2 - el.y);
        break;
      case "circle":
        if (el.x2 === undefined || el.y2 === undefined) return;
        const rx = (el.x2 - el.x) / 2, ry = (el.y2 - el.y) / 2;
        ctx.beginPath();
        ctx.ellipse(el.x + rx, el.y + ry, Math.abs(rx), Math.abs(ry), 0, 0, Math.PI * 2);
        if (el.fill) { ctx.fillStyle = el.fill; ctx.fill(); }
        ctx.stroke();
        break;
      case "line":
        if (el.x2 === undefined || el.y2 === undefined) return;
        ctx.beginPath();
        ctx.moveTo(el.x, el.y);
        ctx.lineTo(el.x2, el.y2);
        ctx.stroke();
        break;
      case "text":
        ctx.fillStyle = el.color;
        ctx.font = `${el.strokeWidth * 6 + 12}px Inter, sans-serif`;
        ctx.fillText(el.text ?? "", el.x, el.y);
        break;
      case "sticky":
        if (el.x2 === undefined || el.y2 === undefined) return;
        ctx.fillStyle = "#fef08a";
        ctx.fillRect(el.x, el.y, el.x2 - el.x, el.y2 - el.y);
        ctx.strokeStyle = "#ca8a04";
        ctx.strokeRect(el.x, el.y, el.x2 - el.x, el.y2 - el.y);
        if (el.text) {
          ctx.fillStyle = "#713f12";
          ctx.font = "13px Inter, sans-serif";
          const words = el.text.split(" ");
          let line = "", y = el.y + 20;
          words.forEach(word => {
            const test = line + word + " ";
            if (ctx.measureText(test).width > (el.x2! - el.x) - 10 && line) {
              ctx.fillText(line, el.x + 5, y);
              line = word + " ";
              y += 18;
            } else { line = test; }
          });
          ctx.fillText(line, el.x + 5, y);
        }
        break;
    }
  }

  function getPos(e: React.MouseEvent<HTMLCanvasElement>) {
    const rect = canvasRef.current!.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  function handleMouseDown(e: React.MouseEvent<HTMLCanvasElement>) {
    const pos = getPos(e);
    if (tool === "text") {
      const text = prompt("Digite o texto:");
      if (text) {
        setElements(els => [...els, { id: Date.now().toString(), type: "text", x: pos.x, y: pos.y, text, color, strokeWidth }]);
        setIsDirty(true);
      }
      return;
    }
    if (tool === "sticky") {
      const text = prompt("Texto do post-it (opcional):");
      const el: CanvasElement = { id: Date.now().toString(), type: "sticky", x: pos.x, y: pos.y, x2: pos.x + 150, y2: pos.y + 100, text: text ?? "", color, strokeWidth };
      setElements(els => [...els, el]);
      setIsDirty(true);
      return;
    }
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
    if (!isDrawing || !currentEl) return;
    const pos = getPos(e);
    if (tool === "pen" || tool === "eraser") {
      setCurrentEl(el => el ? { ...el, points: [...(el.points ?? []), pos] } : el);
    } else {
      setCurrentEl(el => el ? { ...el, x2: pos.x, y2: pos.y } : el);
    }
  }

  function handleMouseUp() {
    if (!isDrawing || !currentEl) return;
    setIsDrawing(false);
    setElements(els => [...els, currentEl]);
    setCurrentEl(null);
    setIsDirty(true);
  }

  function handleSave() {
    if (!projectId) { toast.error("Selecione um projeto."); return; }
    saveMut.mutate({ projectId, content: JSON.stringify(elements) });
  }

  function handleClear() {
    if (confirm("Limpar o quadro? Esta ação não pode ser desfeita.")) {
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

  return (
    <AppLayout title="Quadro Branco">
    <div className="p-6 h-[calc(100vh-4rem)] flex flex-col gap-4">
      <div className="flex items-center justify-between flex-shrink-0">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Quadro Branco</h1>
          <p className="text-gray-500 text-sm mt-1">Espaço colaborativo para rascunhos e diagramas</p>
        </div>
        <div className="flex items-center gap-2">
          {isDirty && <Badge variant="outline" className="text-orange-600 border-orange-300">Não salvo</Badge>}
          <Select
            value={projectId?.toString() ?? ""}
            onValueChange={v => setProjectId(Number(v))}
          >
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Selecione um projeto" />
            </SelectTrigger>
            <SelectContent>
              {(projectsQ.data ?? []).map(p => (
                <SelectItem key={p.id} value={p.id.toString()}>{p.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={handleDownload}>
            <Download className="h-4 w-4 mr-1" /> Exportar
          </Button>
          <Button variant="outline" size="sm" onClick={handleClear} className="text-red-500 hover:text-red-700">
            <Trash2 className="h-4 w-4 mr-1" /> Limpar
          </Button>
          <Button size="sm" onClick={handleSave} disabled={saveMut.isPending || !projectId}>
            <Save className="h-4 w-4 mr-1" /> {saveMut.isPending ? "Salvando..." : "Salvar"}
          </Button>
        </div>
      </div>

      <div className="flex gap-3 flex-1 min-h-0">
        {/* Toolbar */}
        <Card className="w-14 flex-shrink-0">
          <CardContent className="p-2 flex flex-col gap-1">
            {TOOLS.map(t => (
              <button
                key={t.id}
                title={t.label}
                onClick={() => setTool(t.id)}
                className={`w-10 h-10 rounded-lg flex items-center justify-center transition-colors ${
                  tool === t.id
                    ? "bg-indigo-100 text-indigo-700"
                    : "text-gray-500 hover:bg-gray-100"
                }`}
              >
                {t.icon}
              </button>
            ))}

            <div className="border-t my-1" />

            {/* Colors */}
            {COLORS.map(c => (
              <button
                key={c}
                title={c}
                onClick={() => setColor(c)}
                className={`w-7 h-7 rounded-full mx-auto border-2 transition-transform ${
                  color === c ? "scale-125 border-indigo-500" : "border-gray-200"
                }`}
                style={{ backgroundColor: c }}
              />
            ))}

            <div className="border-t my-1" />

            {/* Stroke widths */}
            {STROKE_WIDTHS.map(w => (
              <button
                key={w}
                title={`Espessura ${w}`}
                onClick={() => setStrokeWidth(w)}
                className={`w-10 h-6 rounded flex items-center justify-center ${
                  strokeWidth === w ? "bg-indigo-100" : "hover:bg-gray-100"
                }`}
              >
                <div className="rounded-full bg-gray-700" style={{ width: w * 3, height: w * 3 }} />
              </button>
            ))}
          </CardContent>
        </Card>

        {/* Canvas */}
        <div ref={containerRef} className="flex-1 bg-white rounded-xl border overflow-hidden shadow-inner">
          <canvas
            ref={canvasRef}
            width={1200}
            height={800}
            className="w-full h-full"
            style={{ cursor: tool === "eraser" ? "cell" : tool === "text" ? "text" : "crosshair" }}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
          />
        </div>
      </div>
    </div>
    </AppLayout>
  );
}
