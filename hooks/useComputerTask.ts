"use client";
import { useEffect, useState } from "react";
import { subscribeDesktopEvents } from "@/lib/desktop-events-client";
import type { ComputerState } from "@/lib/computer/types";
export function useComputerTask() {
  const [state, setState] = useState<ComputerState>({ available: false, phase: "idle", detail: "正在检查电脑连接", steps: 0 });
  useEffect(() => {
    let previous = "";
    return subscribeDesktopEvents("computer-status", { message: event => {
      const data = (event as MessageEvent).data as string;
      if (data === previous) return;
      try { const next = JSON.parse(data); previous = data; setState(next); } catch { /* next snapshot reconciles */ }
    } });
  }, []);
  return state;
}
