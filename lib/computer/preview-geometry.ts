import type { WindowArea, WindowFrame } from "../window-geometry";

/** Fit the complete recording without letterboxing or cropping its controls. */
export function previewFrame(area: WindowArea, ratio: number, expanded: boolean, position: { x: number; y: number } | null): WindowFrame {
  const margin = 16;
  // Keep an enlarged recording above the collapsed assistant composer.
  const bottomClearance = expanded ? 56 : 0;
  const aspect = Number.isFinite(ratio) && ratio > 0 ? ratio : 16 / 9;
  const availableWidth = Math.max(1, area.width - margin * 2);
  const availableHeight = Math.max(1, area.height - margin * 2 - bottomClearance);
  const width = Math.min(expanded ? availableWidth : 350, availableWidth, availableHeight * aspect);
  const height = width / aspect;
  const maxX = Math.max(margin, area.width - width - margin);
  const maxY = Math.max(margin, area.height - height - margin);
  return { width, height,
    x: expanded ? Math.max(margin, (area.width - width) / 2) : Math.max(margin, Math.min(maxX, position?.x ?? maxX)),
    y: expanded ? Math.max(margin, (area.height - bottomClearance - height) / 2) : Math.max(margin, Math.min(maxY, position?.y ?? maxY)),
  };
}
