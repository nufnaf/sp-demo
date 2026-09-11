import type { WindowArea, WindowFrame } from "../window-geometry";

export interface PreviewLayout { cardWidth: number; scale: number; obstacles: WindowFrame[] }
const GAP = 16;
const overlaps = (a: WindowFrame, b: WindowFrame) => a.x < b.x + b.width + GAP && a.x + a.width + GAP > b.x && a.y < b.y + b.height + GAP && a.y + a.height + GAP > b.y;

/** Prefer the lower right empty area, fitting between cards before shrinking. */
function vacantFrame(area: WindowArea, width: number, aspect: number, obstacles: WindowFrame[]): WindowFrame | null {
  const height = width / aspect;
  const maxX = area.width - width - GAP, maxY = area.height - height - GAP;
  const xs = [maxX, GAP, ...obstacles.flatMap(card => [card.x - width - GAP, card.x + card.width + GAP])];
  const ys = [maxY, GAP, ...obstacles.flatMap(card => [card.y - height - GAP, card.y + card.height + GAP])];
  for (const y of ys) for (const x of xs) {
    if (x < GAP || x > maxX || y < GAP || y > maxY) continue;
    const frame = { x, y, width, height };
    if (!obstacles.some(card => overlaps(frame, card))) return frame;
  }
  return null;
}

/** Preserve the entire recording, including on small screens and after resizing. */
export function previewFrame(area: WindowArea, ratio: number, expanded: boolean, position: { x: number; y: number } | null, layout?: PreviewLayout): WindowFrame {
  // Leave the collapsed assistant composer clear in both preview modes.
  const bottomClearance = 56;
  const placementArea = { ...area, height: area.height - bottomClearance };
  const aspect = Number.isFinite(ratio) && ratio > 0 ? ratio : 16 / 9;
  const availableWidth = Math.max(1, area.width - GAP * 2);
  const availableHeight = Math.max(1, area.height - GAP * 2 - bottomClearance);
  // Fallback follows the desktop's eight-column grid (cards span two columns).
  const cardWidth = layout?.cardWidth || Math.max(1, (area.width - 108) / 4);
  let width = Math.min(expanded ? availableWidth : cardWidth * (layout?.scale ?? 1.5), availableWidth, availableHeight * aspect);
  let vacant: WindowFrame | null = null;
  if (!expanded && layout?.obstacles.length) {
    vacant = vacantFrame(placementArea, width, aspect, layout.obstacles);
    // Derive exact candidate sizes from the free horizontal/vertical gaps.
    if (!vacant) {
      const xs = [GAP, ...layout.obstacles.map(card => card.x + card.width + GAP)];
      const right = [area.width - GAP, ...layout.obstacles.map(card => card.x - GAP)];
      const ys = [GAP, ...layout.obstacles.map(card => card.y + card.height + GAP)];
      const bottom = [placementArea.height - GAP, ...layout.obstacles.map(card => card.y - GAP)];
      const sizes = [...xs.flatMap(x => right.map(edge => edge - x)), ...ys.flatMap(y => bottom.map(edge => (edge - y) * aspect))]
        .filter(size => size >= 1 && size < width).sort((a, b) => b - a);
      for (const size of sizes) {
        vacant = vacantFrame(placementArea, size, aspect, layout.obstacles);
        if (vacant) { width = size; break; }
      }
    }
  }
  const height = width / aspect;
  const maxX = Math.max(GAP, area.width - width - GAP);
  const maxY = Math.max(GAP, placementArea.height - height - GAP);
  return { width, height,
    x: expanded ? Math.max(GAP, (area.width - width) / 2) : Math.max(GAP, Math.min(maxX, position?.x ?? vacant?.x ?? maxX)),
    y: expanded ? Math.max(GAP, (area.height - bottomClearance - height) / 2) : Math.max(GAP, Math.min(maxY, position?.y ?? vacant?.y ?? maxY)),
  };
}
