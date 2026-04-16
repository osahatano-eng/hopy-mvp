// /components/chat/lib/threadApiEnsureActiveThread.ts
"use client";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Dispatch, SetStateAction } from "react";

import type { Lang, Thread } from "./chatTypes";
import { loadActiveThreadId, saveActiveThreadId } from "./threadStore";

import { logWarn, microtask, normMsg, safeUUID } from "./threadApiSupport";
import {
  isAuthNotReadyError,
  isMissingColumnError,
  isNoRowsSingleError,
  isOnConflictConstraintMissingError,
} from "./threadApiErrors";
import { waitForAuthReady } from "./threadApiAuth";
import {
  THREAD_SELECT_FULL,
  THREAD_SELECT_MIN,
  THREAD_SELECT_MIN_NO_UPDATED,
  THREAD_SELECT_NO_UPDATED,
  normalizeThreadRow,
} from "./threadApiNormalize";

export type EnsureResult =
  | { ok: true; id: string }
  | { ok: false; id: null; error: string };

function applySetThreads(
  setThreads: Dispatch<SetStateAction<Thread[]>>,
  next: Thread[] | ((prev: Thread[]) => Thread[]),
) {
  try {
    setThreads(next as any);
  } catch {}
}

function applySetThreadsIfEmpty(
  setThreads: Dispatch<SetStateAction<Thread[]>>,
  list: Thread[],
) {
  try {
    setThreads((prev) => {
      const p = Array.isArray(prev) ? prev : [];
      if (p.length > 0) return p;
      return Array.isArray(list) ? list : [];
    });
  } catch {}
}

type InFlightEntry = { at: number; promise: Promise<EnsureResult> };
const inFlightByKey = new Map<string, InFlightEntry>();

const CREATE_INFLIGHT_MAX_MS = 60_000;

export type EnsureActiveThreadArgs = {
  supabase: SupabaseClient;
  list: Thread[];
  uiLang: Lang;
  setActiveThreadId: (id: string | null) => void;
  setThreads: Dispatch<SetStateAction<Thread[]>>;
  forceCreate?: boolean;
  clientRequestId?: string;
};

function threadIdOf(thread: Thread | null | undefined): string {
  return String((thread as any)?.id ?? "").trim();
}

function applyThreadToFront(
  setThreads: Dispatch<SetStateAction<Thread[]>>,
  list: Thread[],
  nextThread: Thread,
) {
  const nextId = threadIdOf(nextThread);

  applySetThreads(setThreads, (prev) => {
    const base = Array.isArray(prev) && prev.length > 0 ? prev : list;
    const filtered = base.filter((t) => threadIdOf(t) !== nextId);
    return [nextThread, ...filtered];
  });
}

function commitActiveThread(
  setThreads: Dispatch<SetStateAction<Thread[]>>,
  setActiveThreadId: (id: string | null) => void,
  list: Thread[],
  nextThread: Thread,
): EnsureResult {
  const nextId = threadIdOf(nextThread);
  applyThreadToFront(setThreads, list, nextThread);
  setActiveThreadId(nextId);
  saveActiveThreadId(nextId);
  return { ok: true, id: nextId };
}

function restoreThreadsOnFail(
  setThreads: Dispatch<SetStateAction<Thread[]>>,
  list: Thread[],
) {
  applySetThreads(setThreads, (prev) =>
    Array.isArray(prev) && prev.length > 0 ? prev : list,
  );
}

function failEnsureThread(
  setThreads: Dispatch<SetStateAction<Thread[]>>,
  list: Thread[],
  error: string,
): EnsureResult {
  restoreThreadsOnFail(setThreads, list);
  return { ok: false, id: null, error };
}

export async function ensureActiveThread(
  args: EnsureActiveThreadArgs,
): Promise<EnsureResult> {
  const {
    supabase,
    list,
    uiLang,
    setActiveThreadId,
    setThreads,
    forceCreate,
  } = args;

  applySetThreadsIfEmpty(setThreads, list);

  const saved = loadActiveThreadId();

  if (!forceCreate && saved) {
    if (!Array.isArray(list) || list.length === 0) {
      setActiveThreadId(saved);
      saveActiveThreadId(saved);
      return { ok: true, id: saved };
    }

    if (
      list.some((t) => threadIdOf(t) === String(saved).trim())
    ) {
      setActiveThreadId(saved);
      saveActiveThreadId(saved);
      return { ok: true, id: saved };
    }
  }

  if (!forceCreate && Array.isArray(list) && list.length > 0) {
    const id = threadIdOf(list[0]);
    if (id) {
      setActiveThreadId(id);
      saveActiveThreadId(id);
      return { ok: true, id };
    }
  }

  const titleFallback = uiLang === "en" ? "New chat" : "新規チャット";
  const clientRequestId =
    String(args.clientRequestId ?? "").trim() || safeUUID();
  const key = clientRequestId;

  const existing = inFlightByKey.get(key);
  if (existing) {
    const age = Date.now() - (existing.at || 0);
    if (age >= 0 && age <= CREATE_INFLIGHT_MAX_MS) {
      return await existing.promise;
    }
    inFlightByKey.delete(key);
  }

  const tryReadBackByClientRequestId = async (): Promise<Thread | null> => {
    try {
      const { data, error } = await supabase
        .from("conversations")
        .select(THREAD_SELECT_FULL)
        .eq("client_request_id", clientRequestId as any)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) {
        if (isNoRowsSingleError(error)) return null;

        if (isMissingColumnError(error)) {
          try {
            const { data: data2, error: error2 } = await supabase
              .from("conversations")
              .select(THREAD_SELECT_MIN)
              .eq("client_request_id", clientRequestId as any)
              .order("created_at", { ascending: false })
              .limit(1)
              .maybeSingle();

            if (error2) {
              if (isNoRowsSingleError(error2)) return null;
              if (isMissingColumnError(error2)) return null;
              if (isAuthNotReadyError(error2)) return null;
              return null;
            }

            if (!data2?.id) return null;

            return normalizeThreadRow(data2, titleFallback, {
              preferNowIfMissingUpdated: true,
              bumpNowForEventIfMissingUpdated: true,
            });
          } catch {
            return null;
          }
        }

        if (isAuthNotReadyError(error)) return null;
        return null;
      }

      if (!data?.id) return null;

      return normalizeThreadRow(data, titleFallback, {
        preferNowIfMissingUpdated: true,
        bumpNowForEventIfMissingUpdated: true,
      });
    } catch {
      return null;
    }
  };

  const doCreate = async (): Promise<EnsureResult> => {
    const auth = await waitForAuthReady(supabase);
    if (!auth.ok) {
      return failEnsureThread(setThreads, list, "auth_not_ready");
    }

    const preExisting = await tryReadBackByClientRequestId();
    if (preExisting?.id) {
      return commitActiveThread(
        setThreads,
        setActiveThreadId,
        list,
        preExisting,
      );
    }

    try {
      const { data: rowU, error: errorU } = await supabase
        .from("conversations")
        .upsert(
          { title: titleFallback, client_request_id: clientRequestId } as any,
          {
            onConflict: "user_id,client_request_id",
            ignoreDuplicates: false,
          } as any,
        )
        .select(THREAD_SELECT_FULL)
        .single();

      if (errorU || !rowU?.id) {
        if (isMissingColumnError(errorU)) {
          throw errorU;
        }

        if (isAuthNotReadyError(errorU)) {
          throw new Error("auth_not_ready");
        }

        if (isOnConflictConstraintMissingError(errorU)) {
          const existed = await tryReadBackByClientRequestId();
          if (existed?.id) {
            return commitActiveThread(
              setThreads,
              setActiveThreadId,
              list,
              existed,
            );
          }
        }

        logWarn("[threadApi] ensureActiveThread: upsert failed -> fallback insert", {
          reason: normMsg(errorU ?? "upsert_failed"),
        });
        throw errorU ?? new Error("upsert_failed");
      }

      const nextThread = normalizeThreadRow(rowU, titleFallback, {
        preferNowIfMissingUpdated: true,
        bumpNowForEventIfMissingUpdated: true,
      });

      return commitActiveThread(
        setThreads,
        setActiveThreadId,
        list,
        nextThread,
      );
    } catch (eUpsert) {
      try {
        const { data: row, error } = await supabase
          .from("conversations")
          .insert({ title: titleFallback, client_request_id: clientRequestId } as any)
          .select(THREAD_SELECT_FULL)
          .single();

        if (error || !row?.id) {
          if (isMissingColumnError(error)) {
            throw error;
          }

          if (isAuthNotReadyError(error)) {
            return { ok: false, id: null, error: "auth_not_ready" };
          }

          const existed = await tryReadBackByClientRequestId();
          if (existed?.id) {
            return commitActiveThread(
              setThreads,
              setActiveThreadId,
              list,
              existed,
            );
          }

          return failEnsureThread(setThreads, list, normMsg(error));
        }

        const nextThread = normalizeThreadRow(row, titleFallback, {
          preferNowIfMissingUpdated: true,
          bumpNowForEventIfMissingUpdated: true,
        });

        return commitActiveThread(
          setThreads,
          setActiveThreadId,
          list,
          nextThread,
        );
      } catch (e) {
        try {
          const { data: row, error } = await supabase
            .from("conversations")
            .insert({ title: titleFallback } as any)
            .select(THREAD_SELECT_FULL)
            .single();

          if (error || !row?.id) {
            if (isMissingColumnError(error)) {
              try {
                const { data: row2, error: error2 } = await supabase
                  .from("conversations")
                  .insert({ title: titleFallback } as any)
                  .select(THREAD_SELECT_MIN)
                  .single();

                if (error2 || !row2?.id) {
                  if (isMissingColumnError(error2)) {
                    throw error2;
                  }

                  if (isAuthNotReadyError(error2)) {
                    return { ok: false, id: null, error: "auth_not_ready" };
                  }

                  return failEnsureThread(setThreads, list, normMsg(error2));
                }

                const nextThread = normalizeThreadRow(row2, titleFallback, {
                  preferNowIfMissingUpdated: true,
                  bumpNowForEventIfMissingUpdated: true,
                });

                return commitActiveThread(
                  setThreads,
                  setActiveThreadId,
                  list,
                  nextThread,
                );
              } catch (eMin) {
                throw eMin;
              }
            }

            if (isAuthNotReadyError(error)) {
              return { ok: false, id: null, error: "auth_not_ready" };
            }

            return failEnsureThread(setThreads, list, normMsg(error));
          }

          const nextThread = normalizeThreadRow(row, titleFallback, {
            preferNowIfMissingUpdated: true,
            bumpNowForEventIfMissingUpdated: true,
          });

          return commitActiveThread(
            setThreads,
            setActiveThreadId,
            list,
            nextThread,
          );
        } catch (e2) {
          try {
            const { data: row2, error: error2 } = await supabase
              .from("conversations")
              .insert({ title: titleFallback } as any)
              .select(THREAD_SELECT_NO_UPDATED)
              .single();

            if (error2 || !row2?.id) {
              if (isMissingColumnError(error2)) {
                const { data: row3, error: error3 } = await supabase
                  .from("conversations")
                  .insert({ title: titleFallback } as any)
                  .select(THREAD_SELECT_MIN_NO_UPDATED)
                  .single();

                if (error3 || !row3?.id) {
                  return failEnsureThread(
                    setThreads,
                    list,
                    normMsg(error3 ?? error2 ?? e2 ?? eUpsert),
                  );
                }

                const nextThread = normalizeThreadRow(row3, titleFallback, {
                  preferNowIfMissingUpdated: true,
                  bumpNowForEventIfMissingUpdated: true,
                });

                return commitActiveThread(
                  setThreads,
                  setActiveThreadId,
                  list,
                  nextThread,
                );
              }

              return failEnsureThread(
                setThreads,
                list,
                normMsg(error2 ?? e2 ?? eUpsert),
              );
            }

            const nextThread = normalizeThreadRow(row2, titleFallback, {
              preferNowIfMissingUpdated: true,
              bumpNowForEventIfMissingUpdated: true,
            });

            return commitActiveThread(
              setThreads,
              setActiveThreadId,
              list,
              nextThread,
            );
          } catch (e3) {
            return failEnsureThread(
              setThreads,
              list,
              normMsg(e3 ?? e2 ?? eUpsert),
            );
          }
        }
      }
    }
  };

  const p = (async () => {
    try {
      return await doCreate();
    } finally {
      inFlightByKey.delete(key);
      microtask(() => {
        inFlightByKey.delete(key);
      });
    }
  })();

  inFlightByKey.set(key, { at: Date.now(), promise: p });

  return await p;
}

/*
このファイルの正式役割
active にする thread を決め、必要時だけ conversations へ新規作成し、
一覧先頭反映と activeThreadId 保存までを担当する接続ファイル。
本文取得や本文表示の責務は持たない。

【今回このファイルで修正したこと】
1. 新規作成成功時の「一覧先頭反映 + activeThreadId保存 + 成功返却」を commitActiveThread に一本化しました。
2. 失敗時の「既存list復元 + 失敗返却」を failEnsureThread に一本化しました。
3. 各 fallback の分岐順、auth待機、in-flight 制御、DB insert/upsert 方針、normalizeThreadRow の意味は触っていません。
*/

/* /components/chat/lib/threadApiEnsureActiveThread.ts */