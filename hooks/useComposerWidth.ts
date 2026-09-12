"use client";
import { useLayoutEffect, useState, type RefObject } from "react";

/** Measure the controlled draft, so typing, quick prompts and dictation agree. */
export function useComposerWidth(value: string, input: RefObject<HTMLTextAreaElement | null>) {
  const [width, setWidth] = useState(362);
  useLayoutEffect(() => {
    if (!input.current) return;
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d");
    if (!context) return;
    context.font = getComputedStyle(input.current).font;
    const textWidth = Math.max(0, ...value.split("\n").map(line => context.measureText(line).width));
    setWidth(Math.min(560, Math.max(362, Math.ceil(textWidth + 132))));
  }, [value, input]);
  return width;
}
