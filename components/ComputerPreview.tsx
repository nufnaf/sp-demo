"use client";

import { useContext, useEffect, useRef, useState, type CSSProperties, type PointerEvent } from "react";
import { ArrowUpRight, Ellipsis, Maximize2, Minimize2, Pause, Play, X } from "lucide-react";
import { subscribeDesktopEvents } from "@/lib/desktop-events-client";
import { DesktopSpacesContext } from "./DesktopSpaces";
import { previewFrame } from "@/lib/computer/preview-geometry";
import type { ComputerFrame, ComputerState } from "@/lib/computer/types";
import "./ComputerPreview.css";

const WINDOW_ID = "computer";

export function ComputerPreview({ state, desktopHidden, onFocus, onClose }: {
  state: ComputerState; desktopHidden: boolean; onFocus: () => void; onClose: () => void;
}) {
  const spaces = useContext(DesktopSpacesContext);
  const spaceOffset = spaces?.offset(WINDOW_ID) ?? 0;
  const surface = useRef<HTMLElement>(null);
  const image = useRef<HTMLImageElement>(null);
  const more = useRef<HTMLButtonElement>(null);
  const drag = useRef<{ id: number; x: number; y: number; left: number; top: number; moved: boolean } | null>(null);
  const [area, setArea] = useState({ width: 0, height: 0 });
  const [ratio, setRatio] = useState(16 / 9);
  const [position, setPosition] = useState<{ x: number; y: number } | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [connected, setConnected] = useState(false);
  const [recovering, setRecovering] = useState<string | null>(null);
  const recoveryTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const targetWindow = useRef(state.target?.windowId);
  targetWindow.current = state.target?.windowId;
  const [generation, setGeneration] = useState(0);
  const [busy, setBusy] = useState(false);
  const [opening, setOpening] = useState(false);
  const [controlError, setControlError] = useState<string | null>(null);
  const frame = previewFrame(area, ratio, expanded, position);

  useEffect(() => {
    const layer = surface.current?.parentElement;
    if (!layer) return;
    const observer = new ResizeObserver(() => setArea({ width: layer.clientWidth, height: layer.clientHeight }));
    observer.observe(layer);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!state.available) return;
    setError(null);
    let lastFrame = Date.now();
    const clear = (message: string) => { image.current?.removeAttribute("src"); setConnected(false); setRecovering(null); setError(message); };
    const recover = (message: string) => {
      setRecovering(message);
      recoveryTimer.current ??= setTimeout(() => { recoveryTimer.current = undefined; clear(message); }, 1500);
    };
    const release = subscribeDesktopEvents("computer-frame", { message: raw => {
      let frame: ComputerFrame;
      try { frame = JSON.parse((raw as MessageEvent).data); } catch { clear("画面暂时无法读取，正在重新连接…"); return; }
      if (frame.error) { recover(frame.error); return; }
      if (frame.windowId && targetWindow.current && frame.windowId !== targetWindow.current) return;
      lastFrame = Date.now();
      if (frame.dataUrl?.startsWith("data:image/jpeg;base64,") && image.current) { clearTimeout(recoveryTimer.current); recoveryTimer.current = undefined; image.current.src = frame.dataUrl; setError(null); setRecovering(null); }
    }, error: () => recover("画面连接已中断，正在重新连接…") });
    const timer = setInterval(() => { if (Date.now() - lastFrame > 5000) clear("正在等待飞书画面，请检查窗口是否展开。"); }, 1500);
    return () => { clearInterval(timer); clearTimeout(recoveryTimer.current); recoveryTimer.current = undefined; release(); };
  }, [state.available, generation]);
  useEffect(() => {
    if (!image.current?.getAttribute("src")) return;
    setRecovering("正在切换飞书窗口…");
    const timer = setTimeout(() => { image.current?.removeAttribute("src"); setConnected(false); setRecovering(null); setError("正在等待飞书的新画面，请检查窗口状态。"); }, 5000);
    // The next valid frame clears this wait through its load event.
    const loaded = () => { clearTimeout(timer); setRecovering(null); };
    const current = image.current; current.addEventListener("load", loaded, { once: true });
    return () => { clearTimeout(timer); current.removeEventListener("load", loaded); };
  }, [state.target?.windowId]);

  useEffect(() => {
    if (!menuOpen) return;
    const close = (event: globalThis.PointerEvent) => {
      if (!surface.current?.contains(event.target as Node)) setMenuOpen(false);
    };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, [menuOpen]);

  const control = async (action: "pause" | "resume" | "stop") => {
    setBusy(true); setControlError(null); setMenuOpen(false);
    try {
      const response = await fetch("/api/computer", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action }) });
      if (!response.ok) throw new Error();
    } catch { setControlError("操作未能送达，请重试。"); } finally { setBusy(false); }
  };
  const reconnect = async () => {
    setError(null); setRecovering("正在重新连接飞书画面…");
    try {
      const response = await fetch("/api/computer", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "reconnect" }) });
      if (!response.ok) throw new Error();
      setGeneration(value => value + 1);
    } catch { setRecovering(null); setError("重新连接未能送达，请重试。"); }
  };
  const openApp = async () => {
    setOpening(true); setControlError(null);
    try {
      const response = await fetch("/api/computer/open", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
      if (!response.ok) throw new Error();
    } catch { setControlError("暂时无法打开飞书，请检查客户端是否已安装。"); } finally { setOpening(false); }
  };

  const startDrag = (event: PointerEvent<HTMLElement>) => {
    onFocus();
    if (!event.isPrimary || event.button !== 0 || expanded || (event.target as HTMLElement).closest("button, select, input, .computer-options")) return;
    event.preventDefault();
    drag.current = { id: event.pointerId, x: event.clientX, y: event.clientY, left: frame.x, top: frame.y, moved: false };
    event.currentTarget.setPointerCapture(event.pointerId);
  };
  const moveDrag = (event: PointerEvent<HTMLElement>) => {
    const current = drag.current;
    if (!current || current.id !== event.pointerId) return;
    if (!current.moved && Math.hypot(event.clientX - current.x, event.clientY - current.y) < 5) return;
    current.moved = true;
    setDragging(true); setMenuOpen(false);
    const fitted = previewFrame(area, ratio, false, { x: current.left + event.clientX - current.x, y: current.top + event.clientY - current.y });
    setPosition({ x: fitted.x, y: fitted.y });
    spaces?.drag(WINDOW_ID, event.clientX, event.clientY);
  };
  const finishDrag = (event: PointerEvent<HTMLElement>, cancelled = false) => {
    const current = drag.current;
    if (!current || current.id !== event.pointerId) return;
    drag.current = null; setDragging(false);
    if (cancelled) spaces?.cancelDrag();
    else if (current.moved && spaces?.drag(WINDOW_ID, event.clientX, event.clientY, true)) setPosition(null);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  };

  const active = ["running", "pausing", "paused"].includes(state.phase);
  const statusTitle = ({ paused: "已暂停", pausing: "正在暂停", verifying: "正在核对日历", completed: "会议已安排", failed: "需要你处理", stopped: "任务已停止" } as Partial<Record<ComputerState["phase"], string>>)[state.phase];
  const notice = controlError || (connected && statusTitle ? state.detail : null);
  const hidden = desktopHidden || spaceOffset !== 0;

  return <article ref={surface} aria-label="飞书实时画面" aria-hidden={hidden || undefined} inert={hidden}
    data-window-id={WINDOW_ID} data-space-offset={spaceOffset}
    className={`computer-preview${expanded ? " is-expanded" : ""}${dragging ? " is-dragging" : ""}${desktopHidden ? " is-desktop-hidden" : ""}${spaceOffset ? " is-other-space" : ""}${menuOpen ? " is-menu-open" : ""}${notice ? " has-notice" : ""}`}
    style={{ left: frame.x, top: frame.y, width: frame.width, height: frame.height, "--space-offset": spaceOffset } as CSSProperties}
    onPointerDown={startDrag} onPointerMove={moveDrag} onPointerUp={event => finishDrag(event)}
    onPointerCancel={event => finishDrag(event, true)} onLostPointerCapture={event => finishDrag(event, true)}
    onKeyDown={event => {
      if (event.key !== "Escape") return;
      if (menuOpen) { event.stopPropagation(); setMenuOpen(false); more.current?.focus(); }
      else if (drag.current) { const id = drag.current.id; drag.current = null; setDragging(false); spaces?.cancelDrag(); if (surface.current?.hasPointerCapture(id)) surface.current.releasePointerCapture(id); }
      else if (expanded) { event.stopPropagation(); setExpanded(false); }
    }}>
    <div className="computer-canvas">
      {/* Native frames stay transient. Image decoding changes geometry only when the target's aspect ratio changes. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img ref={image} alt="飞书客户端实时画面" hidden={!connected} draggable={false}
        onLoad={event => { const img = event.currentTarget; if (img.naturalWidth && img.naturalHeight) setRatio(img.naturalWidth / img.naturalHeight); setConnected(true); }}
        onError={() => { setConnected(false); setError("画面暂时无法显示"); }}/>
      {connected && recovering && <div className="computer-recovering" role="status">{recovering}</div>}
      {!connected && <div className="computer-empty" role="status">
        <strong>飞书</strong><p>{!state.available ? "请在 macOS 版 Syntropic 中连接飞书" : error || recovering || "正在连接飞书画面…"}</p>
        {state.available && error && <button type="button" onClick={() => void reconnect()}>重新连接</button>}
      </div>}
    </div>
    <div className="computer-controls">
      <div className="computer-controls-top">
        <button type="button" aria-label="隐藏小窗" title="隐藏小窗，任务继续" onClick={onClose}><X size={15}/></button>
        <button ref={more} type="button" aria-label="小窗选项" title="小窗选项" aria-expanded={menuOpen} aria-controls="computer-preview-options" onClick={() => setMenuOpen(value => !value)}><Ellipsis size={16}/></button>
      </div>
      <div className="computer-controls-bottom">
        <span className="computer-caption">{connected && !recovering && (active || state.phase === "verifying") && <i/>}飞书{state.phase === "running" ? " · 正在安排会议" : ""}</span>
        {active && <button type="button" disabled={busy || state.phase === "pausing"} aria-label={state.phase === "paused" ? "继续任务" : "暂停任务"} title={state.phase === "paused" ? "继续任务" : "暂停任务"} onClick={() => void control(state.phase === "paused" ? "resume" : "pause")}>{state.phase === "paused" ? <Play size={14}/> : <Pause size={14}/>}</button>}
        <button type="button" aria-label={expanded ? "还原小窗" : "放大预览"} title={expanded ? "还原小窗" : "放大预览"} onClick={() => { setExpanded(value => !value); setMenuOpen(false); }}>{expanded ? <Minimize2 size={15}/> : <Maximize2 size={15}/>}</button>
        <button type="button" className="computer-open-app" aria-label="打开飞书客户端" disabled={opening || !state.available} onClick={() => void openApp()}><ArrowUpRight size={15}/><span>{opening ? "正在打开" : "打开飞书"}</span></button>
      </div>
    </div>
    {notice && <div className="computer-notice" role="status"><strong>{controlError ? "操作未完成" : statusTitle}</strong><p title={notice}>{notice}</p></div>}
    {menuOpen && <div id="computer-preview-options" className="computer-options" role="group" aria-label="小窗选项">
      {spaces && <label>移到桌面<select aria-label="将飞书小窗移到桌面" value={spaces.owner(WINDOW_ID)} onChange={event => { spaces.move(WINDOW_ID, event.target.value); setPosition(null); setMenuOpen(false); }}>
        {spaces.state.spaces.map(space => <option key={space.id} value={space.id}>{space.name}</option>)}
        {spaces.state.spaces.length < 6 && <option value="new">新桌面…</option>}
      </select></label>}
      {active && <button type="button" disabled={busy} onClick={() => void control("stop")}>停止任务</button>}
    </div>}
  </article>;
}
