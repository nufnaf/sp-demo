"use client";

import { useEffect, useRef, useState } from "react";
import type { SpacesState } from "@/lib/desktop-spaces";

/** Recent painted frames, kept in memory only. Inactive Spaces retain their last view. */
export function useSpaceThumbnails(state: SpacesState, overview: boolean) {
  const [images, setImages] = useState<Record<string, string>>({});
  const inFlight = useRef(false);
  useEffect(() => {
    const capture = window.syntropicDesktop?.captureSpaceThumbnail;
    if (!capture || overview) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;
    const sample = async () => {
      // The dialog may already be committed before this effect is cleaned up.
      if (!inFlight.current && document.visibilityState === "visible" && !document.querySelector(".spaces-overview")) {
        inFlight.current = true;
        try {
          const image = await capture();
          if (!cancelled && image && !document.querySelector(".spaces-overview")) {
            setImages(current => ({
              ...Object.fromEntries(Object.entries(current).filter(([id]) => state.spaces.some(space => space.id === id))),
              [state.active]: image,
            }));
          }
        } catch { /* Keep the last usable frame if capture is temporarily unavailable. */ }
        finally { inFlight.current = false; }
      }
      if (!cancelled) timer = setTimeout(sample, 1000);
    };
    // Let desktop switching and newly opened windows settle before capturing.
    timer = setTimeout(sample, 600);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [state, overview]);
  return images;
}
