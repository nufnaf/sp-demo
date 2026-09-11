"use client";

import { useEffect, useSyncExternalStore } from "react";
import { DEFAULT_UI_PREFERENCES, normalizeUiPreferences } from "@/electron/ui-preferences-schema.mjs";

export interface DesktopPreferences { desktopSpacesEnabled: boolean; previewWidthScale: number }
const KEY = "syntropic:ui-preferences:v1";
const initial = { preferences: DEFAULT_UI_PREFERENCES as DesktopPreferences, loaded: false, saving: false, error: null as string | null };
let snapshot = initial;
let loading: Promise<void> | undefined;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach(listener => listener());
const subscribe = (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; };
const getSnapshot = () => snapshot;
const getServerSnapshot = () => initial;

function load() {
  return loading ??= (async () => {
    try {
      const bridge = window.syntropicDesktop;
      const value = bridge?.getUiPreferences ? await bridge.getUiPreferences() : JSON.parse(localStorage.getItem(KEY) ?? "null");
      snapshot = { ...snapshot, preferences: normalizeUiPreferences(value), loaded: true, error: null };
    } catch { snapshot = { ...snapshot, loaded: true, error: "设置读取失败，请重新尝试。" }; }
    emit();
  })();
}

async function updatePreferences(patch: Partial<DesktopPreferences>) {
  if (!snapshot.loaded || snapshot.saving) return;
  const preferences = normalizeUiPreferences({ ...snapshot.preferences, ...patch });
  snapshot = { ...snapshot, saving: true, error: null }; emit();
  try {
    const bridge = window.syntropicDesktop;
    if (bridge?.setUiPreferences) await bridge.setUiPreferences(preferences);
    else localStorage.setItem(KEY, JSON.stringify(preferences));
    snapshot = { preferences, loaded: true, saving: false, error: null };
  } catch { snapshot = { ...snapshot, saving: false, error: "设置未能保存，请重试。" }; }
  emit();
}

export function useDesktopPreferences() {
  const state = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  useEffect(() => { void load(); }, []);
  return { ...state, updatePreferences };
}
