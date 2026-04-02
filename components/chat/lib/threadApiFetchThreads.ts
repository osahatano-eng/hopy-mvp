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
import { getUpdatedAtUnsupportedCached, setUpdatedAtUnsupportedCached } from "./threadApiSchemaCache";
import { normalizeThreadRow } from "./threadApiNormalize";
import { waitForAuthReady } from "./threadApiAuth";

export type ThreadsResult = { ok: true; list: Thread[] } | { ok: false; list: Thread[]; error: string };

/**
 * ✅ conversations テーブル（現DB）に実在する列だけで固定する
 * DB列: id, user_id, title, created_at, updated_at, state_level, client_request_id, current_phase
 *
 * - これにより "column ... does not exist"（42703）を根絶する
 * - normalizeThreadRow は未取得の列があっても落ちない前提で利用する
 */
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

/**
 * 🔒 安定版
 * - まずスレッド表示を完全復旧させる
 *
 * ✅ ここでチャット個別状態も取得して Thread に載せる
 * ✅ 失敗時に saved active thread を救済表示しない
 *    - 未送信の新規チャットより前回スレッドが優先復元される混線を防ぐ
 */
export async function fetchThreads(supabase: SupabaseClient, uiLang?: Lang): Promise<ThreadsResult> {
  const titleFallback = uiLang === "ja" ? "新規チャット" : "New chat";

  const runOnceUpdated = async () => {
    return await fetchAllOrdered(supabase, CONV_SELECT_WITH_UPDATED, "updated_at");
  };

  const runOnceCreated = async () => {
    return await fetchAllOrdered(supabase, CONV_SELECT_NO_UPDATED, "created_at");
  };

  // ✅ PWA復帰直後の揺れを吸収（短いリトライ）
  const delays = [0, 120, 260, 520];

  // ✅ 端末/環境で updated_at が使えない場合は、最初から created_at へ直行
  const skipUpdatedAtRoutes = getUpdatedAtUnsupportedCached();

  // 1) updated_at ルート（現DBの実在列のみ）
  if (!skipUpdatedAtRoutes) {
    for (let i = 0; i < delays.length; i++) {
      if (delays[i] > 0) {
        await sleep(delays[i]);
      }

      // ✅ まず auth 復元を少し待つ（未復元なら次のdelayへ）
      const auth = await waitForAuthReady(supabase);
      if (!auth.ok) {
        if (i < delays.length - 1) continue;
        return { ok: false, list: [], error: "auth_not_ready" };
      }

      try {
        const result = await runOnceUpdated();

        if (!result.ok) {
          const error = result.error;

          // ✅ updated_at が使えない環境はここで確定→次回以降スキップ
          if (isUpdatedAtUnsupportedError(error)) {
            setUpdatedAtUnsupportedCached(true);
            break;
          }

          // ここは原則起きないが、念のため維持（将来のDB差異）
          if (isMissingColumnError(error)) {
            throw error;
          }

          // 認証復元中っぽいならリトライ
          if (i < delays.length - 1 && isAuthNotReadyError(error)) {
            continue;
          }

          // 一時的揺れはリトライ
          if (i < delays.length - 1 && isTransientAuthOrNetworkError(error)) {
            continue;
          }

          return { ok: false, list: [], error: normMsg(error) };
        }

        const raw = Array.isArray(result.data) ? result.data : [];
        const list = raw
          .map((r: any) => normalizeThreadRow(r, titleFallback, { preferNowIfMissingUpdated: false }))
          .filter((t) => String((t as any)?.id ?? "").trim().length > 0) as Thread[];

        return { ok: true, list };
      } catch {
        // updated_at ルートが無理 → created_at へ
        break;
      }
    }
  }

  // 2) created_at フォールバック（updated_at 列が無い/使えない環境）
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

        // ここも原則起きないが、念のため維持
        if (isMissingColumnError(error)) {
          // 別環境でのDB差異が出た場合に備える
          throw error;
        }

        if (i < delays.length - 1 && isAuthNotReadyError(error)) {
          continue;
        }

        if (i < delays.length - 1 && isTransientAuthOrNetworkError(error)) {
          continue;
        }

        return { ok: false, list: [], error: normMsg(error) };
      }

      const raw = Array.isArray(result.data) ? result.data : [];
      const list = raw
        .map((r: any) => normalizeThreadRow(r, titleFallback, { preferNowIfMissingUpdated: false }))
        .filter((t) => String((t as any)?.id ?? "").trim().length > 0) as Thread[];

      return { ok: true, list };
    } catch (e2) {
      if (i < delays.length - 1 && (isAuthNotReadyError(e2) || isTransientAuthOrNetworkError(e2))) {
        continue;
      }

      return { ok: false, list: [], error: normMsg(e2) };
    }
  }

  return { ok: false, list: [], error: "fetchThreads error" };
}