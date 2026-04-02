// /components/chat/hooks/useChatAppTranslationRunner.ts
"use client";

import { useEffect, useRef } from "react";

type ChatAppLang = "en" | "ja";

type ChatAppMessage = {
  content: string;
  lang: ChatAppLang;
};

export function useChatAppTranslationRunner(args: {
  uiLang: ChatAppLang;
  messages: ChatAppMessage[];
  tmap: Record<string, string>;
  setTmap: React.Dispatch<React.SetStateAction<Record<string, string>>>;
}) {
  const { uiLang, messages, tmap, setTmap } = args;
  const translatingRef = useRef(false);

  useEffect(() => {
    if (translatingRef.current) return;
    if (messages.length === 0) return;

    const needs = messages
      .filter((m) => m.lang !== uiLang)
      .map((m) => (m.content ?? "").trim())
      .filter((s) => s.length > 0 && s.length <= 2000)
      .filter((s) => !tmap[`${uiLang}::${s}`]);

    const uniq = Array.from(new Set(needs));
    if (uniq.length === 0) return;

    const batch = uniq.slice(0, 18);

    const run = async () => {
      translatingRef.current = true;

      try {
        const res = await fetch("/api/translate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            targetLang: uiLang,
            texts: batch,
          }),
        });

        const data = await res.json().catch(() => ({}));
        if (!res.ok) return;

        const out: string[] = Array.isArray(data?.translations) ? data.translations : [];
        if (out.length !== batch.length) return;

        setTmap((prev) => {
          const next = { ...prev };

          for (let i = 0; i < batch.length; i++) {
            next[`${uiLang}::${batch[i]}`] = String(out[i] ?? "").trim();
          }

          return next;
        });
      } finally {
        translatingRef.current = false;
      }
    };

    run();
  }, [uiLang, messages, tmap, setTmap]);
}