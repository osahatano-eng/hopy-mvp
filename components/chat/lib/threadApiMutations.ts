// /components/chat/lib/threadApiMutations.ts
"use client";

import type { SupabaseClient } from "@supabase/supabase-js";

import type { Thread } from "./chatTypes";
import { loadActiveThreadId, clearActiveThreadId } from "./threadStore";

import { logWarn, normMsg } from "./threadApiSupport";
import {
  isAuthNotReadyError,
  isMissingColumnError,
  isNoRowsSingleError,
} from "./threadApiErrors";
import {
  THREAD_SELECT_FULL,
  THREAD_SELECT_MIN,
  THREAD_SELECT_MIN_NO_UPDATED,
  THREAD_SELECT_NO_UPDATED,
  normalizeThreadRow,
} from "./threadApiNormalize";

type ThreadMutationResult =
  | { ok: true; thread: Thread }
  | { ok: false; thread: null; error: string };

function normalizeMutationThread(row: any, titleFallback: string): Thread {
  return normalizeThreadRow(row, titleFallback, {
    preferNowIfMissingUpdated: true,
    bumpNowForEventIfMissingUpdated: true,
  });
}

/**
 * ✅ チャットごとの思考状態（state_level / current_phase）を更新する
 * - UIから「思考状態：混線/模索/...」の変更を保存するための配線
 * - updated_at は DB trigger に任せる（ここでは送らない）
 */
export async function updateThreadStateLevel(args: {
  supabase: SupabaseClient;
  threadId: string;
  stateLevel: number;
}): Promise<ThreadMutationResult> {
  const tid = String(args.threadId ?? "").trim();
  if (!tid) return { ok: false, thread: null, error: "thread_id_empty" };

  const level = Number(args.stateLevel);
  if (!Number.isFinite(level) || level <= 0) {
    return { ok: false, thread: null, error: "invalid_state_level" };
  }

  try {
    const { data, error } = await args.supabase
      .from("conversations")
      .update({ state_level: level, current_phase: level })
      .eq("id", tid)
      .select(THREAD_SELECT_FULL)
      .maybeSingle();

    if (error) {
      if (isMissingColumnError(error)) {
        const { data: data2, error: error2 } = await args.supabase
          .from("conversations")
          .update({ state_level: level, current_phase: level })
          .eq("id", tid)
          .select(THREAD_SELECT_MIN)
          .maybeSingle();

        if (error2) {
          if (isNoRowsSingleError(error2)) {
            return { ok: false, thread: null, error: "not_found" };
          }
          return { ok: false, thread: null, error: normMsg(error2) };
        }

        if (!data2?.id) {
          return { ok: false, thread: null, error: "not_found" };
        }

        const titleFallback =
          String((data2 as any)?.title ?? "").trim() || "New chat";

        return {
          ok: true,
          thread: normalizeMutationThread(data2, titleFallback),
        };
      }

      if (isNoRowsSingleError(error)) {
        return { ok: false, thread: null, error: "not_found" };
      }

      return { ok: false, thread: null, error: normMsg(error) };
    }

    if (!data?.id) {
      return { ok: false, thread: null, error: "not_found" };
    }

    const titleFallback =
      String((data as any)?.title ?? "").trim() || "New chat";

    return {
      ok: true,
      thread: normalizeMutationThread(data, titleFallback),
    };
  } catch (e) {
    return { ok: false, thread: null, error: normMsg(e) };
  }
}

type RenameResult =
  | { ok: true; thread: Thread }
  | { ok: false; thread: null; error: string };

async function fetchThreadByIdPreferUpdated(args: {
  supabase: SupabaseClient;
  threadId: string;
  titleFallback: string;
}): Promise<{ ok: true; thread: Thread } | { ok: false; error: string }> {
  const tid = String(args.threadId ?? "").trim();
  if (!tid) return { ok: false, error: "thread_id_empty" };

  try {
    const { data, error } = await args.supabase
      .from("conversations")
      .select(THREAD_SELECT_FULL)
      .eq("id", tid)
      .maybeSingle();

    if (error) {
      if (isNoRowsSingleError(error)) return { ok: false, error: "not_found" };
      if (isMissingColumnError(error)) throw error;
      return { ok: false, error: normMsg(error) };
    }

    if (!data?.id) return { ok: false, error: "not_found" };

    return {
      ok: true,
      thread: normalizeThreadRow(data, args.titleFallback, {
        preferNowIfMissingUpdated: true,
      }),
    };
  } catch (e) {
    try {
      const { data, error } = await args.supabase
        .from("conversations")
        .select(THREAD_SELECT_MIN)
        .eq("id", tid)
        .maybeSingle();

      if (error) {
        if (isNoRowsSingleError(error)) return { ok: false, error: "not_found" };
        if (isMissingColumnError(error)) throw error;
        return { ok: false, error: normMsg(error) };
      }

      if (!data?.id) return { ok: false, error: "not_found" };

      return {
        ok: true,
        thread: normalizeThreadRow(data, args.titleFallback, {
          preferNowIfMissingUpdated: true,
        }),
      };
    } catch {
      try {
        const { data, error } = await args.supabase
          .from("conversations")
          .select(THREAD_SELECT_NO_UPDATED)
          .eq("id", tid)
          .maybeSingle();

        if (error) {
          if (isNoRowsSingleError(error)) {
            return { ok: false, error: "not_found" };
          }
          if (isMissingColumnError(error)) throw error;
          return { ok: false, error: normMsg(error) };
        }

        if (!data?.id) return { ok: false, error: "not_found" };

        return {
          ok: true,
          thread: normalizeThreadRow(data, args.titleFallback, {
            preferNowIfMissingUpdated: true,
          }),
        };
      } catch (e2) {
        try {
          const { data, error } = await args.supabase
            .from("conversations")
            .select(THREAD_SELECT_MIN_NO_UPDATED)
            .eq("id", tid)
            .maybeSingle();

          if (error) {
            if (isNoRowsSingleError(error)) {
              return { ok: false, error: "not_found" };
            }
            return { ok: false, error: normMsg(error) };
          }

          if (!data?.id) return { ok: false, error: "not_found" };

          return {
            ok: true,
            thread: normalizeThreadRow(data, args.titleFallback, {
              preferNowIfMissingUpdated: true,
            }),
          };
        } catch (e3) {
          return { ok: false, error: normMsg(e3 ?? e2 ?? e) };
        }
      }
    }
  }
}

async function readThreadTitleRawById(args: {
  supabase: SupabaseClient;
  threadId: string;
}): Promise<{ ok: true; title: string } | { ok: false; error: string }> {
  const tid = String(args.threadId ?? "").trim();
  if (!tid) return { ok: false, error: "thread_id_empty" };

  try {
    const { data, error } = await args.supabase
      .from("conversations")
      .select("id, title")
      .eq("id", tid)
      .maybeSingle();

    if (error) {
      if (isNoRowsSingleError(error)) return { ok: false, error: "not_found" };
      if (isAuthNotReadyError(error)) {
        return { ok: false, error: "auth_not_ready" };
      }
      return { ok: false, error: normMsg(error) };
    }

    if (!data?.id) return { ok: false, error: "not_found" };

    const title = String((data as any)?.title ?? "").trim();
    return { ok: true, title };
  } catch (e) {
    return { ok: false, error: normMsg(e) };
  }
}

/**
 * ✅ PhaseB: スレッド名変更（DBへ保存）
 */
export async function renameThread(args: {
  supabase: SupabaseClient;
  threadId: string;
  nextTitle: string;
}): Promise<RenameResult> {
  const tid = String(args.threadId ?? "").trim();
  const title = String(args.nextTitle ?? "").trim();

  if (!tid) return { ok: false, thread: null, error: "thread_id_empty" };
  if (!title) return { ok: false, thread: null, error: "title_empty" };

  const safeTitle = title.length > 120 ? title.slice(0, 120) : title;

  try {
    const q = args.supabase
      .from("conversations")
      .update({
        title: safeTitle,
      })
      .eq("id", tid)
      .select(THREAD_SELECT_FULL);

    const { data: row, error } = await (q as any).maybeSingle();

    if (error) {
      if (isNoRowsSingleError(error)) {
      } else if (isMissingColumnError(error)) {
        throw error;
      } else {
        return { ok: false, thread: null, error: normMsg(error) };
      }
    }

    if (row?.id) {
      const thread = normalizeThreadRow(row, safeTitle, {
        preferNowIfMissingUpdated: true,
        bumpNowForEventIfMissingUpdated: true,
      });
      return { ok: true, thread };
    }

    const raw = await readThreadTitleRawById({
      supabase: args.supabase,
      threadId: tid,
    });

    if (raw.ok) {
      if (String(raw.title).trim() !== String(safeTitle).trim()) {
        return { ok: false, thread: null, error: "rename_not_persisted" };
      }

      const reread = await fetchThreadByIdPreferUpdated({
        supabase: args.supabase,
        threadId: tid,
        titleFallback: safeTitle,
      });
      if (reread.ok) return { ok: true, thread: reread.thread };

      const out = normalizeThreadRow(
        { id: tid, title: safeTitle },
        safeTitle,
        {
          preferNowIfMissingUpdated: true,
          bumpNowForEventIfMissingUpdated: true,
        },
      );
      return { ok: true, thread: out };
    }

    return { ok: false, thread: null, error: raw.error || "rename_failed" };
  } catch (e) {
    return { ok: false, thread: null, error: normMsg(e) };
  }
}

type DeleteResult = { ok: true } | { ok: false; error: string };

async function deleteMessagesByThreadId(args: {
  supabase: SupabaseClient;
  threadId: string;
}): Promise<void> {
  const tid = String(args.threadId ?? "").trim();
  if (!tid) return;

  const run = async (fk: "conversation_id" | "thread_id") => {
    return await args.supabase.from("messages").delete().eq(fk, tid);
  };

  try {
    const { error } = await run("conversation_id");
    if (!error) return;

    if (isMissingColumnError(error)) {
      const r2 = await run("thread_id");
      if (r2.error) {
        throw r2.error;
      }
      return;
    }

    throw error;
  } catch (e) {
    try {
      const r3 = await run("thread_id");
      if (r3.error) throw r3.error;
    } catch (e2) {
      throw e2 ?? e;
    }
  }
}

const DELETE_THREAD_AUTH_RETRY_COUNT = 5;

/**
 * ✅ PhaseB: スレッド削除（DB）
 */
export async function deleteThread(args: {
  supabase: SupabaseClient;
  threadId: string;
}): Promise<DeleteResult> {
  const tid = String(args.threadId ?? "").trim();
  if (!tid) return { ok: false, error: "thread_id_empty" };

  const attemptOnce = async (): Promise<DeleteResult> => {
    try {
      try {
        await deleteMessagesByThreadId({
          supabase: args.supabase,
          threadId: tid,
        });
      } catch (eMsg) {
        logWarn("[threadApi] deleteThread: messages delete failed (continue)", {
          threadId: tid,
          reason: normMsg(eMsg),
        });
      }

      const { error } = await args.supabase
        .from("conversations")
        .delete()
        .eq("id", tid);

      if (error) {
        if (isAuthNotReadyError(error)) {
          return { ok: false, error: "auth_not_ready" };
        }

        if (!isNoRowsSingleError(error)) {
          return { ok: false, error: normMsg(error) };
        }
      }

      try {
        const saved = String(loadActiveThreadId() ?? "").trim();
        if (saved && saved === tid) {
          clearActiveThreadId();
        }
      } catch {}

      return { ok: true };
    } catch (e) {
      if (isAuthNotReadyError(e)) {
        return { ok: false, error: "auth_not_ready" };
      }
      return { ok: false, error: normMsg(e) };
    }
  };

  let last: DeleteResult = { ok: false, error: "thread_delete_failed" };

  for (let i = 0; i < DELETE_THREAD_AUTH_RETRY_COUNT; i++) {
    last = await attemptOnce();

    if (last.ok) return last;
    if (String((last as any)?.error ?? "") !== "auth_not_ready") {
      return last;
    }
  }

  return last;
}

/*
このファイルの正式役割
thread の更新系入口をまとめるファイル。
state更新、rename、delete を DB に反映し、必要な最小結果だけを返す。
本文取得や本文表示の責務は持たない。

【今回このファイルで修正したこと】
1. deleteThread に残っていた未使用の delays 配列と説明コメントを削除しました。
2. auth_not_ready の再試行回数だけを DELETE_THREAD_AUTH_RETRY_COUNT に明示し、実際の挙動をそのままで読み筋だけを単純化しました。
3. updateThreadStateLevel、renameThread、deleteMessagesByThreadId の意味とDB更新順は触っていません。
*/

/* /components/chat/lib/threadApiMutations.ts */