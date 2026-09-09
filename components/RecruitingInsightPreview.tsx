"use client";

import { useEffect, useRef } from "react";
import { recruitingReportStyle } from "@/lib/recruiting-insight-report";

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
          error: "本地日历服务暂时不可用，请确认 Syntropic 正在运行后重试",
        }, "*");
      }
    };

    // Presentation meetings can be arranged from either window. Read the same
    // server-owned state to keep an already-open report in sync.
    const isPresentation = content.includes('data-recruiting-presentation') || content.includes('SYNTROPIC INSIGHTS · 星流科技');
    const syncMeeting = async () => {
      if (!isPresentation) return;
      try {
        const response = await fetch("/api/desktop/scenario", { cache: "no-store" });
        if (!response.ok) return;
        const result = await response.json();
        if (live && result.meeting) frame.current?.contentWindow?.postMessage({ type: "recruiting-calendar-state", meeting: { title: result.meeting.title } }, "*");
      } catch { /* The action itself retains its error feedback. */ }
    };
    const element = frame.current;
    element?.addEventListener("load", syncMeeting);
    void syncMeeting();
    const timer = isPresentation ? window.setInterval(() => void syncMeeting(), 3000) : undefined;
    window.addEventListener("message", receive);
    return () => {
      live = false;
      if (timer !== undefined) window.clearInterval(timer);
      element?.removeEventListener("load", syncMeeting);
      window.removeEventListener("message", receive);
    };
  }, [content]);

  return (
    <iframe
      ref={frame}
      srcDoc={presentRecruitingReport(bridgeLegacyInsight(content))}
      sandbox="allow-scripts"
      title="招聘洞察报告"
      style={{ width: "100%", height: "100%", border: "none", background: "var(--bg)" }}
    />
  );
}

function presentRecruitingReport(content: string): string {
  if (!content.includes("data-recruiting-presentation") && !content.includes("SYNTROPIC INSIGHTS · 星流科技")) return content;
  // Legacy saved reports keep their evidence and gain the same readable style.
  const additions = `<style>${recruitingReportStyle}</style><script>
window.addEventListener('message',function(event){
  if(event.source!==window.parent||event.data?.type!=='recruiting-calendar-state')return;
  var title=event.data.meeting?.title;
  if(typeof title!=='string')return;
  var button=document.getElementById('schedule'),result=document.getElementById('result');
  if(button){button.disabled=true;button.textContent='会议已安排';}
  if(result)result.textContent='已加入团队日程 · '+title;
});
</script>`;
  return /<\/body>/i.test(content) ? content.replace(/<\/body>/i, `${additions}</body>`) : content + additions;
}
