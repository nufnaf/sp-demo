"use client";

/* eslint-disable @next/next/no-img-element -- raw screenshots need natural pixel dimensions for coordinate mapping */

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ClipboardEvent,
  type CompositionEvent,
  type FormEvent,
  type KeyboardEvent,
  type PointerEvent,
  type WheelEvent,
} from "react";
import type { BrowserPageState, BrowserSystemEvent } from "@/lib/browser/types";

interface BrowserAppProps {
  cwd: string;
  initialPageId?: string | null;
}

const BROWSER_CONTENT_SCALE = 0.8;

type BrowserGlyphName = "back" | "forward" | "reload" | "globe" | "plus" | "close" | "compass";

function BrowserGlyph({ name, size = 15 }: { name: BrowserGlyphName; size?: number }) {
  const paths: Record<BrowserGlyphName, React.ReactNode> = {
    back: <path d="m14.5 4.5-7.5 7.5 7.5 7.5"/>,
    forward: <path d="m9.5 4.5 7.5 7.5-7.5 7.5"/>,
    reload: <><path d="M19 7v5h-5"/><path d="M18.1 17.2A8 8 0 1 1 19 9"/></>,
    globe: <><circle cx="12" cy="12" r="8.5"/><path d="M3.8 12h16.4M12 3.5c2.3 2.3 3.5 5.2 3.5 8.5S14.3 18.2 12 20.5C9.7 18.2 8.5 15.3 8.5 12S9.7 5.8 12 3.5Z"/></>,
    plus: <path d="M12 5v14M5 12h14"/>,
    close: <path d="m7 7 10 10M17 7 7 17"/>,
    compass: <><circle cx="12" cy="12" r="8.5"/><path d="m15.7 8.3-2.2 5.2-5.2 2.2 2.2-5.2 5.2-2.2Z"/><circle cx="12" cy="12" r="1" fill="currentColor" stroke="none"/></>,
  };
  return <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{paths[name]}</svg>;
}

async function responseJson<T>(response: Response): Promise<T> {
  const body = await response.json() as T & { error?: string };
  if (!response.ok) throw new Error(body.error ?? "浏览器请求失败");
  return body;
}

function displayTitle(page: BrowserPageState): string {
  if (page.loading && (!page.title || page.url === "about:blank")) return "正在载入…";
  return page.title || (page.url === "about:blank" ? "新标签页" : page.url);
}

export function BrowserApp({ cwd, initialPageId }: BrowserAppProps) {
  const [pages, setPages] = useState<BrowserPageState[]>([]);
  const [activePageId, setActivePageId] = useState<string | null>(initialPageId ?? null);
  const [address, setAddress] = useState("");
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [interactionPoint, setInteractionPoint] = useState<{ x: number; y: number; id: number } | null>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const keyboardSinkRef = useRef<HTMLTextAreaElement>(null);
  const composingRef = useRef(false);
  const inputTailRef = useRef<Promise<void>>(Promise.resolve());
  const resizeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const interactionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const activePage = useMemo(
    () => pages.find((page) => page.pageId === activePageId) ?? pages[0] ?? null,
    [activePageId, pages],
  );
  const selectedPageId = activePage?.pageId ?? null;
  const selectedPageUrl = activePage?.url ?? null;
  const pageCaret = activePage?.focus?.caret;

  const mergePage = useCallback((page: BrowserPageState) => {
    if (page.cwd !== cwd) return;
    setPages((current) => current.some((item) => item.pageId === page.pageId)
      ? current.map((item) => item.pageId === page.pageId ? page : item)
      : [...current, page]);
    setActivePageId((current) => current ?? page.pageId);
  }, [cwd]);

  const sendPageCommand = useCallback(async (
    pageId: string,
    body: Record<string, unknown>,
    options: { quiet?: boolean } = {},
  ) => {
    if (!options.quiet) {
      setBusy(true);
      setError(null);
    }
    try {
      const response = await fetch(`/api/browser/pages/${encodeURIComponent(pageId)}/command`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const result = await responseJson<{ page?: BrowserPageState; success?: boolean }>(response);
      if (result.page) mergePage(result.page);
      return result;
    } catch (commandError) {
      setError(commandError instanceof Error ? commandError.message : String(commandError));
      return null;
    } finally {
      if (!options.quiet) setBusy(false);
    }
  }, [mergePage]);

  const command = useCallback((body: Record<string, unknown>, options?: { quiet?: boolean }) => {
    if (!activePage) return Promise.resolve(null);
    return sendPageCommand(activePage.pageId, body, options);
  }, [activePage, sendPageCommand]);

  const openPage = useCallback(async (url?: string) => {
    setBusy(true);
    setError(null);
    try {
      const body = await responseJson<{ page: BrowserPageState }>(await fetch("/api/browser/pages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cwd, ...(url ? { url } : {}), foreground: false }),
      }));
      mergePage(body.page);
      setActivePageId(body.page.pageId);
    } catch (openError) {
      setError(openError instanceof Error ? openError.message : String(openError));
    } finally {
      setBusy(false);
    }
  }, [cwd, mergePage]);

  useEffect(() => {
    let cancelled = false;
    setBusy(true);
    void fetch(`/api/browser/state?cwd=${encodeURIComponent(cwd)}`, { cache: "no-store" })
      .then((response) => responseJson<{ pages: BrowserPageState[] }>(response))
      .then((body) => {
        if (cancelled) return;
        setPages(body.pages);
        const preferred = body.pages.find((page) => page.pageId === initialPageId)?.pageId ?? body.pages[0]?.pageId;
        if (preferred) setActivePageId(preferred);
        else void openPage();
      })
      .catch((loadError) => { if (!cancelled) setError(loadError instanceof Error ? loadError.message : String(loadError)); })
      .finally(() => { if (!cancelled) setBusy(false); });
    return () => { cancelled = true; };
  }, [cwd, initialPageId, openPage]);

  useEffect(() => {
    const stream = new EventSource("/api/browser/events");
    stream.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data) as BrowserSystemEvent | { type: "browser.ready" };
        if (message.type === "browser.opened" || message.type === "browser.updated") mergePage(message.page);
        else if (message.type === "browser.closed") {
          setPages((current) => current.filter((page) => page.pageId !== message.pageId));
          setActivePageId((current) => current === message.pageId ? null : current);
        }
      } catch { /* ignore malformed extension events */ }
    };
    return () => stream.close();
  }, [mergePage]);

  useEffect(() => {
    if (selectedPageUrl !== null) setAddress(selectedPageUrl === "about:blank" ? "" : selectedPageUrl);
  }, [selectedPageId, selectedPageUrl]);

  useEffect(() => {
    const element = viewportRef.current;
    if (!element || !selectedPageId) return;
    let lastWidth = 0;
    let lastHeight = 0;
    const observer = new ResizeObserver(([entry]) => {
      if (!entry) return;
      const width = Math.round(entry.contentRect.width / BROWSER_CONTENT_SCALE);
      const height = Math.round(entry.contentRect.height / BROWSER_CONTENT_SCALE);
      if (width < 360 || height < 240 || (Math.abs(width - lastWidth) < 2 && Math.abs(height - lastHeight) < 2)) return;
      lastWidth = width;
      lastHeight = height;
      if (resizeTimerRef.current) clearTimeout(resizeTimerRef.current);
      resizeTimerRef.current = setTimeout(() => {
        void sendPageCommand(selectedPageId, { type: "resize", width, height }, { quiet: true });
      }, 90);
    });
    observer.observe(element);
    return () => {
      observer.disconnect();
      if (resizeTimerRef.current) clearTimeout(resizeTimerRef.current);
      if (interactionTimerRef.current) clearTimeout(interactionTimerRef.current);
    };
  }, [selectedPageId, sendPageCommand]);

  const navigate = (event: FormEvent) => {
    event.preventDefault();
    if (address.trim()) void command({ type: "navigate", url: address.trim() });
  };

  const handleAddressKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key !== "Enter") return;
    event.preventDefault();
    if (address.trim()) void command({ type: "navigate", url: address.trim() });
  };

  const queueInput = useCallback((body: Record<string, unknown>) => {
    if (!activePage) return;
    const pageId = activePage.pageId;
    inputTailRef.current = inputTailRef.current
      .then(() => sendPageCommand(pageId, body, { quiet: true }))
      .then(() => undefined, () => undefined);
  }, [activePage, sendPageCommand]);

  const closePage = async (pageId: string, event: React.MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    const closingIndex = pages.findIndex((page) => page.pageId === pageId);
    const remaining = pages.filter((page) => page.pageId !== pageId);
    setPages(remaining);
    if (activePageId === pageId) setActivePageId(remaining[Math.min(closingIndex, remaining.length - 1)]?.pageId ?? null);
    const result = await sendPageCommand(pageId, { type: "close" }, { quiet: true });
    if (result && remaining.length === 0) void openPage();
  };

  const handleViewportPointerDown = (event: PointerEvent<HTMLImageElement>) => {
    if (!activePage) return;
    if (event.button !== 0) return;
    event.preventDefault();
    const image = imageRef.current;
    if (!image) return;
    const rect = image.getBoundingClientRect();
    const naturalWidth = image.naturalWidth || activePage.viewport.width;
    const naturalHeight = image.naturalHeight || activePage.viewport.height;
    const scale = Math.min(rect.width / naturalWidth, rect.height / naturalHeight);
    const renderedWidth = naturalWidth * scale;
    const renderedHeight = naturalHeight * scale;
    const renderedLeft = rect.left + (rect.width - renderedWidth) / 2;
    const renderedTop = rect.top + (rect.height - renderedHeight) / 2;
    const x = (event.clientX - renderedLeft) / scale;
    const y = (event.clientY - renderedTop) / scale;
    if (x < 0 || y < 0 || x > naturalWidth || y > naturalHeight) return;
    const keyboardSink = keyboardSinkRef.current;
    if (keyboardSink) {
      keyboardSink.style.left = `${event.clientX - rect.left}px`;
      keyboardSink.style.top = `${event.clientY - rect.top}px`;
      keyboardSink.focus({ preventScroll: true });
    }
    setInteractionPoint({ x: event.clientX - rect.left, y: event.clientY - rect.top, id: Date.now() });
    if (interactionTimerRef.current) clearTimeout(interactionTimerRef.current);
    interactionTimerRef.current = setTimeout(() => setInteractionPoint(null), 240);
    queueInput({ type: "input", action: "coordinate_click", x, y });
  };

  const handleViewportKey = (event: KeyboardEvent<HTMLElement>) => {
    if (!activePage) return;
    event.stopPropagation();
    if (event.nativeEvent.isComposing || composingRef.current || event.key === "Process" || event.key === "Dead") return;
    const supported = ["Tab", "Enter", "Escape", "Backspace", "Delete", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "PageUp", "PageDown", "Home", "End"];
    const modifier = event.metaKey ? "Meta" : event.ctrlKey ? "Control" : event.altKey ? "Alt" : null;
    if (supported.includes(event.key) || (modifier && event.key.length === 1)) {
      event.preventDefault();
      const key = modifier ? `${modifier}+${event.shiftKey ? "Shift+" : ""}${event.key.toUpperCase()}` : event.key;
      queueInput({ type: "input", action: "press", key });
    } else if (event.key.length === 1) {
      event.preventDefault();
      insertText(event.key);
    }
  };

  const insertText = (text: string) => {
    if (text) queueInput({ type: "input", action: "insert_text", text });
  };

  const handleCompositionEnd = (event: CompositionEvent<HTMLTextAreaElement>) => {
    composingRef.current = false;
    event.currentTarget.value = "";
    insertText(event.data);
  };

  const handlePaste = (event: ClipboardEvent<HTMLTextAreaElement>) => {
    event.preventDefault();
    insertText(event.clipboardData.getData("text/plain"));
  };

  const handleViewportWheel = (event: WheelEvent<HTMLDivElement>) => {
    if (!activePage) return;
    event.preventDefault();
    queueInput({
      type: "input",
      action: "scroll",
      deltaX: event.deltaX / BROWSER_CONTENT_SCALE,
      deltaY: event.deltaY / BROWSER_CONTENT_SCALE,
    });
  };

  const isNewTab = activePage?.url === "about:blank";

  return <section className="agent-browser-app">
    <nav className="agent-browser-tabs" aria-label="浏览器标签页">
      <div className="agent-browser-tab-list" role="tablist">
        {pages.map((page) => <div className={`agent-browser-tab${page.pageId === activePage?.pageId ? " is-active" : ""}`} key={page.pageId}>
          <button type="button" role="tab" aria-selected={page.pageId === activePage?.pageId} onClick={() => setActivePageId(page.pageId)}>
            <span className="agent-browser-favicon"><BrowserGlyph name={page.url === "about:blank" ? "plus" : "globe"} size={12}/></span>
            <span>{displayTitle(page)}</span>
          </button>
          <button type="button" className="agent-browser-tab-close" aria-label={`关闭 ${displayTitle(page)}`} onClick={(event) => void closePage(page.pageId, event)}><BrowserGlyph name="close" size={11}/></button>
        </div>)}
      </div>
      <button type="button" className="agent-browser-new-tab" aria-label="新建标签页" onClick={() => void openPage()}><BrowserGlyph name="plus" size={15}/></button>
    </nav>

    <header className="agent-browser-toolbar">
      <div className="agent-browser-navigation">
        <button type="button" aria-label="后退" disabled={!activePage || busy} onClick={() => void command({ type: "navigate", action: "back" })}><BrowserGlyph name="back"/></button>
        <button type="button" aria-label="前进" disabled={!activePage || busy} onClick={() => void command({ type: "navigate", action: "forward" })}><BrowserGlyph name="forward"/></button>
        <button type="button" className={activePage?.loading ? "is-loading" : ""} aria-label="重新载入" disabled={!activePage || busy} onClick={() => void command({ type: "navigate", action: "reload" })}><BrowserGlyph name="reload"/></button>
      </div>
      <form className="agent-browser-address" onSubmit={navigate}>
        <BrowserGlyph name="globe" size={13}/>
        <input value={address} onChange={(event) => setAddress(event.target.value)} onKeyDown={handleAddressKeyDown} onFocus={(event) => event.currentTarget.select()} aria-label="网址或搜索" placeholder="搜索或输入网址" autoCapitalize="off" autoCorrect="off" spellCheck={false}/>
        {activePage?.loading ? <span className="agent-browser-address-spinner" aria-label="正在载入"/> : null}
      </form>
    </header>

    <div ref={viewportRef} className="agent-browser-viewport" tabIndex={activePage ? 0 : -1} aria-busy={activePage?.loading} onKeyDown={handleViewportKey} onWheel={handleViewportWheel}>
      {activePage && !isNewTab ? <img
        ref={imageRef}
        src={`/api/browser/pages/${encodeURIComponent(activePage.pageId)}/screenshot?revision=${activePage.revision}`}
        alt={activePage.title || activePage.url}
        draggable={false}
        onPointerDown={handleViewportPointerDown}
      /> : activePage ? <div className="agent-browser-start">
        <div className="agent-browser-start-mark"><BrowserGlyph name="compass" size={24}/></div>
        <h2>从这里开始浏览</h2>
        <p>你和 AI 可以在同一个页面中一起查找、阅读和操作。</p>
      </div> : <div className="agent-browser-state"><span className="agent-os-spinner"/>{busy ? "正在启动浏览器…" : "没有打开的页面"}</div>}
      {activePage?.loading ? <div className="agent-browser-progress"><i/></div> : null}
      {interactionPoint ? <i
        key={interactionPoint.id}
        className="agent-browser-pointer-feedback"
        style={{ left: interactionPoint.x, top: interactionPoint.y }}
        aria-hidden="true"
      /> : null}
      {pageCaret && activePage ? <i
        className="agent-browser-page-caret"
        style={{
          left: `${pageCaret.x / activePage.viewport.width * 100}%`,
          top: `${pageCaret.y / activePage.viewport.height * 100}%`,
          height: `${Math.max(11, pageCaret.height * BROWSER_CONTENT_SCALE)}px`,
        }}
        aria-hidden="true"
      /> : null}
      {activePage && !isNewTab ? <textarea
        ref={keyboardSinkRef}
        className="agent-browser-keyboard-sink"
        aria-label="网页键盘输入"
        tabIndex={-1}
        autoCapitalize="off"
        autoCorrect="off"
        spellCheck={false}
        onKeyDown={handleViewportKey}
        onPaste={handlePaste}
        onCompositionStart={() => { composingRef.current = true; }}
        onCompositionEnd={handleCompositionEnd}
      /> : null}
    </div>
    {error ? <div className="agent-browser-error" role="alert"><span>{error}</span><button type="button" aria-label="关闭错误" onClick={() => setError(null)}><BrowserGlyph name="close" size={11}/></button></div> : null}
  </section>;
}
