"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/** Status expires from its occurrence, even when an action occupies the surface. */
export function useDesktopNotice() {
  const [notice, update] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const setNotice = useCallback((message: string | null) => {
    clearTimeout(timer.current);
    update(message);
    if (message) timer.current = setTimeout(() => update(null), 3200);
  }, []);
  useEffect(() => () => clearTimeout(timer.current), []);
  return [notice, setNotice] as const;
}
