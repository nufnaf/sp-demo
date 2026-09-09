"use client";

import { useEffect, useId, useRef, useState, type RefObject } from "react";

import { recruitingQuickPrompts } from "@/lib/desktop-quick-prompts";
const generalPrompts = [
  "分析本周用户反馈，出一个总结报告。",
  "继续推进竞品定价分析",
  "总结今天所有任务的进展",
];

export function DesktopComposerInput({ inputRef, value, onChange, placeholder, recruiting, hasJd, busy, viewingRecruiting }: {
  inputRef: RefObject<HTMLInputElement | null>;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  recruiting: boolean;
  hasJd: boolean;
  busy: boolean;
  viewingRecruiting: boolean;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const suggestionsId = useId();
  const [publishedJob, setPublishedJob] = useState<string | null>(null);
  const [checkedPublication, setCheckedPublication] = useState(false);
  const requested = open && !value.trim();
  // Read the same saved jobs as the recruiting window. No fixed query answer
  // or local "published" flag; a refresh must reconstruct this from the site.
  useEffect(() => {
    if (!recruiting || !requested) return;
    let live = true;
    setCheckedPublication(false);
    void fetch("/api/apps/internal-recruiting", { cache: "no-store", signal: AbortSignal.timeout(5000) })
      .then(async response => {
        if (!response.ok) throw new Error("Recruiting unavailable");
        const data = await response.json() as { jobs?: Array<{ title: string }> };
        if (!live) return;
        setPublishedJob(data.jobs?.find(job => /AI\s*Agent.*工程师/i.test(job.title))?.title ?? null);
        setCheckedPublication(true);
      }).catch(() => { /* Keep suggestions hidden until the state is known. */ });
    return () => { live = false; };
  }, [recruiting, requested, viewingRecruiting, hasJd]);
  const prompts = recruiting ? recruitingQuickPrompts({ hasJd, busy, viewingRecruiting, publishedJob, checkedPublication }) : generalPrompts;
  const visible = requested && prompts.length > 0;
  useEffect(() => {
    if (!visible) return;
    const dismiss = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", dismiss);
    return () => document.removeEventListener("pointerdown", dismiss);
  }, [visible]);

  return <div className="agent-os-composer-input" ref={rootRef}
    onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false); }}
    onKeyDown={(event) => {
      if (event.key === "Escape" && visible) {
        event.preventDefault(); event.stopPropagation();
        inputRef.current?.focus(); setOpen(false);
      }
    }}>
    <input ref={inputRef} value={value} placeholder={placeholder} aria-label="和 Syntropic 对话"
      aria-controls={visible ? suggestionsId : undefined} autoComplete="off"
      onFocus={() => setOpen(!value.trim())} onClick={() => setOpen(!value.trim())}
      onChange={(event) => { onChange(event.target.value); setOpen(!event.target.value.trim()); }}
      onKeyDown={(event) => {
        if (event.key === "ArrowDown" && visible) {
          event.preventDefault(); rootRef.current?.querySelector("button")?.focus();
        }
      }}/>
    {visible && <div className="agent-os-prompt-suggestions" id={suggestionsId} role="region" aria-label="你可能想问">
      <header>你可能想问</header>
      {prompts.map((text) => <button key={text} type="button" onClick={() => {
        onChange(text); inputRef.current?.focus(); setOpen(false);
      }}>{text}</button>)}
    </div>}
  </div>;
}
