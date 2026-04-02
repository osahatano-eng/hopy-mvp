// /components/chat/lib/translateIdle.ts
"use client";

import { useEffect, useRef } from "react";
import type { ChatMsg, Lang } from "./chatTypes";

const MAX_BATCH = 18;
const MAX_SCAN = 160;

function idle(cb: () => void) {
  const w = window as any;
  if (typeof w.requestIdleCallback === "function") {
    const id = w.requestIdleCallback(cb, { timeout: 900 });
    return () => w.cancelIdleCallback?.(id);
  }
  const t = window.setTimeout(cb, 1);
  return () => window.clearTimeout(t);
}

function collectBatch(args: {
  uiLang: Lang;
  messages: ChatMsg[];
  currentTmap: Record<string, string>;
  pendingKeys: Set<string>;
}) {
  const { uiLang, messages, currentTmap, pendingKeys } = args;

  const seen = new Set<string>();
  const batch: string[] = [];
  const batchKeys: string[] = [];

  const start = Math.max(0, messages.length - MAX_SCAN);

  for (let i = start; i < messages.length; i++) {
    const m = messages[i];
    if (m.lang === uiLang) continue;

    const text = String(m.content ?? "").trim();
    if (!text || text.length > 2000) continue;

    const key = `${uiLang}::${text}`;
    if (currentTmap[key]) continue;
    if (pendingKeys.has(key)) continue;
    if (seen.has(text)) continue;

    seen.add(text);
    batch.push(text);
    batchKeys.push(key);

    if (batch.length >= MAX_BATCH) break;
  }

  return { batch, batchKeys };
}

export function useTranslateIdle(args: {
  uiLang: Lang;
  messages: ChatMsg[];
  tmap: Record<string, string>;
  tmapRef: React.MutableRefObject<Record<string, string>>;
  translatingRef: React.MutableRefObject<boolean>;
  setTmap: React.Dispatch<React.SetStateAction<Record<string, string>>>;
}) {
  const { uiLang, messages, tmapRef, translatingRef, setTmap } = args;

  const pendingKeysRef = useRef<Set<string>>(new Set());
  const lastPlannedSigRef = useRef<string>("");

  useEffect(() => {
    if (translatingRef.current) return;
    if (messages.length === 0) return;

    const preview = collectBatch({
      uiLang,
      messages,
      currentTmap: tmapRef.current,
      pendingKeys: pendingKeysRef.current,
    });

    if (preview.batch.length === 0) {
      lastPlannedSigRef.current = "";
      return;
    }

    const nextSig = `${uiLang}::${preview.batchKeys.join("|")}`;
    if (lastPlannedSigRef.current === nextSig) return;
    lastPlannedSigRef.current = nextSig;

    const cancel = idle(() => {
      if (translatingRef.current) return;

      const current = collectBatch({
        uiLang,
        messages,
        currentTmap: tmapRef.current,
        pendingKeys: pendingKeysRef.current,
      });

      const batch = current.batch;
      const batchKeys = current.batchKeys;

      if (batch.length === 0) {
        lastPlannedSigRef.current = "";
        return;
      }

      for (let i = 0; i < batchKeys.length; i++) {
        pendingKeysRef.current.add(batchKeys[i]);
      }

      const run = async () => {
        translatingRef.current = true;
        try {
          const res = await fetch("/api/translate", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ targetLang: uiLang, texts: batch }),
          });

          const data = await res.json().catch(() => ({}));
          if (!res.ok) return;

          const out: string[] = Array.isArray(data?.translations) ? data.translations : [];
          if (out.length !== batch.length) return;

          setTmap((prev) => {
            let changed = false;
            const next = { ...prev };

            for (let i = 0; i < batch.length; i++) {
              const key = `${uiLang}::${batch[i]}`;
              const value = String(out[i] ?? "").trim();
              if (!value) continue;
              if (next[key] === value) continue;
              next[key] = value;
              changed = true;
            }

            return changed ? next : prev;
          });
        } finally {
          for (let i = 0; i < batchKeys.length; i++) {
            pendingKeysRef.current.delete(batchKeys[i]);
          }
          translatingRef.current = false;
          lastPlannedSigRef.current = "";
        }
      };

      run();
    });

    return () => cancel?.();
  }, [uiLang, messages.length, tmapRef, translatingRef, setTmap]);
}