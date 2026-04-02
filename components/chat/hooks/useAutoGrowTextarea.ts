// /components/chat/hooks/useAutoGrowTextarea.ts
"use client";

import { useEffect } from "react";

export function useAutoGrowTextarea(
  ref: React.RefObject<HTMLTextAreaElement>,
  value: string,
  maxHeight = 160
) {
  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    el.style.height = "0px";
    const next = Math.min(el.scrollHeight, maxHeight);
    el.style.height = `${next}px`;
  }, [ref, value, maxHeight]);
}