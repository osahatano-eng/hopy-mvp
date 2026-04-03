// /app/api/chat/_lib/state/update.ts
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Lang } from "../text";
import {
  updateUserStateFromMessage as updateUserStateFromMessageInDb,
  type UserState,
} from "../db/userState";

export async function updateUserStateFromMessage(params: {
  supabase: SupabaseClient;
  userId: string;
  uiLang: Lang;
  text: string;
}): Promise<{
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
}> {
  return updateUserStateFromMessageInDb({
    supabase: params.supabase,
    userId: params.userId,
    uiLang: params.uiLang,
    text: params.text,
  });
}

/*
このファイルの正式役割
route 層から呼ばれる user state 更新窓口です。
state 更新の実処理本体は db/userState.ts に置き、
このファイルは route 側が迷わず呼べる薄い委譲口だけを持ちます。
*/

/*
【今回このファイルで修正したこと】
- route.ts で誤上書きされていた update.ts を、本来の state 更新窓口ファイルとして戻しました。
- updateUserStateFromMessage(...) を ../db/userState へ委譲する最小構成にしました。
- route 層で必要な引数と戻り値だけを維持し、余計な処理は足していません。
*/