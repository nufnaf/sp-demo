/** A smooth, symmetric falloff over roughly two neighboring icons. */
export function dockMagnification(distance: number, radius = 120): number {
  if (!Number.isFinite(distance) || radius <= 0 || !Number.isFinite(radius)) return 0;
  const fraction = Math.min(Math.abs(distance) / radius, 1);
  return (Math.cos(fraction * Math.PI) + 1) / 2;
}
