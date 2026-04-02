// /components/chat/lib/useTranslateCache.ts
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { ChatMsg, Lang } from "./chatTypes";
import { useTranslateIdle } from "./translateIdle";

const STORAGE_KEY = "hopy_tmap_v1";
const MAX_TMAP_KEYS = 1500;

function canUseLocalStorage() {
  try {
    return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
  } catch {
    return false;
  }
}

function scheduleIdleWrite(cb: () => void) {
  try {
    const w = window as any;
    if (typeof w.requestIdleCallback === "function") {
      const id = w.requestIdleCallback(cb, { timeout: 1200 });
      return () => {
        try {
          w.cancelIdleCallback?.(id);
        } catch {}
      };
    }
  } catch {}

  const t = window.setTimeout(cb, 120);
  return () => {
    try {
      window.clearTimeout(t);
    } catch {}
  };
}

export function useTranslateCache(params: { uiLang: Lang; messages: ChatMsg[] }) {
  const { uiLang, messages } = params;

  const [cacheRecord, setCacheRecord] = useState<Record<string, string>>({});
  const tmapRef = useRef<Record<string, string>>({});
  const translatingRef = useRef(false);
  const lastPersistedJsonRef = useRef("");
  const persistCancelRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    tmapRef.current = cacheRecord;
  }, [cacheRecord]);

  useEffect(() => {
    if (!canUseLocalStorage()) return;

    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;

      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return;

      const next = parsed as Record<string, string>;
      const nextKeys = Object.keys(next);
      if (nextKeys.length === 0) return;

      const current = tmapRef.current;
      const currentKeys = Object.keys(current);

      if (currentKeys.length === nextKeys.length) {
        let same = true;
        for (let i = 0; i < nextKeys.length; i++) {
          const k = nextKeys[i];
          if (current[k] !== next[k]) {
            same = false;
            break;
          }
        }
        if (same) {
          lastPersistedJsonRef.current = raw;
          return;
        }
      }

      lastPersistedJsonRef.current = raw;
      setCacheRecord(next);
    } catch {}
  }, []);

  useEffect(() => {
    const keys = Object.keys(cacheRecord);

    if (keys.length > MAX_TMAP_KEYS) {
      const deleteCount = Math.floor(keys.length / 2);
      const next = { ...cacheRecord };

      for (let i = 0; i < deleteCount; i++) {
        delete next[keys[i]];
      }

      setCacheRecord(next);
      return;
    }

    if (!canUseLocalStorage()) return;

    if (persistCancelRef.current) {
      try {
        persistCancelRef.current();
      } catch {}
      persistCancelRef.current = null;
    }

    persistCancelRef.current = scheduleIdleWrite(() => {
      try {
        const json = JSON.stringify(cacheRecord);
        if (lastPersistedJsonRef.current === json) return;
        localStorage.setItem(STORAGE_KEY, json);
        lastPersistedJsonRef.current = json;
      } catch {}
    });

    return () => {
      if (persistCancelRef.current) {
        try {
          persistCancelRef.current();
        } catch {}
        persistCancelRef.current = null;
      }
    };
  }, [cacheRecord]);

  useTranslateIdle({
    uiLang,
    messages,
    tmap: cacheRecord,
    tmapRef,
    translatingRef,
    setTmap: setCacheRecord,
  });

  const tmap = useMemo(() => {
    return new Map<string, string>(Object.entries(cacheRecord));
  }, [cacheRecord]);

  return { tmap, setTmap: setCacheRecord, tmapRef, translatingRef };
}