// /app/api/chat/_lib/learning/saveResponseGenerationLog.ts
import type { SupabaseClient } from "@supabase/supabase-js";

type SaveResponseGenerationLogParams = {
  supabase: SupabaseClient;
  assistantMessageId: string;
  threadId: string;
  userId: string;
  detectedStateLevel: 1 | 2 | 3 | 4 | 5;
  usedMemoryIds?: string[] | null;
  usedPatternIds?: string[] | null;
  usedExpressionAssetIds?: string[] | null;
  transitionTargetLevel?: 1 | 2 | 3 | 4 | 5 | null;
  replyStyle?: string | null;
};

type SaveResponseGenerationLogResult =
  | { ok: true }
  | { ok: false; error: unknown };

function normalizeIdList(values?: string[] | null): string[] {
  if (!Array.isArray(values)) return [];

  const seen = new Set<string>();
  const normalized: string[] = [];

  for (const value of values) {
    const s = String(value ?? "").trim();
    if (!s) continue;
    if (seen.has(s)) continue;
    seen.add(s);
    normalized.push(s);
  }

  return normalized;
}

function normalizeReplyStyle(value?: string | null): string | null {
  const s = String(value ?? "").trim();
  return s ? s : null;
}

export async function saveResponseGenerationLog(
  params: SaveResponseGenerationLogParams
): Promise<SaveResponseGenerationLogResult> {
  const {
    supabase,
    assistantMessageId,
    threadId,
    userId,
    detectedStateLevel,
    usedMemoryIds,
    usedPatternIds,
    usedExpressionAssetIds,
    transitionTargetLevel,
    replyStyle,
  } = params;

  const payload = {
    assistant_message_id: String(assistantMessageId ?? "").trim(),
    thread_id: String(threadId ?? "").trim(),
    user_id: String(userId ?? "").trim(),
    detected_state_level: detectedStateLevel,
    used_memory_ids: normalizeIdList(usedMemoryIds),
    used_pattern_ids: normalizeIdList(usedPatternIds),
    used_expression_asset_ids: normalizeIdList(usedExpressionAssetIds),
    transition_target_level: transitionTargetLevel ?? detectedStateLevel,
    reply_style: normalizeReplyStyle(replyStyle),
  };

  const { error } = await supabase
    .from("response_generation_logs")
    .insert(payload);

  if (error) {
    return {
      ok: false,
      error,
    };
  }

  return {
    ok: true,
  };
}