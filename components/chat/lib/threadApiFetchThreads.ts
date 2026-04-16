// /components/chat/lib/threadApiFetchThreads.ts
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Lang, Thread } from "./chatTypes";

import { normMsg } from "./threadApiSupport";
import {
  isAuthNotReadyError,
  isMissingColumnError,
  isTransientAuthOrNetworkError,
  isUpdatedAtUnsupportedError,
} from "./threadApiErrors";
import {
  getUpdatedAtUnsupportedCached,
  setUpdatedAtUnsupportedCached,
} from "./threadApiSchemaCache";
import { normalizeThreadRow } from "./threadApiNormalize";
import { waitForAuthReady } from "./threadApiAuth";

export type ThreadsResult =
  | { ok: true; list: Thread[] }
  | { ok: false; list: Thread[]; error: string };

const CONV_SELECT_WITH_UPDATED =
  "id,user_id,title,created_at,updated_at,state_level,client_request_id,current_phase";
const CONV_SELECT_NO_UPDATED =
  "id,user_id,title,created_at,state_level,client_request_id,current_phase";

const PAGE_SIZE = 100;

async function sleep(ms: number) {
  if (!Number.isFinite(ms) || ms <= 0) return;
  await new Promise<void>((resolve) => setTimeout(resolve, ms));
}

async function fetchAllOrdered(
  supabase: SupabaseClient,
  selectColumns: string,
  orderColumn: "updated_at" | "created_at",
) {
  const rows: any[] = [];
  let from = 0;

  for (;;) {
    const to = from + PAGE_SIZE - 1;

    const { data, error } = await supabase
      .from("conversations")
      .select(selectColumns)
      .order(orderColumn, { ascending: false })
      .range(from, to);

    if (error) {
      return { ok: false as const, data: [] as any[], error };
    }

    const chunk = Array.isArray(data) ? data : [];
    rows.push(...chunk);

    if (chunk.length < PAGE_SIZE) {
      return { ok: true as const, data: rows };
    }

    from += PAGE_SIZE;
  }
}

function mapRowsToThreads(rows: any[], titleFallback: string): Thread[] {
  return (Array.isArray(rows) ? rows : [])
    .map((r: any) =>
      normalizeThreadRow(r, titleFallback, {
        preferNowIfMissingUpdated: false,
      }),
    )
    .filter((t) => String((t as any)?.id ?? "").trim().length > 0) as Thread[];
}

export async function fetchThreads(
  supabase: SupabaseClient,
  uiLang?: Lang,
): Promise<ThreadsResult> {
  const titleFallback = uiLang === "ja" ? "新規チャット" : "New chat";

  const runOnceUpdated = async () => {
    return await fetchAllOrdered(
      supabase,
      CONV_SELECT_WITH_UPDATED,
      "updated_at",
    );
  };

  const runOnceCreated = async () => {
    return await fetchAllOrdered(
      supabase,
      CONV_SELECT_NO_UPDATED,
      "created_at",
    );
  };

  const delays = [0, 120, 260, 520];
  const skipUpdatedAtRoutes = getUpdatedAtUnsupportedCached();

  if (!skipUpdatedAtRoutes) {
    for (let i = 0; i < delays.length; i++) {
      if (delays[i] > 0) {
        await sleep(delays[i]);
      }

      const auth = await waitForAuthReady(supabase);
      if (!auth.ok) {
        if (i < delays.length - 1) continue;
        return { ok: false, list: [], error: "auth_not_ready" };
      }

      try {
        const result = await runOnceUpdated();

        if (!result.ok) {
          const error = result.error;

          if (isUpdatedAtUnsupportedError(error)) {
            setUpdatedAtUnsupportedCached(true);
            break;
          }

          if (isMissingColumnError(error)) {
            throw error;
          }

          if (i < delays.length - 1 && isAuthNotReadyError(error)) {
            continue;
          }

          if (
            i < delays.length - 1 &&
            isTransientAuthOrNetworkError(error)
          ) {
            continue;
          }

          return { ok: false, list: [], error: normMsg(error) };
        }

        return {
          ok: true,
          list: mapRowsToThreads(result.data, titleFallback),
        };
      } catch {
        break;
      }
    }
  }

  for (let i = 0; i < delays.length; i++) {
    if (delays[i] > 0) {
      await sleep(delays[i]);
    }

    const auth = await waitForAuthReady(supabase);
    if (!auth.ok) {
      if (i < delays.length - 1) continue;
      return { ok: false, list: [], error: "auth_not_ready" };
    }

    try {
      const result = await runOnceCreated();

      if (!result.ok) {
        const error = result.error;

        if (isMissingColumnError(error)) {
          throw error;
        }

        if (i < delays.length - 1 && isAuthNotReadyError(error)) {
          continue;
        }

        if (
          i < delays.length - 1 &&
          isTransientAuthOrNetworkError(error)
        ) {
          continue;
        }

        return { ok: false, list: [], error: normMsg(error) };
      }

      return {
        ok: true,
        list: mapRowsToThreads(result.data, titleFallback),
      };
    } catch (e2) {
      if (
        i < delays.length - 1 &&
        (isAuthNotReadyError(e2) || isTransientAuthOrNetworkError(e2))
      ) {
        continue;
      }

      return { ok: false, list: [], error: normMsg(e2) };
    }
  }

  return { ok: false, list: [], error: "fetchThreads error" };
}

/*
このファイルの正式役割
conversations 一覧を取得して、左カラム表示用の Thread[] に正規化して返す取得ファイル。
このファイルは一覧取得だけを担当し、選択・採用・本文更新は担当しない。

【今回このファイルで修正したこと】
1. updated_at ルートと created_at ルートで重複していた rows → Thread[] 変換を mapRowsToThreads に一本化しました。
2. fetchThreads の取得後処理を1箇所へ寄せ、取得層の読み筋を少し単純化しました。
3. retry、auth 待機、updated_at → created_at フォールバック、schema cache、normalizeThreadRow の意味は触っていません。
*/

/* /components/chat/lib/threadApiFetchThreads.ts */