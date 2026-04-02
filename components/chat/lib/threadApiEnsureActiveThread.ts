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

export type EnsureResult = { ok: true; id: string } | { ok: false; id: null; error: string };

function applySetThreads(
  setThreads: Dispatch<SetStateAction<Thread[]>>,
  next: Thread[] | ((prev: Thread[]) => Thread[])
) {
  try {
    setThreads(next as any);
  } catch {}
}

// ✅ init/復旧経路で「古い list で UI を巻き戻す」のを防ぐ：prev が空の時だけ反映
function applySetThreadsIfEmpty(setThreads: Dispatch<SetStateAction<Thread[]>>, list: Thread[]) {
  try {
    setThreads((prev) => {
      const p = Array.isArray(prev) ? prev : [];
      if (p.length > 0) return p;
      return Array.isArray(list) ? list : [];
    });
  } catch {}
}

// ✅ 重要：in-flight は “完了まで” 束ねる。ただしキー（clientRequestId）ごとに束ねる
type InFlightEntry = { at: number; promise: Promise<EnsureResult> };
const inFlightByKey = new Map<string, InFlightEntry>();

// ✅ 事故対策：異常に長い in-flight は破棄して再作成できるようにする
const CREATE_INFLIGHT_MAX_MS = 60_000;

// ✅ PhaseC: useChatInit から型安全に渡すため、引数型を公開する
export type EnsureActiveThreadArgs = {
  supabase: SupabaseClient;
  list: Thread[];
  uiLang: Lang;
  setActiveThreadId: (id: string | null) => void;
  setThreads: Dispatch<SetStateAction<Thread[]>>;

  /**
   * ✅ PhaseB: 「新規チャット」ボタン等からの明示的な新規作成
   * - true の時は saved/先頭採用をスキップし、必ず insert する
   */
  forceCreate?: boolean;

  /**
   * ✅ PhaseC: 新規作成の冪等化キー（クライアント起点）
   * - 同一クリック（同一操作）内では同じIDを渡す（完了まで保持）
   * - 未指定なら内部生成（従来互換）
   */
  clientRequestId?: string;
};

export async function ensureActiveThread(args: EnsureActiveThreadArgs): Promise<EnsureResult> {
  const { supabase, list, uiLang, setActiveThreadId, setThreads, forceCreate } = args;

  // ✅ 受け取ったlistは“候補”として扱う（init/復旧で古いlistが来ても UI を巻き戻さない）
  applySetThreadsIfEmpty(setThreads, list);

  const saved = loadActiveThreadId();

  // 1) localStorage の id があれば採用（ただし forceCreate の時は採用しない）
  // - list の照合は “あるならチェック” に留め、list が空でも復旧できるようにする
  if (!forceCreate && saved) {
    if (!Array.isArray(list) || list.length === 0) {
      setActiveThreadId(saved);
      saveActiveThreadId(saved);
      return { ok: true, id: saved };
    }
    if (list.some((t) => String((t as any)?.id ?? "").trim() === String(saved).trim())) {
      setActiveThreadId(saved);
      saveActiveThreadId(saved);
      return { ok: true, id: saved };
    }
  }

  // 2) list があるなら先頭を採用（ただし forceCreate の時は採用しない）
  if (!forceCreate && Array.isArray(list) && list.length > 0) {
    const id = String((list[0] as any)?.id ?? "").trim();
    if (id) {
      setActiveThreadId(id);
      saveActiveThreadId(id);
      return { ok: true, id };
    }
  }

  // 3) 新規作成（0件 or forceCreate）
  const titleFallback = uiLang === "en" ? "New chat" : "新規チャット";

  // ✅ 同一「新規作成操作」内で DB 冪等化するためのキー
  const clientRequestId = String(args.clientRequestId ?? "").trim() || safeUUID();
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
      applySetThreads(setThreads, (prev) => (Array.isArray(prev) && prev.length > 0 ? prev : list));
      return { ok: false, id: null, error: "auth_not_ready" };
    }

    const preExisting = await tryReadBackByClientRequestId();
    if (preExisting?.id) {
      const nextId = String((preExisting as any)?.id ?? "").trim();

      applySetThreads(setThreads, (prev) => {
        const base = Array.isArray(prev) && prev.length > 0 ? prev : list;
        const filtered = base.filter((t) => String((t as any)?.id ?? "").trim() !== nextId);
        return [preExisting, ...filtered];
      });

      setActiveThreadId(nextId);
      saveActiveThreadId(nextId);
      return { ok: true, id: nextId };
    }

    // 1) upsert（冪等化）
    try {
      const { data: rowU, error: errorU } = await supabase
        .from("conversations")
        .upsert(
          { title: titleFallback, client_request_id: clientRequestId } as any,
          {
            onConflict: "user_id,client_request_id",
            ignoreDuplicates: false,
          } as any
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
            const nextId = String((existed as any)?.id ?? "").trim();

            applySetThreads(setThreads, (prev) => {
              const base = Array.isArray(prev) && prev.length > 0 ? prev : list;
              const filtered = base.filter((t) => String((t as any)?.id ?? "").trim() !== nextId);
              return [existed, ...filtered];
            });

            setActiveThreadId(nextId);
            saveActiveThreadId(nextId);
            return { ok: true, id: nextId };
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

      const nextId = String((nextThread as any)?.id ?? "").trim();
      applySetThreads(setThreads, (prev) => {
        const base = Array.isArray(prev) && prev.length > 0 ? prev : list;
        const filtered = base.filter((t) => String((t as any)?.id ?? "").trim() !== nextId);
        return [nextThread, ...filtered];
      });

      setActiveThreadId(nextId);
      saveActiveThreadId(nextId);

      return { ok: true, id: nextId };
    } catch (eUpsert) {
      // 2) insert（互換）
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
            const nextId = String((existed as any)?.id ?? "").trim();

            applySetThreads(setThreads, (prev) => {
              const base = Array.isArray(prev) && prev.length > 0 ? prev : list;
              const filtered = base.filter((t) => String((t as any)?.id ?? "").trim() !== nextId);
              return [existed, ...filtered];
            });

            setActiveThreadId(nextId);
            saveActiveThreadId(nextId);
            return { ok: true, id: nextId };
          }

          const msg = normMsg(error);

          applySetThreads(setThreads, (prev) => (Array.isArray(prev) && prev.length > 0 ? prev : list));

          return { ok: false, id: null, error: msg };
        }

        const nextThread = normalizeThreadRow(row, titleFallback, {
          preferNowIfMissingUpdated: true,
          bumpNowForEventIfMissingUpdated: true,
        });

        const nextId = String((nextThread as any)?.id ?? "").trim();
        applySetThreads(setThreads, (prev) => {
          const base = Array.isArray(prev) && prev.length > 0 ? prev : list;
          const filtered = base.filter((t) => String((t as any)?.id ?? "").trim() !== nextId);
          return [nextThread, ...filtered];
        });

        setActiveThreadId(nextId);
        saveActiveThreadId(nextId);

        return { ok: true, id: nextId };
      } catch (e) {
        // 2-2) client_request_id / current系 列が無い等 → title のみ insert
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
                  const msg = normMsg(error2);

                  applySetThreads(setThreads, (prev) => (Array.isArray(prev) && prev.length > 0 ? prev : list));

                  return { ok: false, id: null, error: msg };
                }

                const nextThread = normalizeThreadRow(row2, titleFallback, {
                  preferNowIfMissingUpdated: true,
                  bumpNowForEventIfMissingUpdated: true,
                });

                const nextId = String((nextThread as any)?.id ?? "").trim();
                applySetThreads(setThreads, (prev) => {
                  const base = Array.isArray(prev) && prev.length > 0 ? prev : list;
                  const filtered = base.filter((t) => String((t as any)?.id ?? "").trim() !== nextId);
                  return [nextThread, ...filtered];
                });

                setActiveThreadId(nextId);
                saveActiveThreadId(nextId);

                return { ok: true, id: nextId };
              } catch (eMin) {
                throw eMin;
              }
            }
            if (isAuthNotReadyError(error)) {
              return { ok: false, id: null, error: "auth_not_ready" };
            }
            const msg = normMsg(error);

            applySetThreads(setThreads, (prev) => (Array.isArray(prev) && prev.length > 0 ? prev : list));

            return { ok: false, id: null, error: msg };
          }

          const nextThread = normalizeThreadRow(row, titleFallback, {
            preferNowIfMissingUpdated: true,
            bumpNowForEventIfMissingUpdated: true,
          });

          const nextId = String((nextThread as any)?.id ?? "").trim();
          applySetThreads(setThreads, (prev) => {
            const base = Array.isArray(prev) && prev.length > 0 ? prev : list;
            const filtered = base.filter((t) => String((t as any)?.id ?? "").trim() !== nextId);
            return [nextThread, ...filtered];
          });

          setActiveThreadId(nextId);
          saveActiveThreadId(nextId);

          return { ok: true, id: nextId };
        } catch (e2) {
          // 3) updated_at 無し環境（created_at 等）でも作れるようにフォールバック
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
                  const msg = normMsg(error3 ?? error2 ?? e2 ?? eUpsert);

                  applySetThreads(setThreads, (prev) => (Array.isArray(prev) && prev.length > 0 ? prev : list));

                  return { ok: false, id: null, error: msg };
                }

                const nextThread = normalizeThreadRow(row3, titleFallback, {
                  preferNowIfMissingUpdated: true,
                  bumpNowForEventIfMissingUpdated: true,
                });

                const nextId = String((nextThread as any)?.id ?? "").trim();
                applySetThreads(setThreads, (prev) => {
                  const base = Array.isArray(prev) && prev.length > 0 ? prev : list;
                  const filtered = base.filter((t) => String((t as any)?.id ?? "").trim() !== nextId);
                  return [nextThread, ...filtered];
                });

                setActiveThreadId(nextId);
                saveActiveThreadId(nextId);

                return { ok: true, id: nextId };
              }

              const msg = normMsg(error2 ?? e2 ?? eUpsert);

              applySetThreads(setThreads, (prev) => (Array.isArray(prev) && prev.length > 0 ? prev : list));

              return { ok: false, id: null, error: msg };
            }

            const nextThread = normalizeThreadRow(row2, titleFallback, {
              preferNowIfMissingUpdated: true,
              bumpNowForEventIfMissingUpdated: true,
            });

            const nextId = String((nextThread as any)?.id ?? "").trim();
            applySetThreads(setThreads, (prev) => {
              const base = Array.isArray(prev) && prev.length > 0 ? prev : list;
              const filtered = base.filter((t) => String((t as any)?.id ?? "").trim() !== nextId);
              return [nextThread, ...filtered];
            });

            setActiveThreadId(nextId);
            saveActiveThreadId(nextId);

            return { ok: true, id: nextId };
          } catch (e3) {
            const msg = normMsg(e3 ?? e2 ?? eUpsert);

            applySetThreads(setThreads, (prev) => (Array.isArray(prev) && prev.length > 0 ? prev : list));

            return { ok: false, id: null, error: msg };
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