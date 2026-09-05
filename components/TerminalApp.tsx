"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import { useTheme } from "@/hooks/useTheme";
import type { TerminalSessionEvent, TerminalSessionState } from "@/lib/terminal/types";
import "@xterm/xterm/css/xterm.css";
import "./TerminalApp.css";

interface TerminalAppProps {
  cwd: string;
}

type TerminalGlyphName = "plus" | "close" | "restart" | "terminal";

function TerminalGlyph({ name, size = 15 }: { name: TerminalGlyphName; size?: number }) {
  const paths: Record<TerminalGlyphName, React.ReactNode> = {
    plus: <path d="M12 5v14M5 12h14"/>,
    close: <path d="m7 7 10 10M17 7 7 17"/>,
    restart: <><path d="M19 7v5h-5"/><path d="M18.1 17.2A8 8 0 1 1 19 9"/></>,
    terminal: <><path d="m5 7 4.5 5L5 17"/><path d="M12 17h7"/></>,
  };
  return <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{paths[name]}</svg>;
}

async function responseJson<T>(response: Response): Promise<T> {
  const body = await response.json() as T & { error?: string };
  if (!response.ok) throw new Error(body.error ?? `终端请求失败（HTTP ${response.status}）`);
  return body;
}

function terminalEndpoint(terminalId: string): string {
  return `/api/terminal/sessions/${encodeURIComponent(terminalId)}`;
}

function TerminalSurface({
  terminal,
  active,
  onStateChange,
  onError,
}: {
  terminal: TerminalSessionState;
  active: boolean;
  onStateChange: (terminal: TerminalSessionState) => void;
  onError: (message: string) => void;
}) {
  const { isDark } = useTheme();
  const hostRef = useRef<HTMLDivElement>(null);
  const xtermRef = useRef<Terminal | null>(null);
  const fitRef = useRef<FitAddon | null>(null);
  const inputBufferRef = useRef("");
  const inputTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputTailRef = useRef<Promise<void>>(Promise.resolve());
  const resizeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSizeRef = useRef({ cols: terminal.cols, rows: terminal.rows });
  const onStateChangeRef = useRef(onStateChange);
  const onErrorRef = useRef(onError);
  onStateChangeRef.current = onStateChange;
  onErrorRef.current = onError;

  const sendCommand = useCallback((body: Record<string, unknown>) => fetch(terminalEndpoint(terminal.terminalId), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ cwd: terminal.cwd, ...body }),
  }).then((response) => responseJson<{ terminal: TerminalSessionState }>(response)), [terminal.cwd, terminal.terminalId]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const xterm = new Terminal({
      allowProposedApi: false,
      convertEol: false,
      cursorBlink: true,
      cursorStyle: "block",
      disableStdin: false,
      fontFamily: "var(--font-mono)",
      fontSize: 12,
      lineHeight: 1.22,
      scrollback: 5_000,
      theme: {
        background: isDark ? "#edf2f1" : "#f7faf9",
        foreground: "#2c383d",
        cursor: "#168b62",
        cursorAccent: "#f7faf9",
        selectionBackground: "#cfe5dc",
        selectionForeground: "#1f2c31",
        black: "#354248",
        red: "#bd554c",
        green: "#16845e",
        yellow: "#9b6b25",
        blue: "#356fa8",
        magenta: "#825b91",
        cyan: "#267b82",
        white: "#d6dfdc",
        brightBlack: "#7c898d",
        brightRed: "#d2675d",
        brightGreen: "#2b9c71",
        brightYellow: "#b48235",
        brightBlue: "#4e86bc",
        brightMagenta: "#9a70a6",
        brightCyan: "#3c9298",
        brightWhite: "#ffffff",
      },
    });
    const fit = new FitAddon();
    xterm.loadAddon(fit);
    xterm.open(host);
    xterm.attachCustomKeyEventHandler((event) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "c" && xterm.hasSelection()) return false;
      return true;
    });
    xtermRef.current = xterm;
    fitRef.current = fit;

    const flushInput = () => {
      inputTimerRef.current = null;
      const data = inputBufferRef.current;
      inputBufferRef.current = "";
      if (!data) return;
      inputTailRef.current = inputTailRef.current
        .then(() => sendCommand({ type: "input", data }))
        .then(({ terminal: next }) => onStateChangeRef.current(next))
        .catch((error) => onErrorRef.current(error instanceof Error ? error.message : String(error)));
    };
    const inputSubscription = xterm.onData((data) => {
      inputBufferRef.current += data;
      if (!inputTimerRef.current) inputTimerRef.current = setTimeout(flushInput, 16);
    });

    const events = new EventSource(`${terminalEndpoint(terminal.terminalId)}/events?cwd=${encodeURIComponent(terminal.cwd)}`);
    events.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data) as TerminalSessionEvent;
        if (message.type === "terminal.replay") {
          xterm.reset();
          if (message.truncated) xterm.write("\r\n\x1b[33m[较早的终端输出已截断]\x1b[0m\r\n");
          if (message.data) xterm.write(message.data);
        } else if (message.type === "terminal.output") {
          xterm.write(message.data);
        } else if (message.type === "terminal.updated") {
          xterm.options.disableStdin = message.terminal.status !== "running";
          onStateChangeRef.current(message.terminal);
          if (message.terminal.status === "exited") {
            xterm.write(`\r\n\x1b[90m[进程已退出，状态码 ${message.terminal.exitCode ?? "未知"}]\x1b[0m\r\n`);
          }
        }
      } catch { /* ignore malformed terminal events */ }
    };
    events.onerror = () => onErrorRef.current("终端连接已断开，正在尝试重连…");

    return () => {
      events.close();
      inputSubscription.dispose();
      if (inputTimerRef.current) clearTimeout(inputTimerRef.current);
      if (resizeTimerRef.current) clearTimeout(resizeTimerRef.current);
      xterm.dispose();
      xtermRef.current = null;
      fitRef.current = null;
    };
  }, [isDark, sendCommand, terminal.cwd, terminal.terminalId]);

  useEffect(() => {
    if (xtermRef.current) xtermRef.current.options.disableStdin = terminal.status !== "running";
  }, [terminal.status]);

  useEffect(() => {
    if (!active) return;
    const host = hostRef.current;
    const xterm = xtermRef.current;
    const fit = fitRef.current;
    if (!host || !xterm || !fit) return;
    const applySize = () => {
      try { fit.fit(); } catch { return; }
      const size = { cols: xterm.cols, rows: xterm.rows };
      if (size.cols === lastSizeRef.current.cols && size.rows === lastSizeRef.current.rows) return;
      lastSizeRef.current = size;
      if (resizeTimerRef.current) clearTimeout(resizeTimerRef.current);
      resizeTimerRef.current = setTimeout(() => {
        void sendCommand({ type: "resize", ...size })
          .then(({ terminal: next }) => onStateChangeRef.current(next))
          .catch((error) => onErrorRef.current(error instanceof Error ? error.message : String(error)));
      }, 80);
    };
    const observer = new ResizeObserver(applySize);
    observer.observe(host);
    requestAnimationFrame(() => {
      applySize();
      xterm.focus();
    });
    return () => observer.disconnect();
  }, [active, sendCommand]);

  return <div className={`agent-terminal-surface${active ? " is-active" : ""}`} ref={hostRef}/>;
}

export function TerminalApp({ cwd }: TerminalAppProps) {
  const [terminals, setTerminals] = useState<TerminalSessionState[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const activeTerminal = useMemo(
    () => terminals.find((terminal) => terminal.terminalId === activeId) ?? terminals[0] ?? null,
    [activeId, terminals],
  );

  const mergeTerminal = useCallback((terminal: TerminalSessionState) => {
    setTerminals((current) => current.some((item) => item.terminalId === terminal.terminalId)
      ? current.map((item) => item.terminalId === terminal.terminalId ? terminal : item)
      : [...current, terminal]);
    setError(null);
  }, []);

  const createTerminal = useCallback(async (reuse = false) => {
    setBusy(true);
    setError(null);
    try {
      const body = await responseJson<{ terminal: TerminalSessionState }>(await fetch("/api/terminal/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cwd, reuse }),
      }));
      mergeTerminal(body.terminal);
      setActiveId(body.terminal.terminalId);
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : String(createError));
    } finally {
      setBusy(false);
    }
  }, [cwd, mergeTerminal]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    void fetch(`/api/terminal/state?cwd=${encodeURIComponent(cwd)}`, { cache: "no-store" })
      .then((response) => responseJson<{ terminals: TerminalSessionState[] }>(response))
      .then(async (body) => {
        if (cancelled) return;
        if (body.terminals.length) {
          setTerminals(body.terminals);
          setActiveId(body.terminals[0].terminalId);
        } else {
          await createTerminal(true);
        }
      })
      .catch((loadError) => { if (!cancelled) setError(loadError instanceof Error ? loadError.message : String(loadError)); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [createTerminal, cwd]);

  const closeTerminal = async (terminal: TerminalSessionState) => {
    if (terminal.status === "running" && !window.confirm(`关闭“${terminal.title}”会终止其中正在运行的进程，确定继续吗？`)) return;
    setBusy(true);
    setError(null);
    try {
      await responseJson<{ success: true }>(await fetch(terminalEndpoint(terminal.terminalId), {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cwd }),
      }));
      const remaining = terminals.filter((item) => item.terminalId !== terminal.terminalId);
      setTerminals(remaining);
      if (activeId === terminal.terminalId) setActiveId(remaining.at(-1)?.terminalId ?? null);
    } catch (closeError) {
      setError(closeError instanceof Error ? closeError.message : String(closeError));
    } finally {
      setBusy(false);
    }
  };

  const restartTerminal = async () => {
    if (!activeTerminal) return;
    setBusy(true);
    setError(null);
    try {
      const body = await responseJson<{ terminal: TerminalSessionState }>(await fetch(terminalEndpoint(activeTerminal.terminalId), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cwd, type: "restart" }),
      }));
      mergeTerminal(body.terminal);
    } catch (restartError) {
      setError(restartError instanceof Error ? restartError.message : String(restartError));
    } finally {
      setBusy(false);
    }
  };

  return <section className="agent-terminal-app">
    <nav className="agent-terminal-tabs" aria-label="终端标签页">
      <div role="tablist">
        {terminals.map((terminal) => <div className={`agent-terminal-tab${terminal.terminalId === activeTerminal?.terminalId ? " is-active" : ""}`} key={terminal.terminalId}>
          <button type="button" role="tab" aria-selected={terminal.terminalId === activeTerminal?.terminalId} onClick={() => setActiveId(terminal.terminalId)}>
            <TerminalGlyph name="terminal" size={13}/><span>{terminal.title}</span>{terminal.status === "exited" ? <i title="已退出"/> : null}
          </button>
          <button type="button" className="agent-terminal-tab-close" aria-label={`关闭 ${terminal.title}`} onClick={() => void closeTerminal(terminal)}><TerminalGlyph name="close" size={11}/></button>
        </div>)}
      </div>
      <button type="button" className="agent-terminal-new" aria-label="新建终端" disabled={busy || terminals.length >= 8} onClick={() => void createTerminal()}><TerminalGlyph name="plus"/></button>
      <button type="button" className="agent-terminal-restart" aria-label="重新启动当前终端" disabled={busy || !activeTerminal} onClick={() => void restartTerminal()}><TerminalGlyph name="restart"/></button>
    </nav>
    <div className="agent-terminal-stage">
      {terminals.map((terminal) => <TerminalSurface key={terminal.terminalId} terminal={terminal} active={terminal.terminalId === activeTerminal?.terminalId} onStateChange={mergeTerminal} onError={setError}/>)}
      {loading ? <div className="agent-terminal-state"><span/>正在启动终端…</div> : null}
      {!loading && terminals.length === 0 ? <div className="agent-terminal-state"><TerminalGlyph name="terminal" size={28}/><strong>没有打开的终端</strong><button type="button" onClick={() => void createTerminal()}>新建终端</button></div> : null}
      {error ? <div className="agent-terminal-error" role="alert"><span>{error}</span><button type="button" aria-label="关闭错误" onClick={() => setError(null)}><TerminalGlyph name="close" size={11}/></button></div> : null}
    </div>
    <footer className="agent-terminal-status">
      <span>{activeTerminal?.cwd ?? cwd}</span>
      <span>{activeTerminal ? `${activeTerminal.shell} · ${activeTerminal.cols}×${activeTerminal.rows}` : "终端"}</span>
      <span className={activeTerminal?.status === "running" ? "is-running" : ""}>{activeTerminal?.status === "running" ? "运行中" : activeTerminal ? `已退出 (${activeTerminal.exitCode ?? "?"})` : ""}</span>
    </footer>
  </section>;
}
