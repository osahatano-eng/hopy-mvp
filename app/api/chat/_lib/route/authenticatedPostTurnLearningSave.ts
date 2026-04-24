// /app/api/chat/_lib/route/authenticatedPostTurnLearningSave.ts

import type { SupabaseClient } from "@supabase/supabase-js";

import { errorText } from "../infra/text";
import type { Lang } from "../router/simpleRouter";
import { saveConfirmedAssistantLearningEntry } from "./authenticatedHelpers";

type SaveConfirmedAssistantLearningEntryInput = Parameters<
  typeof saveConfirmedAssistantLearningEntry
>[0];

export type AuthenticatedPostTurnLearningSavePromise = ReturnType<
  typeof saveConfirmedAssistantLearningEntry
>;

export type AuthenticatedPostTurnLearningSaveParams = {
  supabase: SupabaseClient;
  authedUserId: string;
  resolvedConversationId: string;
  userMessageId: string;
  assistantMessageId: string;
  userText: string;
  confirmedTurn: SaveConfirmedAssistantLearningEntryInput["confirmedTurn"];
  uiLang: Lang;
};

export type AuthenticatedPostTurnLearningSaveResult = {
  learning_save_attempted: boolean | null;
  learning_save_inserted: number | null;
  learning_save_reason: string | null;
  learning_save_error: string | null;
};

export function startAuthenticatedPostTurnLearningSave({
  supabase,
  authedUserId,
  resolvedConversationId,
  userMessageId,
  assistantMessageId,
  userText,
  confirmedTurn,
  uiLang,
}: AuthenticatedPostTurnLearningSaveParams): AuthenticatedPostTurnLearningSavePromise {
  return saveConfirmedAssistantLearningEntry({
    supabase,
    authedUserId,
    resolvedConversationId,
    userMessageId,
    assistantMessageId,
    userText,
    confirmedTurn,
    uiLang,
  });
}

export async function resolveAuthenticatedPostTurnLearningSave(
  learningSavePromise: AuthenticatedPostTurnLearningSavePromise,
): Promise<AuthenticatedPostTurnLearningSaveResult> {
  try {
    const learningSave = await learningSavePromise;

    return {
      learning_save_attempted: learningSave.attempted,
      learning_save_inserted: learningSave.inserted,
      learning_save_reason: learningSave.reason,
      learning_save_error: learningSave.error,
    };
  } catch (e: any) {
    return {
      learning_save_attempted: true,
      learning_save_inserted: 0,
      learning_save_reason: "exception",
      learning_save_error: errorText(e) || String(e?.message ?? e),
    };
  }
}

/*
【このファイルの正式役割】
authenticated 経路の postTurn 最終化における Learning 保存開始・結果解決責務。
saveConfirmedAssistantLearningEntry(...) の開始と、
その Promise の結果解決だけを担当する。
このファイルは state_changed / state_level / current_phase を再判定せず、
親から受け取った confirmedTurn と確定済み入力値をそのまま保存処理へ渡す。

【今回このファイルで修正したこと】
- authenticatedPostTurn.ts に残っていた learningSavePromise 開始処理の受け皿を作成した。
- learningSavePromise の await / try / catch 結果解決処理の受け皿を作成した。
- 既存の例外時戻り値
  learning_save_attempted=true /
  learning_save_inserted=0 /
  learning_save_reason="exception" /
  learning_save_error=errorText(e) || String(e?.message ?? e)
  を維持した。
- HOPY唯一の正、state_changed、Compass、HOPY回答○、Memory書き込み、
  Future Chain、thread_summary、audit、thread title、payload 生成本体には触れていない。

/app/api/chat/_lib/route/authenticatedPostTurnLearningSave.ts
*/