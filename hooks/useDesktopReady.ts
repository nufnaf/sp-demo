"use client";

import { useEffect } from "react";

declare global {
  interface Window {
    syntropicDesktop?: { ready: () => void; captureSpaceThumbnail?: () => Promise<string | null> };
  }
}

/** Desktop only: wait for hydration, fonts, wallpaper and a painted frame. */
export function useDesktopReady() {
  useEffect(() => {
    const desktop = window.syntropicDesktop;
    if (!desktop) return;
    let cancelled = false;
    let frame = 0;
    const wallpaper = new Image();
    wallpaper.src = "/design/home/wallpaper.png";
    void Promise.allSettled([wallpaper.decode(), document.fonts.ready]).then(() => {
      if (cancelled) return;
      frame = requestAnimationFrame(() => {
        frame = requestAnimationFrame(() => { if (!cancelled) desktop.ready(); });
      });
    });
    return () => { cancelled = true; cancelAnimationFrame(frame); };
  }, []);
}
