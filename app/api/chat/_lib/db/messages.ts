// /app/api/chat/_lib/db/messages.ts
import type { SupabaseClient } from "@supabase/supabase-js";
import { saveMessageCore, type Lang } from "./saveMessageCore";

/**
 * Lang は route.ts 側と“型の出どころ”がズレやすいので、
 * DB層では最小の文字列Unionに固定して壊れにくくする。
 */

export type SavedMsg =
  | { ok: true; id: string }
  | { ok: false; error: any };

export type SavedMsgLite =
  | { ok: true }
  | { ok: false; error: any };

function toSavedMsg(
  result:
    | { ok: true; id: string }
    | { ok: true }
    | { ok: false; error: any },
): SavedMsg {
  if (!result.ok) return { ok: false, error: result.error };
  if (!("id" in result)) return { ok: false, error: "insert_no_id" };
  return { ok: true, id: result.id };
}

function toSavedMsgLite(
  result:
    | { ok: true; id: string }
    | { ok: true }
    | { ok: false; error: any },
): SavedMsgLite {
  if (!result.ok) return { ok: false, error: result.error };
  return { ok: true };
}

/**
 * ✅ Returning版（id が必要な場合）
 * - INSERT + RETURNING(id)
 * - 環境差（conversation_id / thread_id）にフォールバック対応
 * - ただし、state / compass が caller から正式に渡された場合は
 *   それらの列欠落を黙って許容しない
 */
export async function saveMessage(params: {
  supabase: SupabaseClient;
  userId: string;
  conversationId: string;
  role: "user" | "assistant";
  content: string;
  lang: Lang;
  state_level?: number;
  current_phase?: number;
  state_changed?: boolean;
  prev_phase?: number;
  prev_state_level?: number;
  compass_text?: string;
  compass_prompt?: string;
}): Promise<SavedMsg> {
  try {
    const result = await saveMessageCore({
      ...params,
      mode: "returning",
    });

    return toSavedMsg(result);
  } catch (error) {
    return { ok: false, error };
  }
}

/**
 * ✅ 軽量版（互換維持用）
 * - 既存呼び出し互換のため残す
 * - ただし HOPY では assistant id の安定取得を優先するため、
 *   route 側の主経路は saveMessageMaybeReturning を使う
 */
export async function saveMessageLite(params: {
  supabase: SupabaseClient;
  userId: string;
  conversationId: string;
  role: "user" | "assistant";
  content: string;
  lang: Lang;
  state_level?: number;
  current_phase?: number;
  state_changed?: boolean;
  prev_phase?: number;
  prev_state_level?: number;
  compass_text?: string;
  compass_prompt?: string;
}): Promise<SavedMsgLite> {
  try {
    const result = await saveMessageCore({
      ...params,
      mode: "lite",
    });

    return toSavedMsgLite(result);
  } catch (error) {
    return { ok: false, error };
  }
}

/**
 * ✅ HOPY主経路用
 * - 本番でも assistant message id を安定取得するため、常に RETURNING(id) を使う
 * - returnId 引数は互換維持のため受け取るが、動作は常に saveMessage に統一する
 *
 * これにより、
 * - DEBUG_SAVE=false の本番
 * - DEBUG_SAVE=true のデバッグ
 * の両方で message id を取得でき、
 * memories.source_message_id を assistant message に安定して紐づけられる。
 */
export async function saveMessageMaybeReturning(params: {
  supabase: SupabaseClient;
  userId: string;
  conversationId: string;
  role: "user" | "assistant";
  content: string;
  lang: Lang;
  returnId?: boolean;
  state_level?: number;
  current_phase?: number;
  state_changed?: boolean;
  prev_phase?: number;
  prev_state_level?: number;
  compass_text?: string;
  compass_prompt?: string;
}): Promise<SavedMsg> {
  const { returnId: _returnId, ...rest } = params;
  void _returnId;
  return await saveMessage(rest);
}

/*
このファイルの正式役割
messages テーブル保存の公開窓口ファイル。
saveMessage / saveMessageLite / saveMessageMaybeReturning を外部へ公開し、
実際の共通保存ロジックは saveMessageCore.ts へ委譲する。
state / compass は HOPY回答確定時の正式値をそのまま扱い、
保存層で再判定・再生成・再救出しない。
*/

/*
【今回このファイルで修正したこと】
- messages.ts 内にあった共通保存ロジックを削り、saveMessageCore.ts 呼び出しへ置き換えた。
- saveMessage / saveMessageLite は mode だけを切り替える薄い公開窓口に整理した。
- saveMessageMaybeReturning の既存公開形は維持したまま、内部の責務だけを分離した。
*/