"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { dockMagnification } from "@/lib/desktop-dock";
import "./DesktopDock.css";

/** Magnification inspired by the public 21st.dev macOS Dock preview.
 * Existing buttons retain ownership of application actions and context menus.
 */
export function DesktopDock({ children }: { children: ReactNode }) {
  const dockRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const dock = dockRef.current;
    if (!dock) return;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const finePointer = window.matchMedia("(hover: hover) and (pointer: fine)");
    let items: { button: HTMLButtonElement; center: number; amount: number }[] = [];
    let pointerX: number | null = null;
    let frame: number | null = null;
    let previousTime = 0;
    let roomToMagnify = true;
    const bounces = new Map<HTMLButtonElement, Animation>();

    const animate = (time: number) => {
      frame = null;
      const dt = previousTime ? Math.min(time - previousTime, 32) : 16;
      previousTime = time;
      const ease = 1 - Math.exp(-dt / 65);
      const bounds = dock.getBoundingClientRect();
      const center = bounds.left + bounds.width / 2;
      let moving = false;
      for (const item of items) {
        const target = pointerX !== null && roomToMagnify && finePointer.matches && !reducedMotion.matches
          ? dockMagnification(pointerX - (center + item.center)) : 0;
        item.amount += (target - item.amount) * ease;
        if (Math.abs(target - item.amount) < .001) item.amount = target;
        else moving = true;
        item.button.style.setProperty("--dock-magnify", item.amount.toFixed(4));
      }
      if (moving) frame = requestAnimationFrame(animate);
      else previousTime = 0;
    };
    const schedule = () => { if (frame === null) frame = requestAnimationFrame(animate); };
    const reset = () => { pointerX = null; schedule(); };

    const measure = () => {
      // Measure neutral positions, never the expanding layout. Otherwise icon
      // movement feeds back into pointer distance and causes hover jitter.
      if (frame !== null) cancelAnimationFrame(frame);
      frame = null;
      previousTime = 0;
      pointerX = null;
      const buttons = Array.from(dock.querySelectorAll<HTMLButtonElement>(":scope > button"));
      for (const button of buttons) button.style.setProperty("--dock-magnify", "0");
      const width = dock.getBoundingClientRect().width;
      items = buttons.map(button => ({ button, center: button.offsetLeft + button.offsetWidth / 2 - width / 2, amount: 0 }));
      dock.dataset.crowded = String(dock.scrollWidth > dock.clientWidth + 1);
      roomToMagnify = dock.scrollWidth + 80 <= window.innerWidth - 32;
    };
    const onPointerMove = (event: PointerEvent) => {
      if (event.pointerType !== "mouse" || !finePointer.matches || reducedMotion.matches) return;
      pointerX = event.clientX;
      schedule();
    };
    const onFocus = (event: FocusEvent) => {
      const button = event.target as HTMLElement;
      const item = items.find(item => item.button === button);
      if (!item || !button.matches(":focus-visible")) return;
      const bounds = dock.getBoundingClientRect();
      pointerX = bounds.left + bounds.width / 2 + item.center;
      schedule();
    };
    const onBlur = (event: FocusEvent) => {
      if (!(event.relatedTarget instanceof Node) || !dock.contains(event.relatedTarget)) reset();
    };
    const onClick = (event: MouseEvent) => {
      if (reducedMotion.matches || !finePointer.matches) return;
      const button = (event.target as Element).closest("button");
      if (!(button instanceof HTMLButtonElement) || button.parentElement !== dock || button.disabled) return;
      bounces.get(button)?.cancel();
      const bounce = button.animate([
        { translate: "0 0" }, { translate: "0 -14px", offset: .3 },
        { translate: "0 0", offset: .6 }, { translate: "0 -5px", offset: .8 }, { translate: "0 0" },
      ], { duration: 480, easing: "cubic-bezier(.2,.7,.3,1)" });
      bounces.set(button, bounce);
      bounce.onfinish = () => { if (bounces.get(button) === bounce) bounces.delete(button); };
    };
    const onMotionChange = () => {
      for (const animation of bounces.values()) animation.cancel();
      bounces.clear();
      measure();
    };
    const observer = new MutationObserver(measure);
    observer.observe(dock, { childList: true });
    measure();
    dock.addEventListener("pointermove", onPointerMove);
    dock.addEventListener("pointerleave", reset);
    dock.addEventListener("pointercancel", reset);
    dock.addEventListener("focusin", onFocus);
    dock.addEventListener("focusout", onBlur);
    dock.addEventListener("click", onClick);
    dock.addEventListener("scroll", reset);
    window.addEventListener("resize", measure);
    window.addEventListener("blur", reset);
    reducedMotion.addEventListener("change", onMotionChange);
    finePointer.addEventListener("change", onMotionChange);
    return () => {
      observer.disconnect();
      if (frame !== null) cancelAnimationFrame(frame);
      for (const animation of bounces.values()) animation.cancel();
      for (const item of items) item.button.style.removeProperty("--dock-magnify");
      dock.removeEventListener("pointermove", onPointerMove);
      dock.removeEventListener("pointerleave", reset);
      dock.removeEventListener("pointercancel", reset);
      dock.removeEventListener("focusin", onFocus);
      dock.removeEventListener("focusout", onBlur);
      dock.removeEventListener("click", onClick);
      dock.removeEventListener("scroll", reset);
      window.removeEventListener("resize", measure);
      window.removeEventListener("blur", reset);
      reducedMotion.removeEventListener("change", onMotionChange);
      finePointer.removeEventListener("change", onMotionChange);
    };
  }, []);

  return <nav ref={dockRef} className="agent-os-dock desktop-dock" aria-label="应用程序 Dock">{children}</nav>;
}
