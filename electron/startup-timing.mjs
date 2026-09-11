const startedAt = performance.now();
const marks = new Map();
export function startupMark(name, details = {}) {
  const at = performance.now() - startedAt;
  marks.set(name, at);
  console.info(`[startup] ${name} +${Math.round(at)}ms`, details);
  return at;
}
export function startupSnapshot() { return Object.fromEntries(marks); }
