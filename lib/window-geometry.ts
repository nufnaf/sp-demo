export type ResizeEdge = "n" | "ne" | "e" | "se" | "s" | "sw" | "w" | "nw";
export interface WindowFrame { x: number; y: number; width: number; height: number }
export interface WindowArea { width: number; height: number }
const clamp = (value: number, low: number, high: number) => Math.max(low, Math.min(high, value));
const MARGIN = 8;

export function fitWindow(frame: WindowFrame, area: WindowArea): WindowFrame {
  const width = Math.min(frame.width, Math.max(1, area.width - MARGIN * 2));
  const height = Math.min(frame.height, Math.max(1, area.height - MARGIN * 2));
  return { x: clamp(frame.x, MARGIN, area.width - width - MARGIN), y: clamp(frame.y, MARGIN, area.height - height - MARGIN), width, height };
}

/** Resize only the grabbed edges, preserving the opposite edge at minimum size. */
export function resizeWindow(start: WindowFrame, edge: ResizeEdge, dx: number, dy: number, area: WindowArea): WindowFrame {
  const frame = fitWindow(start, area);
  let left = frame.x, top = frame.y, right = left + frame.width, bottom = top + frame.height;
  const minWidth = Math.min(480, frame.width);
  const minHeight = Math.min(320, frame.height);
  if (edge.includes("w")) left = clamp(left + dx, MARGIN, right - minWidth);
  if (edge.includes("e")) right = clamp(right + dx, left + minWidth, area.width - MARGIN);
  if (edge.includes("n")) top = clamp(top + dy, MARGIN, bottom - minHeight);
  if (edge.includes("s")) bottom = clamp(bottom + dy, top + minHeight, area.height - MARGIN);
  return { x: left, y: top, width: right - left, height: bottom - top };
}
