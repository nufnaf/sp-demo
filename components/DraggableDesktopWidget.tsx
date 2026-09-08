"use client";

import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";

interface Point {
  x: number;
  y: number;
}

interface DraggableDesktopWidgetProps {
  children: ReactNode;
  className: string;
  defaultPosition: CSSProperties;
  widgetId: string;
}

interface DragState {
  pointerId: number;
  pointerX: number;
  pointerY: number;
  startX: number;
  startY: number;
  maxX: number;
  maxY: number;
}

const STORAGE_PREFIX = "pi-web:desktop-widget-position:";
let widgetLayer = 1;

function readPosition(widgetId: string): Point | null {
  try {
    const value = window.localStorage.getItem(`${STORAGE_PREFIX}${widgetId}`);
    if (!value) return null;
    const parsed = JSON.parse(value) as Partial<Point>;
    return Number.isFinite(parsed.x) && Number.isFinite(parsed.y)
      ? { x: parsed.x!, y: parsed.y! }
      : null;
  } catch {
    return null;
  }
}

export function DraggableDesktopWidget({ children, className, defaultPosition, widgetId }: DraggableDesktopWidgetProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<DragState | null>(null);
  const positionRef = useRef<Point | null>(null);
  const [position, setPosition] = useState<Point | null>(null);
  const [dragging, setDragging] = useState(false);
  const [layer, setLayer] = useState(1);

  useEffect(() => {
    const stored = readPosition(widgetId);
    positionRef.current = stored;
    setPosition(stored);
  }, [widgetId]);

  const storePosition = (next: Point) => {
    try {
      window.localStorage.setItem(`${STORAGE_PREFIX}${widgetId}`, JSON.stringify(next));
    } catch { /* Dragging still works when optional UI storage is unavailable. */ }
  };

  const handlePointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    const target = event.target as HTMLElement;
    if (!target.closest(".agent-os-card > header") || target.closest("button, input, a")) return;

    const root = rootRef.current;
    const desktop = root?.parentElement;
    if (!root || !desktop) return;
    const rootRect = root.getBoundingClientRect();
    const desktopRect = desktop.getBoundingClientRect();
    const current = {
      x: rootRect.left - desktopRect.left,
      y: rootRect.top - desktopRect.top,
    };
    const maxX = Math.max(8, desktopRect.width - rootRect.width - 8);
    const maxY = Math.max(8, desktopRect.height - rootRect.height - 8);
    dragRef.current = {
      pointerId: event.pointerId,
      pointerX: event.clientX,
      pointerY: event.clientY,
      startX: current.x,
      startY: current.y,
      maxX,
      maxY,
    };
    positionRef.current = current;
    setPosition(current);
    setDragging(true);
    setLayer(++widgetLayer);
    event.currentTarget.setPointerCapture(event.pointerId);
    event.preventDefault();
  };

  const handlePointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    const next = {
      x: Math.max(8, Math.min(drag.maxX, drag.startX + event.clientX - drag.pointerX)),
      y: Math.max(8, Math.min(drag.maxY, drag.startY + event.clientY - drag.pointerY)),
    };
    positionRef.current = next;
    setPosition(next);
    storePosition(next);
  };

  const finishDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!dragRef.current || dragRef.current.pointerId !== event.pointerId) return;
    dragRef.current = null;
    setDragging(false);
    if (positionRef.current) storePosition(positionRef.current);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  return (
    <div
      ref={rootRef}
      className={`agent-os-desktop-widget ${className}${dragging ? " is-dragging" : ""}`}
      style={position
        ? { left: 0, top: 0, transform: `translate3d(${position.x}px, ${position.y}px, 0)`, zIndex: layer }
        : { ...defaultPosition, zIndex: layer }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={finishDrag}
      onPointerCancel={finishDrag}
      onLostPointerCapture={finishDrag}
    >
      {children}
    </div>
  );
}
