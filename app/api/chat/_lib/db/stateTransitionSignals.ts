// /app/api/chat/_lib/db/stateTransitionSignals.ts
import type { SupabaseClient } from "@supabase/supabase-js";

export type StateTransitionSignalRecord = {
  id: string;
  thread_id: string;
  user_id: string;
  before_state_level: number;
  after_state_level: number;
  trigger_message_id: string | null;
  assistant_message_id: string | null;
  transition_kind: string | null;
  confidence_score: number | null;
  created_at: string;
};

export type InsertStateTransitionSignalInput = {
  threadId: unknown;
  userId: unknown;
  beforeStateLevel: unknown;
  afterStateLevel: unknown;
  triggerMessageId?: unknown;
  assistantMessageId?: unknown;
  transitionKind?: unknown;
  confidenceScore?: unknown;
};

type InsertStateTransitionSignalParams = {
  supabase: SupabaseClient;
  input: InsertStateTransitionSignalInput;
};

type GetStateTransitionSignalsByThreadParams = {
  supabase: SupabaseClient;
  threadId: unknown;
  limit?: unknown;
};

type GetStateTransitionSignalsByTriggerMessageParams = {
  supabase: SupabaseClient;
  triggerMessageId: unknown;
  limit?: unknown;
};

type InsertStateTransitionSignalResult =
  | { ok: true; signal: StateTransitionSignalRecord }
  | { ok: false; error: unknown };

type GetStateTransitionSignalsByThreadResult =
  | { ok: true; signals: StateTransitionSignalRecord[] }
  | { ok: false; error: unknown; signals: StateTransitionSignalRecord[] };

type GetStateTransitionSignalsByTriggerMessageResult =
  | { ok: true; signals: StateTransitionSignalRecord[] }
  | { ok: false; error: unknown; signals: StateTransitionSignalRecord[] };

function normalizeRequired(value: unknown): string {
  return String(value ?? "").trim();
}

function normalizeOptional(value: unknown): string | null {
  const s = String(value ?? "").trim();
  return s ? s : null;
}

function normalizeStateLevel(value: unknown): number | null {
  const n = Number(value);
  if (!Number.isInteger(n)) return null;
  if (n < 1 || n > 5) return null;
  return n;
}

function normalizeConfidenceScore(value: unknown): number | null {
  if (value == null || value === "") return null;
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  if (n < 0 || n > 1) return null;
  return n;
}

function normalizeLimit(value: unknown): number {
  const n = Number(value);
  if (!Number.isInteger(n)) return 20;
  if (n < 1) return 1;
  if (n > 100) return 100;
  return n;
}

export async function insertStateTransitionSignal(
  params: InsertStateTransitionSignalParams,
): Promise<InsertStateTransitionSignalResult> {
  const { supabase, input } = params;

  const thread_id = normalizeRequired(input.threadId);
  const user_id = normalizeRequired(input.userId);
  const before_state_level = normalizeStateLevel(input.beforeStateLevel);
  const after_state_level = normalizeStateLevel(input.afterStateLevel);

  if (
    !thread_id ||
    !user_id ||
    before_state_level === null ||
    after_state_level === null
  ) {
    return {
      ok: false,
      error: new Error(
        "threadId, userId, beforeStateLevel(1..5), and afterStateLevel(1..5) are required.",
      ),
    };
  }

  const payload = {
    thread_id,
    user_id,
    before_state_level,
    after_state_level,
    trigger_message_id: normalizeOptional(input.triggerMessageId),
    assistant_message_id: normalizeOptional(input.assistantMessageId),
    transition_kind: normalizeOptional(input.transitionKind),
    confidence_score: normalizeConfidenceScore(input.confidenceScore),
  };

  const { data, error } = await supabase
    .from("state_transition_signals")
    .insert(payload)
    .select("*")
    .single<StateTransitionSignalRecord>();

  if (error || !data) {
    return {
      ok: false,
      error: error ?? new Error("Failed to insert state transition signal."),
    };
  }

  return {
    ok: true,
    signal: data,
  };
}

export async function getStateTransitionSignalsByThread(
  params: GetStateTransitionSignalsByThreadParams,
): Promise<GetStateTransitionSignalsByThreadResult> {
  const { supabase, threadId, limit } = params;

  const thread_id = normalizeRequired(threadId);
  if (!thread_id) {
    return {
      ok: false,
      error: new Error("threadId is required."),
      signals: [],
    };
  }

  const { data, error } = await supabase
    .from("state_transition_signals")
    .select("*")
    .eq("thread_id", thread_id)
    .order("created_at", { ascending: false })
    .limit(normalizeLimit(limit));

  if (error) {
    return {
      ok: false,
      error,
      signals: [],
    };
  }

  return {
    ok: true,
    signals: (data ?? []) as StateTransitionSignalRecord[],
  };
}

export async function getStateTransitionSignalsByTriggerMessage(
  params: GetStateTransitionSignalsByTriggerMessageParams,
): Promise<GetStateTransitionSignalsByTriggerMessageResult> {
  const { supabase, triggerMessageId, limit } = params;

  const trigger_message_id = normalizeRequired(triggerMessageId);
  if (!trigger_message_id) {
    return {
      ok: false,
      error: new Error("triggerMessageId is required."),
      signals: [],
    };
  }

  const { data, error } = await supabase
    .from("state_transition_signals")
    .select("*")
    .eq("trigger_message_id", trigger_message_id)
    .order("created_at", { ascending: false })
    .limit(normalizeLimit(limit));

  if (error) {
    return {
      ok: false,
      error,
      signals: [],
    };
  }

  return {
    ok: true,
    signals: (data ?? []) as StateTransitionSignalRecord[],
  };
}