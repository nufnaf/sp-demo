"use client";

import { useEffect, useEffectEvent, useMemo, useRef } from "react";
import { recruitingJdPreviewDocument } from "@/lib/recruiting-jd-preview";

export interface JdPreviewPlayback {
  animate: boolean;
  active: boolean;
  onComplete: () => void;
}

export function RecruitingJdPreview({ content, animate, active, onComplete }: JdPreviewPlayback & { content: string }) {
  const frame = useRef<HTMLIFrameElement>(null);
  const started = useRef(false);
  const loaded = useRef(false);
  const complete = useEffectEvent(onComplete);
  const document = useMemo(() => recruitingJdPreviewDocument(content), [content]);

  useEffect(() => {
    const receive = (event: MessageEvent) => {
      if (event.source !== frame.current?.contentWindow || event.origin !== "null") return;
      if (event.data?.type === "jd-preview-complete") complete();
    };
    window.addEventListener("message", receive);
    return () => {
      window.removeEventListener("message", receive);
      // Closing or switching to source consumes this viewing; reopening is instant.
      if (started.current) complete();
    };
  }, [content]);

  const sendState = () => {
    loaded.current = true;
    if (active) started.current = true;
    frame.current?.contentWindow?.postMessage({ type: "jd-preview-state", animate, active }, "*");
  };
  useEffect(() => {
    if (loaded.current && active) started.current = true;
    frame.current?.contentWindow?.postMessage({ type: "jd-preview-state", animate, active }, "*");
  }, [animate, active, content]);

  return <iframe ref={frame} srcDoc={document} sandbox="allow-scripts" title="岗位 JD" onLoad={sendState}
    style={{ width: "100%", height: "100%", border: "none", background: "var(--bg)" }} />;
}
