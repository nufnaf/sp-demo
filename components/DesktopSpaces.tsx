"use client";
import { createContext, useCallback, useEffect, useRef, useState } from "react";
import { addSpace, initialSpaces, moveToSpace, removeSpace, restoreSpaces, spaceOf, focusSpaceWindow } from "@/lib/desktop-spaces";
import { useSpaceThumbnails } from "@/hooks/useSpaceThumbnails";
import "./DesktopSpaces.css";

export function useDesktopSpaces() {
  const [state, setState] = useState(initialSpaces);
  const [loaded, setLoaded] = useState(false);
  const [overview, setOverview] = useState(false);
  const [dragging, setDragging] = useState<string | null>(null);
  const latest = useRef(state);
  useEffect(() => { latest.current = state; }, [state]);
  useEffect(() => {
    try { setState(restoreSpaces(JSON.parse(localStorage.getItem("syntropic:spaces:v1") ?? "null"))); } catch { /* clean desktop */ }
    setLoaded(true);
  }, []);
  useEffect(() => { if (loaded) try { localStorage.setItem("syntropic:spaces:v1", JSON.stringify(state)); } catch { /* storage unavailable */ } }, [loaded, state]);
  const select = useCallback((id: string) => { setState(current => current.spaces.some(space => space.id === id) ? { ...current, active: id } : current); setOverview(false); }, []);
  const focus = useCallback((id: string, reveal = true) => {
    setState(current => focusSpaceWindow(current, id, reveal));
  }, []);
  const create = useCallback(() => { setState(current => addSpace(current, `desktop-${crypto.randomUUID()}`)); }, []);
  const move = useCallback((windowId: string, target: string) => {
    setState(current => {
      const id = target === "new" ? `desktop-${crypto.randomUUID()}` : target;
      const next = target === "new" ? addSpace(current, id) : current;
      return moveToSpace(next, windowId, id);
    });
    setOverview(false); setDragging(null);
  }, []);
  useEffect(() => {
    const key = (event: KeyboardEvent) => {
      if (event.key === "Escape") { setOverview(false); setDragging(null); return; }
      if (!event.ctrlKey || event.metaKey || event.altKey) return;
      if (event.key === "ArrowUp") { event.preventDefault(); setOverview(value => !value); }
      if (["ArrowLeft", "ArrowRight"].includes(event.key)) {
        event.preventDefault();
        const current = latest.current;
        const index = current.spaces.findIndex(space => space.id === current.active) + (event.key === "ArrowRight" ? 1 : -1);
        if (current.spaces[index]) select(current.spaces[index].id);
      }
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [select]);
  const drag = useCallback((id: string, x: number, y: number, finish = false) => {
    if (!finish) { setDragging(id); if (y < 170) setOverview(true); return; }
    const tile = document.elementsFromPoint(x, y).map(element => element.closest<HTMLElement>("[data-space-target]")).find(Boolean);
    if (tile?.dataset.spaceTarget) { move(id, tile.dataset.spaceTarget); return true; }
    else { setDragging(null); setOverview(false); }
  }, [move]);
  const cancelDrag = useCallback(() => { setDragging(null); }, []);
  return { state, overview, setOverview, dragging, select, focus, create, move, drag, cancelDrag,
    remove: (id: string) => setState(current => removeSpace(current, id)),
    owner: (id: string) => spaceOf(state, id),
    offset: (id: string) => state.spaces.findIndex(space => space.id === spaceOf(state, id)) - state.spaces.findIndex(space => space.id === state.active),
    front: state.fronts[state.active] ?? "tasks" };
}
export type SpacesController = ReturnType<typeof useDesktopSpaces>;
export const DesktopSpacesContext = createContext<SpacesController | null>(null);

export function DesktopSpaces({ controller: c }: { controller: SpacesController }) {
  const thumbnails = useSpaceThumbnails(c.state, c.overview);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const overviewRef = useRef<HTMLDivElement>(null);
  const { overview, dragging, setOverview } = c;
  useEffect(() => {
    if (!overview || dragging) return;
    const dismiss = (event: PointerEvent) => {
      const target = event.target;
      if (target instanceof Node && !overviewRef.current?.contains(target) && !triggerRef.current?.contains(target)) setOverview(false);
    };
    document.addEventListener("pointerdown", dismiss, true);
    return () => document.removeEventListener("pointerdown", dismiss, true);
  }, [overview, dragging, setOverview]);
  return <>
    <button ref={triggerRef} type="button" className={`agent-os-status-button spaces-trigger${c.overview ? " is-active" : ""}`} aria-label="桌面总览" aria-expanded={c.overview} onClick={() => c.setOverview(!c.overview)} title="桌面总览">
      <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="2" y="4" width="12" height="15" rx="2"/><path d="M18 5h2a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2h-2"/></svg>
      <span>{c.state.spaces.find(space => space.id === c.state.active)?.name}</span>
    </button>
    {c.overview && <div ref={overviewRef} className="spaces-overview" role="dialog" aria-label="桌面总览">
      <header><span>{c.dragging ? "拖放窗口到任一桌面" : "桌面"}</span><button onClick={() => c.setOverview(false)} aria-label="关闭桌面总览">×</button></header>
      <div className="spaces-strip">{c.state.spaces.map(space => <div className={`spaces-tile${space.id === c.state.active ? " is-active" : ""}`} key={space.id} data-space-target={space.id}>
        <button className="spaces-select" onClick={() => c.select(space.id)} aria-label={`切换到${space.name}`} aria-current={space.id === c.state.active ? "true" : undefined}>
          <span className="spaces-thumbnail" aria-hidden="true">{thumbnails[space.id] &&
            // Native, in-memory JPEG: no image optimization or network request.
            // eslint-disable-next-line @next/next/no-img-element
            <img src={thumbnails[space.id]} alt="" draggable={false}/>
          }</span><strong>{space.name}</strong>
        </button>
        {c.state.spaces.length > 1 && <button className="spaces-remove" aria-label={`关闭${space.name}`} title="将窗口移到相邻桌面" onClick={() => c.remove(space.id)}><svg aria-hidden="true" viewBox="0 0 16 16" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="m4 4 8 8M12 4l-8 8"/></svg></button>}
      </div>)}{c.state.spaces.length < 6 && <button className="spaces-add" data-space-target="new" aria-label="新建桌面" onClick={() => { c.create(); c.setOverview(false); }}><span aria-hidden="true">＋</span><strong>新建桌面</strong></button>}</div>
    </div>}
  </>;
}
