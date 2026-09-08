"use client";

import { useEffect, useState } from "react";
import { AgentDesktop } from "./AgentDesktop";
import { BUILTIN_LAUNCHPAD_APPS } from "@/lib/launchpad-apps";

export function PresentationDesktop() {
  const [ready, setReady] = useState(false);
  const [error, setError] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    void fetch("/api/desktop/presentation", { cache: "no-store", signal: controller.signal })
      .then(async (response) => { if (!response.ok) throw new Error("Unavailable"); return response.json(); })
      .then((data: { runId?: string; cwd?: string }) => {
        if (controller.signal.aborted) return;
        if (data.runId && data.cwd && localStorage.getItem("syntropic:presentation-run") !== data.runId) {
          for (const key of Object.keys(localStorage)) {
            if (["pi-agent-os:pinned-dock-", "agent-os:hr-", "pi-web:desktop-"].some((prefix) => key.startsWith(prefix))) localStorage.removeItem(key);
          }
          const items = ["tasks", "library", "hr", "browser", "files", "store", "settings"].map((id) => ({ kind: "system", id: `system:${id}`, name: id }));
          localStorage.setItem("pi-agent-os:pinned-dock-items-v2", JSON.stringify([...items, ...BUILTIN_LAUNCHPAD_APPS]));
          localStorage.setItem(`pi-web:desktop-start:${data.cwd}`, "dismissed");
          localStorage.setItem(`pi-web:desktop-engaged:${data.cwd}`, "true");
          localStorage.setItem("syntropic:presentation-run", data.runId);
        }
        setReady(true);
      }).catch(() => { if (!controller.signal.aborted) setError(true); });
    return () => controller.abort();
  }, []);
  if (!ready) return <div role="status">{error ? "工作台暂时无法读取，请刷新重试。" : "正在打开工作台…"}</div>;
  return <AgentDesktop />;
}
