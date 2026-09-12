"use client";

import Image from "next/image";
import { Check, LoaderCircle, Monitor, MousePointer2 } from "lucide-react";
import { SyntropicMark } from "./SyntropicMark";
import { DesktopNotification } from "./DesktopNotification";
import { useComputerPermissions } from "@/hooks/useComputerPermissions";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { notifyCalendarChanged } from "@/hooks/useFeishuCalendar";
import { CalendarPreparationProvider } from "@/hooks/useCalendarPreparation";
import { useDesktopReady } from "@/hooks/useDesktopReady";
import type { FeishuAuthFlow, FeishuCliStatus, FeishuLoginResult } from "@/lib/feishu-cli";
import "./FeishuStartup.css";

async function action(action: string, flowId?: string) {
  const response = await fetch("/api/apps/feishu", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, flowId }) });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "飞书连接失败，请重试。");
  return data;
}
/** Only official Feishu/Lark links may be handed to the system browser. */
function isBrowserUrl(value: string | undefined): value is string {
  try {
    const url = new URL(value ?? "");
    const official = ["feishu.cn", "larksuite.com"].some(host => url.hostname === host || url.hostname.endsWith(`.${host}`));
    return url.protocol === "https:" && !url.username && !url.password && official;
  } catch { return false; }
}
export function FeishuStartup({ children }: { children: ReactNode }) {
  const computer = useComputerPermissions();
  const [status, setStatus] = useState<FeishuCliStatus>();
  const [flow, setFlow] = useState<FeishuAuthFlow>();
  const [stage, setStage] = useState<"checking" | "connect" | "authorizing" | "preparing" | "ready" | "error">("checking");
  const [error, setError] = useState("");
  const [canReauthorize, setCanReauthorize] = useState(true);
  const [screen, setScreen] = useState<"loading" | "setup" | "desktop">("loading");
  const bootChecked = useRef(false);
  const mounted = useRef(true);
  const preparing = useRef(false);
  const attempt = useRef(0);
  const gestureRef = useRef(false);
  const openedRef = useRef<string | undefined>(undefined);
  // Stop pending setup-page readiness before bringing the splash back.
  useDesktopReady(screen === "setup" && stage !== "preparing" && !(stage === "ready" && computer.ready));
  useEffect(() => {
    if (!flow) return;
    const url = flow.verificationUrl;
    const started = gestureRef.current;
    gestureRef.current = false;
    if (!isBrowserUrl(url) || openedRef.current === url) return;
    openedRef.current = url;
    const open = () => { window.open(url, "_blank", "noopener");  };
    if (started) { open(); return; }
    // The page also opens the browser a moment later so an authorization step
    // the App starts on its own still continues without another click.
    const timer = setTimeout(() => { if (mounted.current) open(); }, 1200);
    return () => clearTimeout(timer);
  }, [flow]);
  const prepare = useCallback(async (saveCompletion = false) => {
    if (preparing.current) return;
    preparing.current = true;
    window.syntropicDesktop?.startupMark?.('calendar.prepare.start');
    setScreen("desktop");
    setStage("preparing"); setFlow(undefined); setError(""); setCanReauthorize(false);
    try {
      if (saveCompletion) await window.syntropicDesktop?.completeInitialization?.(true);
      const response = await fetch("/api/desktop/prepare", { method: "POST" });
      const data = await response.json();
      if (mounted.current) setCanReauthorize(data.requiresAuthorization === true);
      if (!response.ok || !data.ready) throw new Error(data.error || "资料准备尚未完成，请重试。");
      window.syntropicDesktop?.startupMark?.('calendar.prepare.end');
      if (mounted.current) { setStage("ready"); notifyCalendarChanged(); }
    } catch (e) {
      window.syntropicDesktop?.startupMark?.('calendar.prepare.error');
      if (mounted.current) { setError(e instanceof Error ? e.message : "资料准备失败"); setStage("error");  }
    }
    finally { preparing.current = false; }
  }, []);
  const check = useCallback(async () => {
    const response = await fetch("/api/apps/feishu", { cache: "no-store" });
    if (!response.ok) throw new Error("暂时无法检查飞书连接，请重试。");
    const data: FeishuCliStatus = await response.json();
    if (mounted.current) setStatus(data);
    if (data.configured && data.authState === "unknown") throw new Error(data.authDetail);
    return data;
  }, []);
  const begin = useCallback(async (next: "configure" | "login", fromUser = true) => {
    const current = ++attempt.current;
    gestureRef.current = fromUser;
    openedRef.current = undefined;
    setStage("authorizing"); setError(""); setFlow(undefined); setCanReauthorize(true);
    setScreen("setup");
    try {
      const data: FeishuAuthFlow = await action(next);
      if (!mounted.current || current !== attempt.current) return;
      setFlow(data);
      if (data.flowId) await action("complete_login", data.flowId);
    } catch (e) { if (mounted.current && current === attempt.current) { setError(e instanceof Error ? e.message : "无法开始连接"); setStage("error"); } }
  }, []);
  useEffect(() => {
    mounted.current = true;
    window.syntropicDesktop?.startupMark?.('feishu.check.start');
    void check().then(data => {
      window.syntropicDesktop?.startupMark?.('feishu.check.end');
      if (!mounted.current) return;
      if (data.authorization && data.authorization.result.state !== "succeeded") {
        setFlow(data.authorization.flow);
        if (data.authorization.result.state === "pending") setStage("authorizing");
        else { setError(data.authorization.result.message || "请重新授权。"); setStage("error"); }
      } else if (data.authState === "authenticated") setStage("ready"); else setStage("connect");
    }).catch(e => { window.syntropicDesktop?.startupMark?.('feishu.check.error'); if (mounted.current) { setError(e.message); setStage("error"); } });
    return () => { mounted.current = false; };
  }, [check]);
  // A durable completion record controls whether the checklist is shown.
  // Every launch still checks current authorization and native permissions.
  useEffect(() => {
    if (bootChecked.current || stage === "checking" || (!computer.permissions && !computer.error)) return;
    bootChecked.current = true;
    if (computer.permissions?.initializationComplete && computer.ready && stage === "ready") void prepare();
    else {
      void window.syntropicDesktop?.completeInitialization?.(false).catch(() => {});
      setScreen("setup");
    }
  }, [stage, computer.permissions, computer.error, computer.ready, prepare]);
  useEffect(() => {
    if (screen !== "setup" || stage !== "ready" || !computer.ready) return;
    void prepare(true);
  }, [screen, stage, computer.ready, prepare]);
  useEffect(() => {
    if (stage !== "authorizing" || !flow) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;
    const started = Date.now();
    const poll = async () => {
      if (Date.now() - started > 10 * 60_000) { setError("授权已超时，请重新连接。"); setStage("error"); void action("cancel"); return; }
      try {
        if (flow.kind === "login") {
          if (!flow.flowId) throw new Error("授权流程已失效，请重新连接。");
          const result: FeishuLoginResult = await action("login_status", flow.flowId);
          if (cancelled) return;
          if (result.state === "failed" || result.state === "expired") {
            setError(result.message || "授权未完成，请重试。"); setStage("error"); return;
          }
          if (result.state === "succeeded") {
            const data = await check();
            if (cancelled) return;
            if (data.authState !== "authenticated") { setError("授权已结束，但连接尚未验证，请重新检查。"); setStage("error"); return; }
            setFlow(undefined); setStage("ready"); return;
          }
        } else if (flow.kind === "configuration") {
          const data = await check();
          if (cancelled) return;
          if (data.configured) { void begin("login", false); return; }
        }
      } catch { /* Keep the authorization step visible through short network interruptions. */ }
      if (!cancelled) timer = setTimeout(poll, 2500);
    };
    timer = setTimeout(poll, 2500);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [flow, stage, check, begin, prepare]);
  if (screen === "desktop" && computer.ready) return <CalendarPreparationProvider value={{ pending: stage === "preparing", error: stage === "error" ? error : "" }}>
    {children}
    {(stage === "preparing" || stage === "error") && <DesktopNotification
      ariaLabel="团队日程同步"
      role={stage === "error" ? "alert" : "status"}
      label={stage === "preparing" ? "正在处理" : "需要处理"}
      title={stage === "preparing" ? "正在同步团队日程" : "团队日程同步未完成"}
      description={stage === "preparing" ? "同步完成后，日程会自动更新。" : error}
      action={stage === "error" ? { label: canReauthorize ? "重新授权" : "重新同步", onClick: () => canReauthorize ? void begin("login") : void prepare() } : undefined}
      onDismiss={() => {}}
      dismissLabel="关闭通知"
    />}
  </CalendarPreparationProvider>;
  // The native Electron splash remains visible while the workspace is being
  // prepared. Keep this renderer layer visually empty so there is no second
  // loading screen after the splash.
  if (screen === "loading") return <main className="feishu-startup startup-loading" aria-label="开屏加载" aria-hidden="true"/>;
  const busy = stage === "checking" || stage === "preparing" || (stage === "authorizing" && !flow);
  const completed = Number(stage === "ready") + Number(computer.permissions?.accessibility === true) + Number(computer.permissions?.screenRecording === true);
  const retryConnection = () => {
    if (status?.authState === "unknown" && status.configured) {
      void check().then(data => {
        setError("");
        if (data.authState === "authenticated") setStage("ready"); else setStage("connect");
      }).catch(e => setError(e.message));
    } else if (status?.authState === "authenticated") { setError(""); setStage("ready"); }
    else void begin(status?.configured ? "login" : "configure");
  };
  const resetConnection = async () => {
    setError(""); setStage("authorizing");
    try {
      await action("reset");
      const data = await check();
      if (mounted.current) { setStatus(data); setStage("connect"); }
    } catch (e) {
      if (mounted.current) { setError(e instanceof Error ? e.message : "无法清除旧连接，请重试。"); setStage("error"); }
    }
  };
  return <main className="feishu-startup"><section className="feishu-startup-card" aria-labelledby="feishu-startup-title">
    <div className="feishu-startup-brand"><SyntropicMark size={25}/><span>Syntropic</span></div>
    <h1 id="feishu-startup-title">演示前的一次性准备</h1>
    <p className="feishu-startup-intro">完成以下三项，即可开始。</p>
    <div className="feishu-startup-count" aria-live="polite">已完成 {completed} / 3</div>
    <ol className="feishu-startup-list" aria-label="启动准备">
      <li>
        <div className="feishu-startup-row">
          <span className="feishu-startup-icon"><Image src="/icons/feishu-logo.svg" alt="" width={25} height={25} unoptimized/></span>
          <div className="feishu-startup-label"><h2>连接飞书</h2><p>{stage === "ready" ? status?.account || "已连接" : stage === "preparing" ? "正在准备工作空间…" : "使用自己的飞书账号进行演示"}</p><p>飞书桌面客户端请登录同一账号。</p></div>
          {stage === "ready" ? <span className="feishu-startup-done"><Check size={15}/>已连接</span>
            : busy ? <span className="feishu-startup-progress" role="status"><LoaderCircle size={16}/>{stage === "preparing" ? "准备中" : "检查中"}</span>
            : (stage === "connect" || stage === "error") && <button disabled={status?.installed === false} onClick={retryConnection}>{status?.authState === "unknown" && status.configured ? "重新检查" : status?.authState === "authenticated" ? "重新准备" : "连接飞书"}</button>}
        </div>
        {stage !== "ready" && stage !== "preparing" && <ol className="feishu-startup-steps" aria-label="飞书连接步骤">
          <li>点击「连接飞书」，系统浏览器会打开飞书的连接页面。</li>
          <li>在网页里创建或选择连接应用，确认要开通的权限，再完成账号授权。</li>
          <li>回到这里确认已连接，继续完成下面的权限设置。</li>
        </ol>}
        {status?.installed === false && <p role="alert" className="feishu-startup-error">连接组件缺失，请重新安装完整 App。</p>}
        {flow && stage === "authorizing" && <div className="feishu-startup-auth">
          <div className="feishu-startup-auth-window" role="status"><Monitor size={26} strokeWidth={1.6}/><strong>请在浏览器中继续</strong></div>
          <p>{flow.kind === "configuration" ? "请在弹出的浏览器页面中创建或选择连接应用。" : flow.kind === "permission" ? "请在浏览器中确认应用的权限，再回到这里继续。" : "请在浏览器中确认权限并完成飞书账号授权。"}</p>
          <div className="feishu-startup-auth-actions"><a href={flow.verificationUrl} target="_blank" rel="noreferrer">没有打开？点这里 ↗</a><button className="feishu-startup-secondary" onClick={() => {
            attempt.current++; setFlow(undefined); setStage("checking");
            void action("cancel").then(() => { if (mounted.current) setStage("connect"); })
              .catch(() => { if (mounted.current) { setError("取消连接失败，请重试。"); setStage("error"); } });
          }}>取消连接</button>{flow.kind === "permission" && <button onClick={() => void begin("login")}>我已确认权限</button>}</div>
        </div>}
        {error && <div className="feishu-startup-error"><p role="alert">{error}</p>{stage === "error" && canReauthorize && status?.configured && <button className="feishu-startup-secondary" onClick={() => void begin("login")}>重新授权</button>}{stage === "error" && status?.configured && <button className="feishu-startup-secondary" onClick={() => void resetConnection()}>彻底重新连接</button>}</div>}
      </li>
      {([
        { key: "accessibility", label: "辅助功能权限", settings: "辅助功能", Icon: MousePointer2 },
        { key: "screenRecording", label: "屏幕录制权限", settings: "屏幕与系统音频录制", Icon: Monitor },
      ] as const).map(({ key, label, settings, Icon }) => {
        const granted = computer.permissions?.[key] === true;
        const needsCapture = false;
        return <li key={key}>
        <div className="feishu-startup-row">
          <span className="feishu-startup-icon"><Icon size={23} strokeWidth={1.7}/></span>
          <div className="feishu-startup-label"><h2>{label}</h2><p>{granted ? "已允许 Syntropic" : needsCapture ? "已开启权限，请继续验证屏幕访问" : "在 macOS 系统设置中授权"}</p></div>
          {granted ? <span className="feishu-startup-done"><Check size={15}/>已开启</span>
            : !computer.permissions && !computer.error ? <span className="feishu-startup-progress" role="status"><LoaderCircle size={16}/>检查中</span>
            : <button className="feishu-startup-secondary" aria-label={needsCapture ? "验证屏幕访问" : `打开${label}设置`} disabled={!computer.permissions?.supported || !!computer.pending} onClick={() => void computer.request(key)}>{computer.pending === key ? "请稍候…" : needsCapture ? "验证屏幕访问" : "打开系统设置"}</button>}
        </div>
        {!granted && <ol className="feishu-startup-steps" aria-label={`${label}操作步骤`}>
          <li>打开「系统设置」→「隐私与安全性」→「{settings}」{key === "screenRecording" ? "（部分版本叫「屏幕录制」）。" : "。"}</li>
          <li>开启 Syntropic 右侧的开关；若列表中没有，点「+」，从「应用程序」中添加 Syntropic。按系统提示验证密码或触控 ID。</li>
          <li>{key === "screenRecording" ? "若系统提示退出并重新打开，请按提示操作；否则返回这里等待检查。" : "返回这里等待检查；若仍显示未开启，按 ⌘Q 完全退出 Syntropic 后重新打开。"}</li>
        </ol>}
      </li>; })}
    </ol>
    {computer.permissions?.supported === false && <p className="feishu-startup-hint">浏览器预览不支持跳转系统设置，可按上述路径手动打开；桌面版可点击右侧按钮打开。</p>}
    {computer.error && <div className="feishu-startup-error"><p role="alert">{computer.error}</p><button className="feishu-startup-secondary" onClick={() => void computer.check()}>重新检查权限</button></div>}
    {computer.requested && !computer.ready && <p className="feishu-startup-hint" role="status">开启后返回此处；若仍未更新，请按 ⌘Q 退出后重新打开。</p>}
  </section></main>;
}
