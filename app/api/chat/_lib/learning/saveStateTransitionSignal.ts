// /app/api/chat/_lib/learning/saveStateTransitionSignal.ts
import type { SupabaseClient } from "@supabase/supabase-js";
import { insertStateTransitionSignal } from "../db/stateTransitionSignals";

type StateLevel = 1 | 2 | 3 | 4 | 5;

type SaveStateTransitionSignalParams = {
  supabase: SupabaseClient;
  threadId: string;
  userId: string;
  beforeStateLevel: StateLevel;
  afterStateLevel: StateLevel;
  triggerMessageId: string;
  assistantMessageId: string;
  transitionKind?: string | null;
  confidenceScore?: number | null;
};

type SaveStateTransitionSignalResult =
  | { ok: true }
  | { ok: false; error: unknown };

export async function saveStateTransitionSignal(
  params: SaveStateTransitionSignalParams
): Promise<SaveStateTransitionSignalResult> {
  const result = await insertStateTransitionSignal({
    supabase: params.supabase,
    input: {
      threadId: params.threadId,
      userId: params.userId,
      beforeStateLevel: params.beforeStateLevel,
      afterStateLevel: params.afterStateLevel,
      triggerMessageId: params.triggerMessageId,
      assistantMessageId: params.assistantMessageId,
      transitionKind: params.transitionKind,
      confidenceScore: params.confidenceScore,
    },
  });

  if (!result.ok) {
    return {
      ok: false,
      error: result.error,
    };
  }

  return {
    ok: true,
  };
}