import type { FileSystemEvent } from "./types";

type FileEventListener = (event: FileSystemEvent) => void;

declare global {
  var __piFileEventListeners: Set<FileEventListener> | undefined;
}

function listeners(): Set<FileEventListener> {
  globalThis.__piFileEventListeners ??= new Set();
  return globalThis.__piFileEventListeners;
}

export function emitFileEvent(event: FileSystemEvent): void {
  for (const listener of listeners()) {
    try { listener(event); } catch { listeners().delete(listener); }
  }
}

export function subscribeToFileEvents(listener: FileEventListener): () => void {
  listeners().add(listener);
  return () => listeners().delete(listener);
}
