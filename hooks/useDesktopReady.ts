"use client";

import { useEffect } from "react";
import type { ComputerPermission, ComputerPermissions } from "@/lib/computer-permissions";

declare global {
  interface Window {
    syntropicDesktop?: {
      ready: () => void;
      startupMark?: (name: string) => void;
      showStartup?: () => Promise<void>;
      captureSpaceThumbnail?: () => Promise<string | null>;
      getUiPreferences?: () => Promise<unknown>;
      setUiPreferences?: (value: { desktopSpacesEnabled: boolean; previewWidthScale: number }) => Promise<unknown>;
      getComputerPermissions?: () => Promise<ComputerPermissions>;
      requestComputerPermission?: (kind: ComputerPermission) => Promise<ComputerPermissions>;
      completeInitialization?: (value: boolean) => Promise<ComputerPermissions>;
    };
  }
}

/** Desktop only: wait for hydration, fonts, wallpaper and a painted frame. */
export function useDesktopReady(enabled = true) {
  useEffect(() => {
    if (!enabled) return;
    const desktop = window.syntropicDesktop;
    if (!desktop) return;
    desktop.startupMark?.('assets.wait.start');
    let cancelled = false;
    let frame = 0;
    const wallpaper = new Image();
    wallpaper.src = "/design/home/wallpaper.png";
    void Promise.allSettled([wallpaper.decode(), document.fonts.ready]).then(() => {
      if (cancelled) return;
      desktop.startupMark?.('assets.wait.end');
      frame = requestAnimationFrame(() => {
        frame = requestAnimationFrame(() => { if (!cancelled) { desktop.startupMark?.('frame.ready'); desktop.ready(); } });
      });
    });
    return () => { cancelled = true; cancelAnimationFrame(frame); };
  }, [enabled]);
}
