// /app/api/chat/_lib/db/responseGenerationLogs.ts
import type { SupabaseClient } from "@supabase/supabase-js";

export type ResponseGenerationLogRecord = {
  id: string;
  assistant_message_id: string;
  thread_id: string;
  user_id: string;
  detected_state_level: number;
  used_memory_ids: string[];
  used_pattern_ids: string[];
  used_expression_asset_ids: string[];
  transition_target_level: number | null;
  reply_style: string | null;
  created_at: string;
};

export type InsertResponseGenerationLogInput = {
  assistantMessageId: unknown;
  threadId: unknown;
  userId: unknown;
  detectedStateLevel: unknown;
  usedMemoryIds?: unknown;
  usedPatternIds?: unknown;
  usedExpressionAssetIds?: unknown;
  transitionTargetLevel?: unknown;
  replyStyle?: unknown;
};

type InsertResponseGenerationLogParams = {
  supabase: SupabaseClient;
  input: InsertResponseGenerationLogInput;
};

type GetResponseGenerationLogsByThreadParams = {
  supabase: SupabaseClient;
  threadId: unknown;
  limit?: unknown;
};

type GetResponseGenerationLogsByAssistantMessageParams = {
  supabase: SupabaseClient;
  assistantMessageId: unknown;
};

type InsertResponseGenerationLogResult =
  | { ok: true; log: ResponseGenerationLogRecord }
  | { ok: false; error: unknown };

type GetResponseGenerationLogsByThreadResult =
  | { ok: true; logs: ResponseGenerationLogRecord[] }
  | { ok: false; error: unknown; logs: ResponseGenerationLogRecord[] };

type GetResponseGenerationLogsByAssistantMessageResult =
  | { ok: true; log: ResponseGenerationLogRecord | null }
  | { ok: false; error: unknown; log: null };

function normalizeRequired(value: unknown): string {
  return String(value ?? "").trim();
}

function normalizeOptional(value: unknown): string | null {
  const s = String(value ?? "").trim();
  return s ? s : null;
}

function normalizeLevel(value: unknown): number | null {
  const n = Number(value);
  if (!Number.isInteger(n)) return null;
  if (n < 1 || n > 5) return null;
  return n;
}

function normalizeRequiredLevel(value: unknown): number | null {
  return normalizeLevel(value);
}

function normalizeLimit(value: unknown): number {
  const n = Number(value);
  if (!Number.isInteger(n)) return 20;
  if (n < 1) return 1;
  if (n > 100) return 100;
  return n;
}

function normalizeIdArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];

  const seen = new Set<string>();
  const result: string[] = [];

  for (const item of value) {
    const s = normalizeRequired(item);
    if (!s) continue;
    if (seen.has(s)) continue;
    seen.add(s);
    result.push(s);
    if (result.length >= 200) break;
  }

  return result;
}

export async function insertResponseGenerationLog(
  params: InsertResponseGenerationLogParams,
): Promise<InsertResponseGenerationLogResult> {
  const { supabase, input } = params;

  const assistant_message_id = normalizeRequired(input.assistantMessageId);
  const thread_id = normalizeRequired(input.threadId);
  const user_id = normalizeRequired(input.userId);
  const detected_state_level = normalizeRequiredLevel(input.detectedStateLevel);

  if (
    !assistant_message_id ||
    !thread_id ||
    !user_id ||
    detected_state_level === null
  ) {
    return {
      ok: false,
      error: new Error(
        "assistantMessageId, threadId, userId, and detectedStateLevel(1..5) are required.",
      ),
    };
  }

  const payload = {
    assistant_message_id,
    thread_id,
    user_id,
    detected_state_level,
    used_memory_ids: normalizeIdArray(input.usedMemoryIds),
    used_pattern_ids: normalizeIdArray(input.usedPatternIds),
    used_expression_asset_ids: normalizeIdArray(input.usedExpressionAssetIds),
    transition_target_level: normalizeLevel(input.transitionTargetLevel),
    reply_style: normalizeOptional(input.replyStyle),
  };

  const { data, error } = await supabase
    .from("response_generation_logs")
    .insert(payload)
    .select("*")
    .single<ResponseGenerationLogRecord>();

  if (error || !data) {
    return {
      ok: false,
      error: error ?? new Error("Failed to insert response generation log."),
    };
  }

  return {
    ok: true,
    log: data,
  };
}

export async function getResponseGenerationLogsByThread(
  params: GetResponseGenerationLogsByThreadParams,
): Promise<GetResponseGenerationLogsByThreadResult> {
  const { supabase, threadId, limit } = params;

  const thread_id = normalizeRequired(threadId);
  if (!thread_id) {
    return {
      ok: false,
      error: new Error("threadId is required."),
      logs: [],
    };
  }

  const { data, error } = await supabase
    .from("response_generation_logs")
    .select("*")
    .eq("thread_id", thread_id)
    .order("created_at", { ascending: false })
    .limit(normalizeLimit(limit));

  if (error) {
    return {
      ok: false,
      error,
      logs: [],
    };
  }

  return {
    ok: true,
    logs: (data ?? []) as ResponseGenerationLogRecord[],
  };
}

export async function getResponseGenerationLogByAssistantMessage(
  params: GetResponseGenerationLogsByAssistantMessageParams,
): Promise<GetResponseGenerationLogsByAssistantMessageResult> {
  const { supabase, assistantMessageId } = params;

  const assistant_message_id = normalizeRequired(assistantMessageId);
  if (!assistant_message_id) {
    return {
      ok: false,
      error: new Error("assistantMessageId is required."),
      log: null,
    };
  }

  const { data, error } = await supabase
    .from("response_generation_logs")
    .select("*")
    .eq("assistant_message_id", assistant_message_id)
    .maybeSingle<ResponseGenerationLogRecord>();

  if (error) {
    return {
      ok: false,
      error,
      log: null,
    };
  }

  return {
    ok: true,
    log: (data as ResponseGenerationLogRecord | null) ?? null,
  };
}