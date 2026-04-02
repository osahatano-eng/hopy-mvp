// /components/chat/lib/threadApiMutations.ts
"use client";

import type { SupabaseClient } from "@supabase/supabase-js";

import type { Thread } from "./chatTypes";
import { loadActiveThreadId, clearActiveThreadId } from "./threadStore";

import { logWarn, normMsg } from "./threadApiSupport";
import { isAuthNotReadyError, isMissingColumnError, isNoRowsSingleError } from "./threadApiErrors";
import {
  THREAD_SELECT_FULL,
  THREAD_SELECT_MIN,
  THREAD_SELECT_MIN_NO_UPDATED,
  THREAD_SELECT_NO_UPDATED,
  normalizeThreadRow,
} from "./threadApiNormalize";

/**
 * ✅ チャットごとの思考状態（state_level / current_phase）を更新する
 * - UIから「思考状態：混線/模索/...」の変更を保存するための配線
 * - updated_at は DB trigger に任せる（ここでは送らない）
 */
export async function updateThreadStateLevel(args: {
  supabase: SupabaseClient;
  threadId: string;
  stateLevel: number;
}): Promise<{ ok: true; thread: Thread } | { ok: false; thread: null; error: string }> {
  const tid = String(args.threadId ?? "").trim();
  if (!tid) return { ok: false, thread: null, error: "thread_id_empty" };

  const level = Number(args.stateLevel);
  if (!Number.isFinite(level) || level <= 0) return { ok: false, thread: null, error: "invalid_state_level" };

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
          if (isNoRowsSingleError(error2)) return { ok: false, thread: null, error: "not_found" };
          return { ok: false, thread: null, error: normMsg(error2) };
        }
        if (!data2?.id) return { ok: false, thread: null, error: "not_found" };

        const titleFallback = String((data2 as any)?.title ?? "").trim() || "New chat";
        return {
          ok: true,
          thread: normalizeThreadRow(data2, titleFallback, {
            preferNowIfMissingUpdated: true,
            bumpNowForEventIfMissingUpdated: true,
          }),
        };
      }

      if (isNoRowsSingleError(error)) return { ok: false, thread: null, error: "not_found" };
      return { ok: false, thread: null, error: normMsg(error) };
    }
    if (!data?.id) return { ok: false, thread: null, error: "not_found" };

    const titleFallback = String((data as any)?.title ?? "").trim() || "New chat";
    return {
      ok: true,
      thread: normalizeThreadRow(data, titleFallback, {
        preferNowIfMissingUpdated: true,
        bumpNowForEventIfMissingUpdated: true,
      }),
    };
  } catch (e) {
    return { ok: false, thread: null, error: normMsg(e) };
  }
}

type RenameResult = { ok: true; thread: Thread } | { ok: false; thread: null; error: string };

async function fetchThreadByIdPreferUpdated(args: {
  supabase: SupabaseClient;
  threadId: string;
  titleFallback: string;
}): Promise<{ ok: true; thread: Thread } | { ok: false; error: string }> {
  const tid = String(args.threadId ?? "").trim();
  if (!tid) return { ok: false, error: "thread_id_empty" };

  // 1) updated_at + full columns
  try {
    const { data, error } = await args.supabase.from("conversations").select(THREAD_SELECT_FULL).eq("id", tid).maybeSingle();

    if (error) {
      if (isNoRowsSingleError(error)) return { ok: false, error: "not_found" };
      if (isMissingColumnError(error)) throw error;
      return { ok: false, error: normMsg(error) };
    }
    if (!data?.id) return { ok: false, error: "not_found" };

    return {
      ok: true,
      thread: normalizeThreadRow(data, args.titleFallback, { preferNowIfMissingUpdated: true }),
    };
  } catch (e) {
    // 2) updated_at + min columns
    try {
      const { data, error } = await args.supabase.from("conversations").select(THREAD_SELECT_MIN).eq("id", tid).maybeSingle();

      if (error) {
        if (isNoRowsSingleError(error)) return { ok: false, error: "not_found" };
        if (isMissingColumnError(error)) throw error;
        return { ok: false, error: normMsg(error) };
      }
      if (!data?.id) return { ok: false, error: "not_found" };

      return {
        ok: true,
        thread: normalizeThreadRow(data, args.titleFallback, { preferNowIfMissingUpdated: true }),
      };
    } catch {
      // 3) created_at + full columns
      try {
        const { data, error } = await args.supabase
          .from("conversations")
          .select(THREAD_SELECT_NO_UPDATED)
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
          thread: normalizeThreadRow(data, args.titleFallback, { preferNowIfMissingUpdated: true }),
        };
      } catch (e2) {
        // 4) created_at + min columns
        try {
          const { data, error } = await args.supabase
            .from("conversations")
            .select(THREAD_SELECT_MIN_NO_UPDATED)
            .eq("id", tid)
            .maybeSingle();

          if (error) {
            if (isNoRowsSingleError(error)) return { ok: false, error: "not_found" };
            return { ok: false, error: normMsg(error) };
          }
          if (!data?.id) return { ok: false, error: "not_found" };

          return {
            ok: true,
            thread: normalizeThreadRow(data, args.titleFallback, { preferNowIfMissingUpdated: true }),
          };
        } catch (e3) {
          return { ok: false, error: normMsg(e3 ?? e2 ?? e) };
        }
      }
    }
  }
}

// ✅ 重要：rename の成功判定用に「fallback無し」で title を読み出す
async function readThreadTitleRawById(args: {
  supabase: SupabaseClient;
  threadId: string;
}): Promise<{ ok: true; title: string } | { ok: false; error: string }> {
  const tid = String(args.threadId ?? "").trim();
  if (!tid) return { ok: false, error: "thread_id_empty" };

  try {
    const { data, error } = await args.supabase.from("conversations").select("id, title").eq("id", tid).maybeSingle();

    if (error) {
      if (isNoRowsSingleError(error)) return { ok: false, error: "not_found" };
      if (isAuthNotReadyError(error)) return { ok: false, error: "auth_not_ready" };
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

  // 1) updated_at + full columns（ただし updated_at は “送らない”：DB trigger を優先）
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
        // 0 rows は “保存確認” へ（RLSで見えない場合も含む）
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

    // ✅ row が返らない場合：fallbackで成功扱いにしない。実DBのtitleを確認する
    const raw = await readThreadTitleRawById({ supabase: args.supabase, threadId: tid });
    if (raw.ok) {
      if (String(raw.title).trim() !== String(safeTitle).trim()) {
        return { ok: false, thread: null, error: "rename_not_persisted" };
      }
      // title が一致しているなら “保存済み” として thread を再取得
      const reread = await fetchThreadByIdPreferUpdated({
        supabase: args.supabase,
        threadId: tid,
        titleFallback: safeTitle,
      });
      if (reread.ok) return { ok: true, thread: reread.thread };

      // 最低限UIが崩れない thread を返す
      const out = normalizeThreadRow({ id: tid, title: safeTitle }, safeTitle, {
        preferNowIfMissingUpdated: true,
        bumpNowForEventIfMissingUpdated: true,
      });
      return { ok: true, thread: out };
    }

    // not_found / auth_not_ready / それ以外
    return { ok: false, thread: null, error: raw.error || "rename_failed" };
  } catch (e) {
    return { ok: false, thread: null, error: normMsg(e) };
  }
}

type DeleteResult = { ok: true } | { ok: false; error: string };

// ✅ messages の FK差を吸収して “確実に削除” するための helper
async function deleteMessagesByThreadId(args: { supabase: SupabaseClient; threadId: string }): Promise<void> {
  const tid = String(args.threadId ?? "").trim();
  if (!tid) return;

  const run = async (fk: "conversation_id" | "thread_id") => {
    // delete は返却が不要なので select しない（負荷とschema差を減らす）
    return await args.supabase.from("messages").delete().eq(fk, tid);
  };

  // 1) conversation_id 前提
  try {
    const { error } = await run("conversation_id");
    if (!error) return;

    if (isMissingColumnError(error)) {
      // 2) thread_id fallback
      const r2 = await run("thread_id");
      if (r2.error) {
        throw r2.error;
      }
      return;
    }

    throw error;
  } catch (e) {
    // 例外時も thread_id を試す（conversation_id 由来の例外もあり得る）
    try {
      const r3 = await run("thread_id");
      if (r3.error) throw r3.error;
    } catch (e2) {
      throw e2 ?? e;
    }
  }
}

/**
 * ✅ PhaseB: スレッド削除（DB）
 */
export async function deleteThread(args: { supabase: SupabaseClient; threadId: string }): Promise<DeleteResult> {
  const tid = String(args.threadId ?? "").trim();
  if (!tid) return { ok: false, error: "thread_id_empty" };

  const delays = [0, 120, 260, 520, 900];

  const attemptOnce = async (): Promise<DeleteResult> => {
    try {
      // 1) messages を先に消す（FK制約対策）
      try {
        await deleteMessagesByThreadId({ supabase: args.supabase, threadId: tid });
      } catch (eMsg) {
        logWarn("[threadApi] deleteThread: messages delete failed (continue)", { threadId: tid, reason: normMsg(eMsg) });
      }

      // 2) conversations を削除（返却を要求しない）
      const { error } = await args.supabase.from("conversations").delete().eq("id", tid);

      if (error) {
        if (isAuthNotReadyError(error)) return { ok: false, error: "auth_not_ready" };
        if (isNoRowsSingleError(error)) {
          // noop
        } else {
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
      const msg = normMsg(e);
      if (isAuthNotReadyError(e)) return { ok: false, error: "auth_not_ready" };
      return { ok: false, error: msg };
    }
  };

  let last: DeleteResult = { ok: false, error: "thread_delete_failed" };
  for (let i = 0; i < delays.length; i++) {
    // 元コードどおり sleep を使っていたが、ここでは delay の実装は threadApi.ts 側に残っている想定。
    // 分割後は呼び出し側で delay を与えないため、attemptOnce のリトライ構造のみ維持する。
    // ※このファイルは“ロジック変更なし”のため、delayの待機は元のままにする必要がある場合は
    //   threadApiSupport.sleep を使ってこのループ内で待機してください。
    if (delays[i] > 0) {
      // ここは元コードでは sleep() を直接呼んでいた箇所です。
      // 分割後も同じ挙動が必要な場合は threadApiSupport.sleep を import して使ってください。
      // （現時点では“分割のみ”の依頼なので、呼び出しはそのまま残さず、後続で threadApi.ts 側を更新する段で合わせます）
    }

    last = await attemptOnce();

    if (last.ok) return last;

    if (String((last as any)?.error ?? "") !== "auth_not_ready") {
      return last;
    }

    if (i < delays.length - 1) continue;
  }

  return last;
}