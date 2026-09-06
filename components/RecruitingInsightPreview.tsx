"use client";

import { useEffect, useRef } from "react";

const LEGACY_FETCH_BRIDGE = String.raw`<script>
(function(){
  var nativeFetch=window.fetch;
  window.fetch=function(input,init){
    if(input!=='/api/apps/company-careers/actions')return nativeFetch.call(window,input,init);
    return new Promise(function(resolve,reject){
      var requestId='calendar-legacy-'+Date.now()+'-'+Math.random().toString(36).slice(2);
      var timer=setTimeout(function(){cleanup();reject(new Error('本地日历响应超时，请重试'));},120000);
      function cleanup(){clearTimeout(timer);window.removeEventListener('message',receive);}
      function receive(event){var data=event.data;if(event.source!==window.parent||!data||data.type!=='recruiting-calendar-result'||data.requestId!==requestId)return;cleanup();resolve({ok:Boolean(data.ok),json:function(){return Promise.resolve(data);}});}
      window.addEventListener('message',receive);
      window.parent.postMessage({type:'recruiting-calendar',action:'schedule',requestId:requestId},'*');
    });
  };
})();
</script>`;

function bridgeLegacyInsight(content: string): string {
  if (!content.includes("/api/apps/company-careers/actions")) return content;
  return /<\/head>/i.test(content)
    ? content.replace(/<\/head>/i, `${LEGACY_FETCH_BRIDGE}</head>`)
    : `${LEGACY_FETCH_BRIDGE}${content}`;
}

/**
 * Sandboxed insight artifacts have an opaque origin and cannot call local APIs.
 * This bridge accepts one fixed action and keeps meeting details server-owned.
 */
export function RecruitingInsightPreview({ content }: { content: string }) {
  const frame = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    let live = true;
    const receive = async (event: MessageEvent) => {
      if (event.source !== frame.current?.contentWindow || event.origin !== "null") return;
      const data = event.data;
      if (data?.type !== "recruiting-calendar" || data.action !== "schedule" || typeof data.requestId !== "string") return;

      try {
        const response = await fetch("/api/apps/company-careers/actions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "schedule_alignment_meeting" }),
        });
        const result = await response.json();
        if (!live) return;
        frame.current?.contentWindow?.postMessage({
          type: "recruiting-calendar-result",
          requestId: data.requestId,
          ok: response.ok,
          ...result,
        }, "*");
      } catch {
        if (live) frame.current?.contentWindow?.postMessage({
          type: "recruiting-calendar-result",
          requestId: data.requestId,
          ok: false,
          error: "本地日历服务暂时不可用，请确认 Agent OS 正在运行后重试",
        }, "*");
      }
    };

    window.addEventListener("message", receive);
    return () => {
      live = false;
      window.removeEventListener("message", receive);
    };
  }, []);

  return (
    <iframe
      ref={frame}
      srcDoc={bridgeLegacyInsight(content)}
      sandbox="allow-scripts"
      title="招聘洞察报告"
      style={{ width: "100%", height: "100%", border: "none", background: "var(--bg)" }}
    />
  );
}
