// /app/api/chat/_lib/route/authenticatedPostTurnAuditSave.ts

import type { SupabaseClient } from "@supabase/supabase-js";

import { insertInterventionLog } from "../db/interventionLog";
import { errorText } from "../infra/text";
import type { Lang } from "../router/simpleRouter";
import { systemCoreDigest, systemCorePrompt } from "../system/system";

type HopyStateLevel = 1 | 2 | 3 | 4 | 5;
type InterventionTone = Parameters<typeof insertInterventionLog>[0]["input_tone"];
type InterventionStrategy =
  Parameters<typeof insertInterventionLog>[0]["selected_strategy"];

type ConfirmedAuditTurn = {
  assistantText: string;
  prevPhase: HopyStateLevel;
  currentPhase: HopyStateLevel;
};

export type AuthenticatedPostTurnAuditSaveResult = {
  audit_ok: boolean | null;
  audit_error: string | null;
};

export async function saveAuthenticatedPostTurnAudit(params: {
  supabase: SupabaseClient;
  authedUserId: string;
  resolvedConversationId: string;
  userText: string;
  uiLang: Lang;
  routed: {
    tone: InterventionTone;
    intensity: number;
  };
  selectedStrategy: InterventionStrategy;
  modelName: string;
  buildSig: string;
  confirmedTurn: ConfirmedAuditTurn;
  stateBefore: any;
  st: any;
}): Promise<AuthenticatedPostTurnAuditSaveResult> {
  try {
    const turn_key = `${params.resolvedConversationId}:${Date.now()}`;

    const res = await insertInterventionLog({
      supabase: params.supabase,
      user_id: params.authedUserId,
      thread_id: params.resolvedConversationId,
      turn_key,
      user_input: params.userText,
      input_lang: params.uiLang,
      input_tone: params.routed.tone,
      input_intensity: params.routed.intensity,
      selected_strategy: params.selectedStrategy,
      style_id: 1,
      hopy_output: params.confirmedTurn.assistantText,
      avoid_phrases: [],
      model: params.modelName,
      system_digest: params.buildSig,
      system_core_digest: systemCoreDigest(),
      build_sig: params.buildSig,
      system_core_prompt: systemCorePrompt,
      phase_before: params.confirmedTurn.prevPhase,
      phase_after: params.confirmedTurn.currentPhase,
      score_before: params.stateBefore?.stability_score ?? 0,
      score_after:
        params.st?.applied?.nextScore ??
        params.stateBefore?.stability_score ??
        0,
    });

    if (!res.ok) {
      return {
        audit_ok: res.ok,
        audit_error: errorText((res as any)?.error) || "insert_failed",
      };
    }

    return {
      audit_ok: res.ok,
      audit_error: null,
    };
  } catch (e: any) {
    return {
      audit_ok: false,
      audit_error: errorText(e) || String(e?.message ?? e),
    };
  }
}

/*
【このファイルの正式役割】
authenticated postTurn の intervention audit 保存責務だけを持つ。
HOPY回答確定後の user_input / hopy_output / phase_before / phase_after / score 情報を受け取り、
insertInterventionLog(...) を実行して audit_ok / audit_error を返す。
このファイルは audit 保存実行だけを担当し、
state_changed、state_level、current_phase、Compass、HOPY回答○、memory、learning、
thread_summary、title 解決、Future Chain は再判定しない。

【今回このファイルで修正したこと】
- /app/api/chat/_lib/route/authenticatedPostTurn.ts から分離するため、
  intervention audit 保存責務を新規ファイルとして作成した。
- 親ファイル内にあった insertInterventionLog(...) の try/catch と結果整形を、
  saveAuthenticatedPostTurnAudit(...) として移せる形にした。
- 既存の入力値、turn_key 生成、systemCoreDigest/systemCorePrompt、score_before/score_after、
  audit_ok/audit_error の返し方は変えていない。
- HOPY唯一の正、Compass、memory、learning、thread_summary、title 解決、Future Chain には触れていない。

/app/api/chat/_lib/route/authenticatedPostTurnAuditSave.ts
*/