// /components/chat/lib/useChatInitThreads.ts
"use client";

import type { Dispatch, MutableRefObject, SetStateAction } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";

import type { Lang, Thread } from "./chatTypes";
import { fetchThreads } from "./threadApi";
import {
  sortThreadsByUpdatedDesc,
  mergeThreadsPreferNewer,
} from "./useChatInitThreadList";
import { sleep, logWarn, errText } from "./useChatInitUtils";

export type UseChatInitThreadsParams<TState = unknown> = {
  uiLang: Lang;
  setThreads: Dispatch<SetStateAction<Thread[]>>;
};

export type FetchThreadsWithRetryResult = {
  ok: boolean;
  list: Thread[];
  allowCreateNew: boolean;
  error?: string;
};

export async function fetchThreadsOnly<TState>(args: {
  isAlive: () => boolean;
  initSeqRef: MutableRefObject<number>;
  seq: number;
  supabase: SupabaseClient<any>;
  paramsRef: MutableRefObject<UseChatInitThreadsParams<TState>>;
}): Promise<Thread[] | null> {
  const { isAlive, initSeqRef, seq, supabase, paramsRef } = args;
  const p = paramsRef.current;

  try {
    const r = await fetchThreads(supabase, p.uiLang);

    if (!isAlive()) return null;
    if (seq !== initSeqRef.current) return null;

    if (!r.ok) return null;

    const titleFallback = p.uiLang === "en" ? "New chat" : "新規チャット";
    const incoming = Array.isArray(r.list) ? r.list : [];

    p.setThreads((prev) =>
      sortThreadsByUpdatedDesc(
        mergeThreadsPreferNewer(Array.isArray(prev) ? prev : [], incoming, titleFallback),
      ),
    );

    return incoming;
  } catch (e) {
    logWarn("[useChatInit] fetchThreadsOnly error", errText(e));
    return null;
  }
}

export async function fetchThreadsWithRetry<TState>(args: {
  isAlive: () => boolean;
  initSeqRef: MutableRefObject<number>;
  seq: number;
  supabase: SupabaseClient<any>;
  uiLang: Lang;
  onSuccessList?: (list: Thread[]) => void;
}): Promise<FetchThreadsWithRetryResult> {
  const { isAlive, initSeqRef, seq, supabase, uiLang, onSuccessList } = args;

  const delays = [0, 180, 420, 780, 1200];

  let list: Thread[] = [];
  let lastErr: string | undefined;

  for (let i = 0; i < delays.length; i++) {
    if (!isAlive()) return { ok: false, list: [], allowCreateNew: false };
    if (seq !== initSeqRef.current) return { ok: false, list: [], allowCreateNew: false };

    if (delays[i] > 0) await sleep(delays[i]);

    if (!isAlive()) return { ok: false, list: [], allowCreateNew: false };
    if (seq !== initSeqRef.current) return { ok: false, list: [], allowCreateNew: false };

    try {
      const r = await fetchThreads(supabase, uiLang);

      if (!isAlive()) return { ok: false, list: [], allowCreateNew: false };
      if (seq !== initSeqRef.current) return { ok: false, list: [], allowCreateNew: false };

      if (r.ok) {
        list = Array.isArray(r.list) ? r.list : [];

        try {
          onSuccessList?.(list);
        } catch {}

        if (list.length > 0) {
          return { ok: true, list, allowCreateNew: false };
        }

        if (i < delays.length - 1) continue;

        return { ok: true, list: [], allowCreateNew: true };
      }

      lastErr = String(r.error ?? "fetchThreads error");

      if (i < delays.length - 1) continue;

      return {
        ok: false,
        list: [],
        allowCreateNew: false,
        error: lastErr,
      };
    } catch (e) {
      lastErr = errText(e);
      logWarn("[useChatInit] fetchThreads threw", lastErr);

      if (i < delays.length - 1) continue;

      return {
        ok: false,
        list: [],
        allowCreateNew: false,
        error: lastErr,
      };
    }
  }

  return {
    ok: false,
    list: Array.isArray(list) ? list : [],
    allowCreateNew: false,
    error: lastErr,
  };
}

/*
このファイルの正式役割:
useChatInitParts.ts から切り出した、threads 取得責務を担う。
fetchThreadsOnly と fetchThreadsWithRetry により conversations / threads の取得、取得結果の merge、retry 結果の返却だけを担当する。
profile / plan / userState 取得本体、activeThread 復元 / 新規thread作成 / messages / HOPY状態 / Compass / confirmed payload の正は作らない。
*/

/*
【今回このファイルで修正したこと】
1. 前回追加した THREADS_READ_TIMEOUT_MS を削除しました。
2. 前回追加した ThreadsReadResult / withTimeout() / readThreadsOnce() を削除しました。
3. fetchThreadsOnly() と fetchThreadsWithRetry() を fetchThreads() 直接呼び出しへ戻しました。
4. fetchThreads timed out を人工的に発生させる経路を削除しました。
5. profile / plan / userState 取得、activeThread 復元、新規thread作成制御、本文表示、送信、MEMORIES には触れていません。
6. HOPY唯一の正、confirmed payload、state_changed、HOPY回答○、Compass、状態値 1..5 / 5段階、DB保存・復元仕様には触れていません。
*/

/* /components/chat/lib/useChatInitThreads.ts */