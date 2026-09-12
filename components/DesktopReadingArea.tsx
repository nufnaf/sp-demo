"use client";
import { useEffect, useRef, type ReactNode } from "react";

/** Keep the reading viewport above the floating composer, including draft expansion and window drags. */
export function DesktopReadingArea({ children, className = "" }: { children: ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const area = ref.current;
    const composer = area?.closest(".agent-os")?.querySelector(".agent-os-ai-surface");
    const desktopWindow = area?.closest(".agent-os-window");
    if (!area || !composer || !desktopWindow) return;
    let frame = 0;
    const measure = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const content = area.getBoundingClientRect(), overlay = composer.getBoundingClientRect();
        const overlaps = overlay.right > content.left && overlay.left < content.right && overlay.top < content.bottom && overlay.bottom > content.top;
        const inset = overlaps ? Math.min(content.height, Math.max(0, content.bottom - overlay.top + 16)) : 0;
        area.style.paddingBottom = `${Math.ceil(inset)}px`;
      });
    };
    const resize = new ResizeObserver(measure);
    resize.observe(area); resize.observe(composer);
    const mutation = new MutationObserver(measure);
    mutation.observe(desktopWindow, { attributes: true, attributeFilter: ["style", "class"] });
    window.addEventListener("resize", measure);
    desktopWindow.addEventListener("transitionend", measure);
    measure();
    return () => { cancelAnimationFrame(frame); resize.disconnect(); mutation.disconnect(); window.removeEventListener("resize", measure); desktopWindow.removeEventListener("transitionend", measure); };
  }, []);
  return <div ref={ref} className={`desktop-reading-area ${className}`} style={{ minHeight: 0, height: "100%", boxSizing: "border-box", background: "#fff" }}>{children}</div>;
}
