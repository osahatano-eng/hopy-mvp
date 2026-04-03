// /app/api/chat/_lib/state/update.ts
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Lang } from "../router/simpleRouter";
import {
  updateUserStateFromMessage as updateUserStateFromMessageInDb,
  type UserState,
} from "../db/userState";

export type UpdateUserStateFromMessageParams = {
  supabase: SupabaseClient;
  userId: string;
  uiLang: Lang;
  text: string;
};

export type UpdateUserStateFromMessageResult = {
  ok: boolean;
  state?: UserState;
  error?: any;
  skipped?: boolean;
  skip_reason?: string | null;
  applied?: {
    deltaApplied: number;
    nextScore: number;
    nextPhase: number;
    triggerJson: string | null;
  };
};

export async function updateUserStateFromMessage(
  params: UpdateUserStateFromMessageParams,
): Promise<UpdateUserStateFromMessageResult> {
  return updateUserStateFromMessageInDb({
    supabase: params.supabase,
    userId: params.userId,
    uiLang: params.uiLang,
    text: params.text,
  });
}

/*
このファイルの正式役割
route 層から呼ばれる user_state 更新窓口です。
state 更新の実処理本体は db/userState.ts に置き、
このファイルは route 側が迷わず呼べる薄い委譲口だけを持ちます。
*/

/*
【今回このファイルで修正したこと】
- update.ts を route 層から呼ぶ正式な state 更新窓口として再構築しました。
- Lang の import 元を現行の route 系とそろえて ../router/simpleRouter に戻しました。
- updateUserStateFromMessage(...) は db/userState.ts へだけ委譲する薄い構成に固定しました。
- route 層で使う引数と戻り値の型をこのファイル内で明示し、余計な処理は足していません。
*/
// このファイルの正式役割: route 層から呼ばれる user_state 更新窓口