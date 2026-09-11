"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { ComputerPermission, ComputerPermissions } from "@/lib/computer-permissions";

export function useComputerPermissions() {
  const [permissions, setPermissions] = useState<ComputerPermissions>();
  const [error, setError] = useState("");
  const [requested, setRequested] = useState<ComputerPermission>();
  const [pending, setPending] = useState<ComputerPermission>();
  const mounted = useRef(false);
  const reading = useRef(false);
  const requesting = useRef(false);
  const ready = permissions?.supported && permissions.accessibility && permissions.screenRecording && permissions.captureVerified;
  const check = useCallback(async () => {
    if (reading.current || requesting.current) return;
    reading.current = true;
    try {
      const result = await window.syntropicDesktop?.getComputerPermissions?.();
      if (mounted.current) {
        setPermissions(result ?? { supported: false, accessibility: false, screenRecording: false });
        setError("");
        window.syntropicDesktop?.startupMark?.('permissions.check.end');
      }
    } catch {
      if (mounted.current) { setPermissions(undefined); setError("暂时无法检查权限，请重新检查。"); window.syntropicDesktop?.startupMark?.('permissions.check.error'); }
    } finally { reading.current = false; }
  }, []);
  useEffect(() => {
    mounted.current = true;
    window.syntropicDesktop?.startupMark?.('permissions.check.start');
    void check();
    const onFocus = () => { void check(); };
    const timer = ready ? undefined : setInterval(() => { if (!document.hidden) void check(); }, 2500);
    window.addEventListener("focus", onFocus);
    return () => { mounted.current = false; clearInterval(timer); window.removeEventListener("focus", onFocus); };
  }, [check, ready]);
  const request = async (kind: ComputerPermission) => {
    if (requesting.current) return;
    requesting.current = true;
    setPending(kind); setRequested(kind); setError("");
    try {
      const result = await window.syntropicDesktop?.requestComputerPermission?.(kind);
      if (mounted.current) {
        if (result) setPermissions(result);
        else setError("请在桌面 App 中开启权限。");
      }
    } catch (e) { if (mounted.current) setError(e instanceof Error ? e.message.replace(/^Error invoking remote method '[^']+': (Error: )?/, "") : "权限准备失败，请重新尝试。"); }
    finally { requesting.current = false; if (mounted.current) setPending(undefined); }
  };
  return { permissions, ready, error, requested, pending, check, request };
}
