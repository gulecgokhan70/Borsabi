'use client';
import { useState, useRef, useCallback } from 'react';
import { Minus, TrendingUp, Hash, Trash2, MousePointer, Undo2, Move } from 'lucide-react';

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

const TOOLS: { id: DrawingTool; label: string; icon: any; color: string; activeColor: string }[] = [
  { id: 'none', label: 'Seç', icon: MousePointer, color: '#94A3B8', activeColor: '#94A3B8' },
  { id: 'hline', label: 'Yatay', icon: Minus, color: '#3B82F6', activeColor: '#3B82F6' },
  { id: 'trendline', label: 'Trend', icon: TrendingUp, color: '#22C55E', activeColor: '#22C55E' },
  { id: 'fibonacci', label: 'Fibo', icon: Hash, color: '#F59E0B', activeColor: '#F59E0B' },
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

// Hit-test: distance from point to a line segment
function distToSegment(px: number, py: number, x1: number, y1: number, x2: number, y2: number): number {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return Math.hypot(px - x1, py - y1);
  let t = ((px - x1) * dx + (py - y1) * dy) / lenSq;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy));
}

const HIT_THRESHOLD = 12; // pixels

export function ChartDrawingToolbar({ activeTool, onToolChange, onClear, onUndo, drawingCount }: {
  activeTool: DrawingTool;
  onToolChange: (t: DrawingTool) => void;
  onClear: () => void;
  onUndo: () => void;
  drawingCount: number;
}) {
  return (
    <div className="flex items-center gap-1.5">
      <div className="flex items-center gap-0.5 p-0.5 rounded-lg glass-inner border border-black/[0.06] dark:border-white/[0.08]">
        {TOOLS.map(tool => {
          const Icon = tool.icon;
          const isActive = activeTool === tool.id;
          return (
            <button key={tool.id} onClick={() => onToolChange(tool.id)}
              title={tool.label}
              className={`flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-semibold transition-all ${
                isActive
                  ? `text-white shadow-sm`
                  : 'text-muted-foreground hover:text-foreground hover:bg-black/[0.04] dark:hover:bg-white/[0.06]'
              }`}
              style={isActive ? { backgroundColor: tool.activeColor } : undefined}>
              <Icon className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">{tool.label}</span>
            </button>
          );
        })}
      </div>
      {drawingCount > 0 && (
        <div className="flex items-center gap-0.5">
          <button onClick={onUndo} title="Geri Al"
            className="flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-medium text-muted-foreground hover:text-foreground hover:bg-black/[0.04] dark:hover:bg-white/[0.06] transition">
            <Undo2 className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Geri</span>
          </button>
          <button onClick={onClear} title="Tümünü Sil"
            className="flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-medium text-[#EF4444] hover:bg-[#EF4444]/10 transition">
            <Trash2 className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Temizle</span>
          </button>
          <span className="text-[10px] text-muted-foreground px-1">({drawingCount})</span>
        </div>
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
  const [startPoint, setStartPoint] = useState<Point | null>(null);
  const [mousePos, setMousePos] = useState<Point | null>(null);

  // Drag state
  const [dragId, setDragId] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState<Point>({ x: 0, y: 0 });
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const [yMin, yMax] = yDomain;
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

  // Find drawing under cursor for drag
  const hitTestDrawing = useCallback((pt: Point): string | null => {
    for (let i = drawings.length - 1; i >= 0; i--) {
      const d = drawings[i];
      if (d.type === 'hline') {
        const y = priceToY(d.priceStart!, yMin, yMax, plotH) + marginTop;
        if (Math.abs(pt.y - y) < HIT_THRESHOLD && pt.x >= marginLeft && pt.x <= chartWidth - marginRight) {
          return d.id;
        }
      } else if (d.type === 'trendline' && d.points.length === 2) {
        const dist = distToSegment(pt.x, pt.y, d.points[0].x, d.points[0].y, d.points[1].x, d.points[1].y);
        if (dist < HIT_THRESHOLD) return d.id;
      } else if (d.type === 'fibonacci' && d.points.length === 2) {
        const highP = Math.max(d.priceStart!, d.priceEnd!);
        const lowP = Math.min(d.priceStart!, d.priceEnd!);
        const yTop = priceToY(highP, yMin, yMax, plotH) + marginTop;
        const yBot = priceToY(lowP, yMin, yMax, plotH) + marginTop;
        if (pt.y >= Math.min(yTop, yBot) - HIT_THRESHOLD && pt.y <= Math.max(yTop, yBot) + HIT_THRESHOLD
            && pt.x >= marginLeft && pt.x <= chartWidth - marginRight) {
          return d.id;
        }
      }
    }
    return null;
  }, [drawings, yMin, yMax, plotH, chartWidth, marginLeft, marginRight, marginTop]);

  const handlePointerDown = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    const pt = getSvgPoint(e);
    if (!pt) return;
    const cx = Math.max(marginLeft, Math.min(pt.x, chartWidth - marginRight));
    const cy = Math.max(marginTop, Math.min(pt.y, chartHeight - marginBottom));
    const clamped = { x: cx, y: cy };

    // In select mode: try to grab a drawing for drag
    if (activeTool === 'none') {
      const hitId = hitTestDrawing(clamped);
      if (hitId) {
        setDragId(hitId);
        setSelectedId(hitId);
        setDragOffset(clamped);
        e.preventDefault();
      } else {
        setSelectedId(null);
      }
      return;
    }

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
  }, [activeTool, startPoint, yMin, yMax, plotH, chartWidth, chartHeight, marginLeft, marginRight, marginTop, marginBottom, getSvgPoint, setDrawings, hitTestDrawing]);

  const handlePointerMove = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    const pt = getSvgPoint(e);
    if (!pt) return;
    setMousePos(pt);

    // Handle dragging
    if (dragId && activeTool === 'none') {
      e.preventDefault();
      const dx = pt.x - dragOffset.x;
      const dy = pt.y - dragOffset.y;
      setDragOffset(pt);

      setDrawings(prev => prev.map(d => {
        if (d.id !== dragId) return d;

        if (d.type === 'hline') {
          const currentY = priceToY(d.priceStart!, yMin, yMax, plotH) + marginTop;
          const newY = Math.max(marginTop, Math.min(currentY + dy, chartHeight - marginBottom));
          const newPrice = yToPrice(newY - marginTop, yMin, yMax, plotH);
          return { ...d, priceStart: newPrice, points: [{ x: d.points[0].x, y: newY }] };
        }

        if (d.type === 'trendline' && d.points.length === 2) {
          const newP1 = {
            x: Math.max(marginLeft, Math.min(d.points[0].x + dx, chartWidth - marginRight)),
            y: Math.max(marginTop, Math.min(d.points[0].y + dy, chartHeight - marginBottom))
          };
          const newP2 = {
            x: Math.max(marginLeft, Math.min(d.points[1].x + dx, chartWidth - marginRight)),
            y: Math.max(marginTop, Math.min(d.points[1].y + dy, chartHeight - marginBottom))
          };
          const priceS = yToPrice(newP1.y - marginTop, yMin, yMax, plotH);
          const priceE = yToPrice(newP2.y - marginTop, yMin, yMax, plotH);
          return { ...d, points: [newP1, newP2], priceStart: priceS, priceEnd: priceE };
        }

        if (d.type === 'fibonacci' && d.points.length === 2) {
          const newP1 = {
            x: Math.max(marginLeft, Math.min(d.points[0].x + dx, chartWidth - marginRight)),
            y: Math.max(marginTop, Math.min(d.points[0].y + dy, chartHeight - marginBottom))
          };
          const newP2 = {
            x: Math.max(marginLeft, Math.min(d.points[1].x + dx, chartWidth - marginRight)),
            y: Math.max(marginTop, Math.min(d.points[1].y + dy, chartHeight - marginBottom))
          };
          const priceS = yToPrice(newP1.y - marginTop, yMin, yMax, plotH);
          const priceE = yToPrice(newP2.y - marginTop, yMin, yMax, plotH);
          return { ...d, points: [newP1, newP2], priceStart: priceS, priceEnd: priceE };
        }

        return d;
      }));
    }
  }, [getSvgPoint, dragId, activeTool, dragOffset, setDrawings, yMin, yMax, plotH, chartWidth, chartHeight, marginLeft, marginRight, marginTop, marginBottom]);

  const handlePointerUp = useCallback(() => {
    setDragId(null);
  }, []);

  // Determine cursor
  let cursorStyle = 'default';
  if (activeTool !== 'none') {
    cursorStyle = 'crosshair';
  } else if (dragId) {
    cursorStyle = 'grabbing';
  }

  // SVG needs pointer events in select mode (for dragging) and in draw mode
  const needsEvents = activeTool !== 'none' || drawings.length > 0;

  return (
    <svg ref={svgRef}
      width={chartWidth} height={chartHeight}
      style={{ position: 'absolute', top: 0, left: 0, cursor: cursorStyle, pointerEvents: needsEvents ? 'auto' : 'none' }}
      onMouseDown={handlePointerDown}
      onMouseMove={handlePointerMove}
      onMouseUp={handlePointerUp}
      onMouseLeave={handlePointerUp}
      onTouchStart={handlePointerDown}
      onTouchMove={handlePointerMove}
      onTouchEnd={handlePointerUp}>

      {/* Defs for filters */}
      <defs>
        <filter id="labelShadow" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="1" stdDeviation="2" floodColor="#000" floodOpacity="0.3" />
        </filter>
      </defs>
      
      {/* Transparent click blocker in draw mode so chart tooltip doesn't interfere */}
      {activeTool !== 'none' && (
        <rect x={0} y={0} width={chartWidth} height={chartHeight} fill="transparent" />
      )}

      {/* Existing drawings */}
      {drawings.map(d => {
        const isSelected = selectedId === d.id;
        const isDragging = dragId === d.id;
        const selectionOpacity = isSelected ? 1 : 0.85;

        if (d.type === 'hline') {
          const y = priceToY(d.priceStart!, yMin, yMax, plotH) + marginTop;
          return (
            <g key={d.id} style={{ cursor: activeTool === 'none' ? 'grab' : undefined }}>
              {/* Wider invisible hit area for easier grabbing */}
              {activeTool === 'none' && (
                <line x1={marginLeft} y1={y} x2={chartWidth - marginRight} y2={y}
                  stroke="transparent" strokeWidth={20} />
              )}
              {/* Selection highlight */}
              {isSelected && (
                <line x1={marginLeft} y1={y} x2={chartWidth - marginRight} y2={y}
                  stroke={d.color} strokeWidth={6} opacity={0.25} />
              )}
              <line x1={marginLeft} y1={y} x2={chartWidth - marginRight} y2={y}
                stroke={d.color} strokeWidth={2} strokeDasharray="8 4" opacity={selectionOpacity} />
              {/* Price label with background */}
              <rect x={chartWidth - marginRight - 95} y={y - 12} width={90} height={22} rx={6}
                fill={d.color} opacity={0.9} filter="url(#labelShadow)" />
              <text x={chartWidth - marginRight - 90} y={y + 3}
                fill="#fff" fontSize={11} fontWeight={700} fontFamily="system-ui">
                {d.priceStart?.toFixed(2)} TL
              </text>
              {/* Left label */}
              <rect x={marginLeft} y={y - 12} width={55} height={22} rx={6}
                fill={d.color} opacity={0.15} />
              <text x={marginLeft + 6} y={y + 3}
                fill={d.color} fontSize={10} fontWeight={600} fontFamily="system-ui">
                Yatay
              </text>
              {/* Drag handle dots when selected */}
              {isSelected && activeTool === 'none' && (
                <>
                  <circle cx={(chartWidth - marginRight + marginLeft) / 2 - 8} cy={y} r={3} fill={d.color} opacity={0.7} />
                  <circle cx={(chartWidth - marginRight + marginLeft) / 2} cy={y} r={3} fill={d.color} opacity={0.7} />
                  <circle cx={(chartWidth - marginRight + marginLeft) / 2 + 8} cy={y} r={3} fill={d.color} opacity={0.7} />
                </>
              )}
            </g>
          );
        }
        if (d.type === 'trendline' && d.points.length === 2) {
          const p1 = d.points[0];
          const p2 = d.points[1];
          const midX = (p1.x + p2.x) / 2;
          const midY = (p1.y + p2.y) / 2;
          const priceDiff = (d.priceEnd! - d.priceStart!).toFixed(2);
          const sign = d.priceEnd! >= d.priceStart! ? '+' : '';
          return (
            <g key={d.id} style={{ cursor: activeTool === 'none' ? (isDragging ? 'grabbing' : 'grab') : undefined }}>
              {/* Wider invisible hit area */}
              {activeTool === 'none' && (
                <line x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y}
                  stroke="transparent" strokeWidth={20} />
              )}
              {/* Selection glow */}
              {isSelected && (
                <line x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y}
                  stroke={d.color} strokeWidth={8} opacity={0.2} />
              )}
              {/* Glow effect */}
              <line x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y}
                stroke={d.color} strokeWidth={6} opacity={0.15} />
              {/* Main line */}
              <line x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y}
                stroke={d.color} strokeWidth={2.5} opacity={selectionOpacity} strokeLinecap="round" />
              {/* Endpoints */}
              <circle cx={p1.x} cy={p1.y} r={isSelected ? 6 : 5} fill={d.color} opacity={0.9} stroke="#fff" strokeWidth={isSelected ? 2 : 1.5} />
              <circle cx={p2.x} cy={p2.y} r={isSelected ? 6 : 5} fill={d.color} opacity={0.9} stroke="#fff" strokeWidth={isSelected ? 2 : 1.5} />
              {/* Price labels at endpoints */}
              <rect x={p1.x - 35} y={p1.y - 22} width={70} height={18} rx={5}
                fill={d.color} opacity={0.85} filter="url(#labelShadow)" />
              <text x={p1.x} y={p1.y - 10} textAnchor="middle"
                fill="#fff" fontSize={10} fontWeight={600} fontFamily="system-ui">
                {d.priceStart?.toFixed(2)}
              </text>
              <rect x={p2.x - 35} y={p2.y + 6} width={70} height={18} rx={5}
                fill={d.color} opacity={0.85} filter="url(#labelShadow)" />
              <text x={p2.x} y={p2.y + 18} textAnchor="middle"
                fill="#fff" fontSize={10} fontWeight={600} fontFamily="system-ui">
                {d.priceEnd?.toFixed(2)}
              </text>
              {/* Midpoint diff label */}
              <rect x={midX - 30} y={midY - 10} width={60} height={18} rx={5}
                fill="#1E293B" opacity={0.85} filter="url(#labelShadow)" />
              <text x={midX} y={midY + 2} textAnchor="middle"
                fill={d.priceEnd! >= d.priceStart! ? '#22C55E' : '#EF4444'} fontSize={10} fontWeight={700} fontFamily="system-ui">
                {sign}{priceDiff}
              </text>
              {/* Move icon when selected */}
              {isSelected && activeTool === 'none' && (
                <>
                  <circle cx={midX} cy={midY + 18} r={10} fill={d.color} opacity={0.2} />
                  <text x={midX} y={midY + 22} textAnchor="middle" fill={d.color} fontSize={10}>⤧</text>
                </>
              )}
            </g>
          );
        }
        if (d.type === 'fibonacci' && d.points.length === 2) {
          const highP = Math.max(d.priceStart!, d.priceEnd!);
          const lowP = Math.min(d.priceStart!, d.priceEnd!);
          const range = highP - lowP;
          return (
            <g key={d.id} style={{ cursor: activeTool === 'none' ? (isDragging ? 'grabbing' : 'grab') : undefined }}>
              {/* Invisible hit area for the whole fib zone */}
              {activeTool === 'none' && (
                <rect x={marginLeft} y={priceToY(highP, yMin, yMax, plotH) + marginTop - HIT_THRESHOLD}
                  width={plotW}
                  height={Math.abs(priceToY(lowP, yMin, yMax, plotH) - priceToY(highP, yMin, yMax, plotH)) + HIT_THRESHOLD * 2}
                  fill="transparent" />
              )}
              {/* Selection border */}
              {isSelected && (
                <rect x={marginLeft - 2}
                  y={priceToY(highP, yMin, yMax, plotH) + marginTop - 2}
                  width={plotW + 4}
                  height={Math.abs(priceToY(lowP, yMin, yMax, plotH) - priceToY(highP, yMin, yMax, plotH)) + 4}
                  fill="none" stroke="#F59E0B" strokeWidth={2} strokeDasharray="4 4" rx={4} opacity={0.5} />
              )}
              {/* Shaded zones between levels */}
              {FIB_LEVELS.slice(0, -1).map((level, i) => {
                const nextLevel = FIB_LEVELS[i + 1];
                const y1 = priceToY(highP - range * level, yMin, yMax, plotH) + marginTop;
                const y2 = priceToY(highP - range * nextLevel, yMin, yMax, plotH) + marginTop;
                return (
                  <rect key={`zone-${i}`} x={marginLeft} y={Math.min(y1, y2)}
                    width={plotW} height={Math.abs(y2 - y1)}
                    fill={FIB_COLORS[i]} opacity={i % 2 === 0 ? 0.04 : 0.07} />
                );
              })}
              {/* Fib level lines + labels */}
              {FIB_LEVELS.map((level, i) => {
                const price = highP - range * level;
                const y = priceToY(price, yMin, yMax, plotH) + marginTop;
                const pctText = `${(level * 100).toFixed(1)}%`;
                return (
                  <g key={level}>
                    <line x1={marginLeft} y1={y} x2={chartWidth - marginRight} y2={y}
                      stroke={FIB_COLORS[i]} strokeWidth={1.5} strokeDasharray="6 3" opacity={0.7} />
                    {/* Right label with bg */}
                    <rect x={chartWidth - marginRight - 115} y={y - 10} width={110} height={19} rx={5}
                      fill={FIB_COLORS[i]} opacity={0.12} />
                    <text x={chartWidth - marginRight - 110} y={y + 3}
                      fill={FIB_COLORS[i]} fontSize={10} fontWeight={700} fontFamily="system-ui">
                      {pctText}  {price.toFixed(2)} TL
                    </text>
                    {/* Left label */}
                    <rect x={marginLeft + 2} y={y - 10} width={38} height={19} rx={5}
                      fill={FIB_COLORS[i]} opacity={0.12} />
                    <text x={marginLeft + 6} y={y + 3}
                      fill={FIB_COLORS[i]} fontSize={9} fontWeight={600} fontFamily="system-ui">
                      {pctText}
                    </text>
                  </g>
                );
              })}
            </g>
          );
        }
        return null;
      })}

      {/* Preview line while drawing */}
      {startPoint && mousePos && (activeTool === 'trendline' || activeTool === 'fibonacci') && (
        <>
          <line x1={startPoint.x} y1={startPoint.y}
            x2={Math.max(marginLeft, Math.min(mousePos.x, chartWidth - marginRight))}
            y2={Math.max(marginTop, Math.min(mousePos.y, chartHeight - marginBottom))}
            stroke={activeTool === 'trendline' ? '#22C55E' : '#F59E0B'} strokeWidth={2} strokeDasharray="6 4" opacity={0.7} />
          <circle cx={startPoint.x} cy={startPoint.y} r={4}
            fill={activeTool === 'trendline' ? '#22C55E' : '#F59E0B'} opacity={0.8} stroke="#fff" strokeWidth={1} />
        </>
      )}

      {/* Crosshair on mouse position */}
      {activeTool !== 'none' && mousePos && (
        <>
          <line x1={marginLeft} y1={mousePos.y} x2={chartWidth - marginRight} y2={mousePos.y}
            stroke="#94A3B8" strokeWidth={0.5} strokeDasharray="3 3" opacity={0.5} />
          <line x1={mousePos.x} y1={marginTop} x2={mousePos.x} y2={chartHeight - marginBottom}
            stroke="#94A3B8" strokeWidth={0.5} strokeDasharray="3 3" opacity={0.5} />
          {/* Price badge at cursor */}
          <rect x={marginLeft} y={mousePos.y - 11} width={72} height={20} rx={5}
            fill="#1E293B" opacity={0.85} />
          <text x={marginLeft + 5} y={mousePos.y + 3}
            fill="#E2E8F0" fontSize={10} fontWeight={600} fontFamily="system-ui">
            {yToPrice(mousePos.y - marginTop, yMin, yMax, plotH).toFixed(2)} TL
          </text>
        </>
      )}

      {/* Active tool indicator */}
      {activeTool !== 'none' && (
        <>
          <rect x={chartWidth / 2 - 60} y={marginTop + 4} width={120} height={22} rx={8}
            fill="#1E293B" opacity={0.75} />
          <text x={chartWidth / 2} y={marginTop + 18} textAnchor="middle"
            fill="#E2E8F0" fontSize={10} fontWeight={500} fontFamily="system-ui">
            ✏️ {activeTool === 'hline' ? 'Tıkla: Yatay Çizgi' : startPoint ? 'Bitiş noktası seç' : 'Başlangıç noktası seç'}
          </text>
        </>
      )}

      {/* Drag mode indicator when selected */}
      {activeTool === 'none' && selectedId && !dragId && (
        <>
          <rect x={chartWidth / 2 - 70} y={marginTop + 4} width={140} height={22} rx={8}
            fill="#1E293B" opacity={0.75} />
          <text x={chartWidth / 2} y={marginTop + 18} textAnchor="middle"
            fill="#E2E8F0" fontSize={10} fontWeight={500} fontFamily="system-ui">
            ✋ Sürükle taşı
          </text>
        </>
      )}
    </svg>
  );
}