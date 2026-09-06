"use client";
import { useEffect, useRef } from "react";

/** A narrow bridge: sandboxed reports cannot fetch privileged APIs directly. */
export function CrmInsightPreview({ content, filePath }: { content: string; filePath: string }) {
  const frame = useRef<HTMLIFrameElement>(null);
  useEffect(() => {
    let live = true;
    const receive = async (event: MessageEvent) => {
      if (event.source !== frame.current?.contentWindow || event.origin !== "null") return;
      const data = event.data;
      if (data?.type !== "crm-meeting" || !["preview", "confirm"].includes(data.action) || typeof data.requestId !== "string") return;
      try {
        const response = await fetch("/api/crm/meeting", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ filePath, action: data.action, startsAt: data.startsAt, revision: data.revision }) });
        const result = await response.json();
        if (live) frame.current?.contentWindow?.postMessage({ type: "crm-meeting-result", requestId: data.requestId, ...result }, "*");
      } catch { if (live) frame.current?.contentWindow?.postMessage({ type: "crm-meeting-result", requestId: data.requestId, error: "本地日历服务暂时不可用，请重试" }, "*"); }
    };
    window.addEventListener("message", receive);
    return () => { live = false; window.removeEventListener("message", receive); };
  }, [filePath]);
  return <iframe ref={frame} srcDoc={content} sandbox="allow-scripts" title="CRM 洞察报告" style={{ width: "100%", height: "100%", border: "none", background: "var(--bg)" }} />;
}
