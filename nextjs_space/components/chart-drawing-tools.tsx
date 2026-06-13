'use client';
import { useState, useRef, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Minus, TrendingUp, Hash, Trash2, MousePointer, Undo2 } from 'lucide-react';

export type DrawingTool = 'none' | 'hline' | 'trendline' | 'fibonacci';

interface Point { x: number; y: number; }

interface Drawing {
  id: string;
  type: DrawingTool;
  points: Point[];
  color: string;
  priceStart?: number;
  priceEnd?: number;
}

interface ChartDrawingToolsProps {
  chartHeight: number;
  chartWidth: number;
  yDomain: [number, number]; // [min, max] price
  onToolChange?: (tool: DrawingTool) => void;
}

const TOOLS: { id: DrawingTool; label: string; icon: any; color: string }[] = [
  { id: 'none', label: 'Seç', icon: MousePointer, color: '#94A3B8' },
  { id: 'hline', label: 'Yatay Çizgi', icon: Minus, color: '#3B82F6' },
  { id: 'trendline', label: 'Trend Çizgisi', icon: TrendingUp, color: '#22C55E' },
  { id: 'fibonacci', label: 'Fibonacci', icon: Hash, color: '#F59E0B' },
];

const FIB_LEVELS = [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1];
const FIB_COLORS = ['#EF4444', '#F59E0B', '#F59E0B', '#3B82F6', '#22C55E', '#22C55E', '#EF4444'];

function priceToY(price: number, yMin: number, yMax: number, height: number): number {
  if (yMax === yMin) return height / 2;
  return height - ((price - yMin) / (yMax - yMin)) * height;
}

function yToPrice(y: number, yMin: number, yMax: number, height: number): number {
  return yMin + ((height - y) / height) * (yMax - yMin);
}

export function ChartDrawingToolbar({ activeTool, onToolChange, onClear, onUndo, drawingCount }: {
  activeTool: DrawingTool;
  onToolChange: (t: DrawingTool) => void;
  onClear: () => void;
  onUndo: () => void;
  drawingCount: number;
}) {
  return (
    <div className="flex items-center gap-1">
      {TOOLS.map(tool => {
        const Icon = tool.icon;
        return (
          <button key={tool.id} onClick={() => onToolChange(tool.id)}
            title={tool.label}
            className={`p-1.5 rounded transition-all ${
              activeTool === tool.id
                ? 'bg-[#3B82F6]/20 text-[#3B82F6] ring-1 ring-[#3B82F6]/40'
                : 'text-muted-foreground hover:text-foreground hover:bg-black/[0.04] dark:hover:bg-white/[0.06]'
            }`}>
            <Icon className="w-3.5 h-3.5" />
          </button>
        );
      })}
      {drawingCount > 0 && (
        <>
          <span className="border-l border-black/[0.08] dark:border-white/[0.08] mx-0.5 h-4" />
          <button onClick={onUndo} title="Geri Al" className="p-1.5 rounded text-muted-foreground hover:text-foreground hover:bg-black/[0.04] dark:hover:bg-white/[0.06] transition">
            <Undo2 className="w-3.5 h-3.5" />
          </button>
          <button onClick={onClear} title="Tümünü Sil" className="p-1.5 rounded text-[#EF4444] hover:bg-[#EF4444]/10 transition">
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </>
      )}
    </div>
  );
}

export function ChartDrawingOverlay({ chartHeight, chartWidth, yDomain, activeTool, drawings, setDrawings }: {
  chartHeight: number;
  chartWidth: number;
  yDomain: [number, number];
  activeTool: DrawingTool;
  drawings: Drawing[];
  setDrawings: React.Dispatch<React.SetStateAction<Drawing[]>>;
}) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [tempPoint, setTempPoint] = useState<Point | null>(null);
  const [startPoint, setStartPoint] = useState<Point | null>(null);
  const [mousePos, setMousePos] = useState<Point | null>(null);

  const [yMin, yMax] = yDomain;
  // Chart margins (Recharts default: left ~65, right ~5, top ~5, bottom ~25)
  const marginLeft = 65;
  const marginRight = 5;
  const marginTop = 5;
  const marginBottom = 25;
  const plotW = chartWidth - marginLeft - marginRight;
  const plotH = chartHeight - marginTop - marginBottom;

  const getSvgPoint = useCallback((e: React.MouseEvent | React.TouchEvent): Point | null => {
    if (!svgRef.current) return null;
    const rect = svgRef.current.getBoundingClientRect();
    const clientX = 'touches' in e ? e.touches[0]?.clientX ?? 0 : e.clientX;
    const clientY = 'touches' in e ? e.touches[0]?.clientY ?? 0 : e.clientY;
    return { x: clientX - rect.left, y: clientY - rect.top };
  }, []);

  const handlePointerDown = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    if (activeTool === 'none') return;
    const pt = getSvgPoint(e);
    if (!pt) return;
    // Clamp to chart area
    const cx = Math.max(marginLeft, Math.min(pt.x, chartWidth - marginRight));
    const cy = Math.max(marginTop, Math.min(pt.y, chartHeight - marginBottom));
    const clamped = { x: cx, y: cy };

    if (activeTool === 'hline') {
      const price = yToPrice(cy - marginTop, yMin, yMax, plotH);
      const drawing: Drawing = {
        id: Date.now().toString(),
        type: 'hline',
        points: [clamped],
        color: '#3B82F6',
        priceStart: price,
      };
      setDrawings(prev => [...prev, drawing]);
    } else if (activeTool === 'trendline' || activeTool === 'fibonacci') {
      if (!startPoint) {
        setStartPoint(clamped);
      } else {
        const priceS = yToPrice(startPoint.y - marginTop, yMin, yMax, plotH);
        const priceE = yToPrice(cy - marginTop, yMin, yMax, plotH);
        const drawing: Drawing = {
          id: Date.now().toString(),
          type: activeTool,
          points: [startPoint, clamped],
          color: activeTool === 'trendline' ? '#22C55E' : '#F59E0B',
          priceStart: priceS,
          priceEnd: priceE,
        };
        setDrawings(prev => [...prev, drawing]);
        setStartPoint(null);
      }
    }
  }, [activeTool, startPoint, yMin, yMax, plotH, chartWidth, chartHeight, marginLeft, marginRight, marginTop, marginBottom, getSvgPoint, setDrawings]);

  const handlePointerMove = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    const pt = getSvgPoint(e);
    if (pt) setMousePos(pt);
  }, [getSvgPoint]);

  const cursorStyle = activeTool !== 'none' ? 'crosshair' : 'default';

  return (
    <svg ref={svgRef}
      width={chartWidth} height={chartHeight}
      style={{ position: 'absolute', top: 0, left: 0, cursor: cursorStyle, pointerEvents: activeTool === 'none' ? 'none' : 'auto' }}
      onMouseDown={handlePointerDown}
      onMouseMove={handlePointerMove}
      onTouchStart={handlePointerDown}
      onTouchMove={handlePointerMove}>
      
      {/* Existing drawings */}
      {drawings.map(d => {
        if (d.type === 'hline') {
          const y = priceToY(d.priceStart!, yMin, yMax, plotH) + marginTop;
          return (
            <g key={d.id}>
              <line x1={marginLeft} y1={y} x2={chartWidth - marginRight} y2={y}
                stroke={d.color} strokeWidth={1.5} strokeDasharray="6 3" opacity={0.8} />
              <rect x={marginLeft} y={y - 10} width={70} height={20} rx={4} fill={d.color} opacity={0.15} />
              <text x={marginLeft + 5} y={y + 4} fill={d.color} fontSize={10} fontWeight={600}>
                {d.priceStart?.toFixed(2)}
              </text>
            </g>
          );
        }
        if (d.type === 'trendline' && d.points.length === 2) {
          return (
            <g key={d.id}>
              <line x1={d.points[0].x} y1={d.points[0].y} x2={d.points[1].x} y2={d.points[1].y}
                stroke={d.color} strokeWidth={2} opacity={0.8} />
              <circle cx={d.points[0].x} cy={d.points[0].y} r={3} fill={d.color} />
              <circle cx={d.points[1].x} cy={d.points[1].y} r={3} fill={d.color} />
            </g>
          );
        }
        if (d.type === 'fibonacci' && d.points.length === 2) {
          const highP = Math.max(d.priceStart!, d.priceEnd!);
          const lowP = Math.min(d.priceStart!, d.priceEnd!);
          const range = highP - lowP;
          return (
            <g key={d.id}>
              {FIB_LEVELS.map((level, i) => {
                const price = highP - range * level;
                const y = priceToY(price, yMin, yMax, plotH) + marginTop;
                return (
                  <g key={level}>
                    <line x1={marginLeft} y1={y} x2={chartWidth - marginRight} y2={y}
                      stroke={FIB_COLORS[i]} strokeWidth={1} strokeDasharray="4 2" opacity={0.6} />
                    <text x={chartWidth - marginRight - 80} y={y - 3} fill={FIB_COLORS[i]} fontSize={9} fontWeight={500}>
                      {(level * 100).toFixed(1)}% ({price.toFixed(2)})
                    </text>
                  </g>
                );
              })}
              {/* Shaded area */}
              <rect x={marginLeft} y={priceToY(highP, yMin, yMax, plotH) + marginTop}
                width={plotW}
                height={Math.abs(priceToY(lowP, yMin, yMax, plotH) - priceToY(highP, yMin, yMax, plotH))}
                fill="#F59E0B" opacity={0.04} />
            </g>
          );
        }
        return null;
      })}

      {/* Preview line while drawing */}
      {startPoint && mousePos && (activeTool === 'trendline' || activeTool === 'fibonacci') && (
        <line x1={startPoint.x} y1={startPoint.y}
          x2={Math.max(marginLeft, Math.min(mousePos.x, chartWidth - marginRight))}
          y2={Math.max(marginTop, Math.min(mousePos.y, chartHeight - marginBottom))}
          stroke={activeTool === 'trendline' ? '#22C55E' : '#F59E0B'} strokeWidth={1.5} strokeDasharray="4 4" opacity={0.6} />
      )}

      {/* Crosshair on mouse position */}
      {activeTool !== 'none' && mousePos && (
        <>
          <line x1={marginLeft} y1={mousePos.y} x2={chartWidth - marginRight} y2={mousePos.y}
            stroke="#94A3B8" strokeWidth={0.5} strokeDasharray="2 2" opacity={0.4} />
          <line x1={mousePos.x} y1={marginTop} x2={mousePos.x} y2={chartHeight - marginBottom}
            stroke="#94A3B8" strokeWidth={0.5} strokeDasharray="2 2" opacity={0.4} />
          <text x={marginLeft + 2} y={mousePos.y - 4} fill="#94A3B8" fontSize={9}>
            {yToPrice(mousePos.y - marginTop, yMin, yMax, plotH).toFixed(2)}
          </text>
        </>
      )}
    </svg>
  );
}
