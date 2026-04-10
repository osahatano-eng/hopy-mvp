// /components/chat/hooks/useChatAppTranslationCache.ts
"use client";

import { useEffect, useState } from "react";

export function useChatAppTranslationCache() {
  const [tmap, setTmap] = useState<Record<string, string>>({});

  useEffect(() => {
    const raw = localStorage.getItem("hopy_tmap_v1");
    if (!raw) return;

    try {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === "object") {
        setTmap(parsed);
      }
    } catch {}
  }, []);

  useEffect(() => {
    const keys = Object.keys(tmap);

    if (keys.length > 1500) {
      const half = keys.slice(0, Math.floor(keys.length / 2));
      const next = { ...tmap };

      for (const k of half) {
        delete next[k];
      }

      setTmap(next);
      return;
    }

    localStorage.setItem("hopy_tmap_v1", JSON.stringify(tmap));
  }, [tmap]);

  function clearTranslationCache() {
    localStorage.removeItem("hopy_tmap_v1");
    setTmap({});
  }

  return {
    tmap,
    setTmap,
    clearTranslationCache,
  };
}