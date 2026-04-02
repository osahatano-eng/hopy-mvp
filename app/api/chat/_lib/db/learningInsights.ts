// /app/api/chat/_lib/db/learningInsights.ts

import type { SupabaseClient } from "@supabase/supabase-js";

export type LearningInsightType =
  | "expression_preference"
  | "expression_avoidance"
  | "state_support_style"
  | "transition_support"
  | "tone_preference"
  | "closing_preference"
  | "opener_preference"
  | "rhythm_preference";

export type LearningInsightStatus = "active" | "trash";

export type LearningUpdateActionType =
  | "insert"
  | "merge"
  | "weight_up"
  | "weight_down"
  | "trash"
  | "restore";

export type LearningInsightRow = {
  id: string;
  user_id: string;
  thread_id: string | null;
  source_message_id: string | null;
  source_assistant_message_id: string | null;
  language: "ja" | "en";
  insight_type: LearningInsightType;
  body: string;
  applicability: string | null;
  state_scope: unknown;
  avoidance_notes: string | null;
  evidence_count: number;
  weight: number;
  status: LearningInsightStatus;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

export type LearningUpdateLogRow = {
  id: string;
  user_id: string;
  thread_id: string | null;
  trigger_message_id: string | null;
  assistant_message_id: string | null;
  insight_id: string | null;
  action_type: LearningUpdateActionType;
  action_note: string | null;
  delta_evidence_count: number | null;
  delta_weight: number | null;
  created_at: string;
};

export type LearningInsightInsertInput = {
  userId: string;
  threadId?: string | null;
  sourceMessageId?: string | null;
  sourceAssistantMessageId?: string | null;
  language?: "ja" | "en";
  insightType: LearningInsightType;
  body: string;
  applicability?: string | null;
  stateScope?: number[];
  avoidanceNotes?: string | null;
  evidenceCount?: number;
  weight?: number;
  status?: LearningInsightStatus;
};

export type LearningInsightMergeInput = {
  userId: string;
  threadId?: string | null;
  triggerMessageId?: string | null;
  assistantMessageId?: string | null;
  language?: "ja" | "en";
  insightType: LearningInsightType;
  body: string;
  applicability?: string | null;
  stateScope?: number[];
  avoidanceNotes?: string | null;
  evidenceIncrement?: number;
  weightIncrement?: number;
};

export type LearningInsightQuery = {
  userId: string;
  language?: "ja" | "en";
  insightTypes?: LearningInsightType[];
  stateLevel?: number | null;
  limit?: number;
};

function toSafeBody(value: string): string {
  return value.trim();
}

function toSafeStateScope(value?: number[]): number[] {
  if (!Array.isArray(value)) return [];
  const unique = Array.from(
    new Set(
      value.filter(
        (item): item is number =>
          Number.isInteger(item) && item >= 1 && item <= 5,
      ),
    ),
  );
  return unique.sort((a, b) => a - b);
}

function normalizeNullableText(value?: string | null): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function clampEvidenceCount(value?: number | null): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return 1;
  }
  return Math.max(1, Math.round(value));
}

function clampWeight(value?: number | null): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return 1;
  }

  const rounded = Math.round(value);
  if (rounded <= 1) return 1;
  if (rounded >= 5) return 5;
  return rounded;
}

function deriveWeightFromEvidenceCount(evidenceCount: number): number {
  const safeEvidenceCount = clampEvidenceCount(evidenceCount);
  if (safeEvidenceCount >= 5) return 5;
  if (safeEvidenceCount >= 3) return 4;
  return 3;
}

function resolveNextWeight(params: {
  existingWeight: number;
  requestedWeightIncrement?: number;
  nextEvidenceCount: number;
}): number {
  const { existingWeight, requestedWeightIncrement, nextEvidenceCount } = params;

  const currentWeight = clampWeight(existingWeight);
  const requestedTarget = clampWeight(requestedWeightIncrement ?? currentWeight);
  const evidenceTarget = deriveWeightFromEvidenceCount(nextEvidenceCount);

  return Math.max(currentWeight, requestedTarget, evidenceTarget);
}

function assertUserId(userId: string): void {
  if (typeof userId !== "string" || userId.trim().length === 0) {
    throw new Error("learningInsights: userId is required.");
  }
}

function assertInsightBody(body: string): void {
  if (typeof body !== "string" || body.trim().length === 0) {
    throw new Error("learningInsights: body is required.");
  }
}

function assertStateLevel(stateLevel?: number | null): void {
  if (
    stateLevel == null ||
    (Number.isInteger(stateLevel) && stateLevel >= 1 && stateLevel <= 5)
  ) {
    return;
  }
  throw new Error("learningInsights: stateLevel must be between 1 and 5.");
}

function parseStateScope(raw: unknown): number[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter(
    (item): item is number =>
      Number.isInteger(item) && item >= 1 && item <= 5,
  );
}

export async function getActiveLearningInsights(
  supabase: SupabaseClient,
  query: LearningInsightQuery,
): Promise<LearningInsightRow[]> {
  assertUserId(query.userId);
  assertStateLevel(query.stateLevel ?? null);

  let builder = supabase
    .from("hopy_learning_insights")
    .select("*")
    .eq("user_id", query.userId)
    .eq("status", "active")
    .order("weight", { ascending: false })
    .order("updated_at", { ascending: false })
    .limit(query.limit ?? 20);

  if (query.language) {
    builder = builder.eq("language", query.language);
  }

  if (query.insightTypes && query.insightTypes.length > 0) {
    builder = builder.in("insight_type", query.insightTypes);
  }

  const { data, error } = await builder;

  if (error) {
    throw new Error(
      `learningInsights:getActiveLearningInsights failed: ${error.message}`,
    );
  }

  const rows = (data ?? []) as LearningInsightRow[];

  if (query.stateLevel == null) {
    return rows;
  }

  return rows.filter((row) => {
    const scope = parseStateScope(row.state_scope);
    return scope.length === 0 || scope.includes(query.stateLevel as number);
  });
}

export async function findActiveLearningInsightByExactBody(
  supabase: SupabaseClient,
  params: {
    userId: string;
    language?: "ja" | "en";
    insightType: LearningInsightType;
    body: string;
  },
): Promise<LearningInsightRow | null> {
  assertUserId(params.userId);
  assertInsightBody(params.body);

  const { data, error } = await supabase
    .from("hopy_learning_insights")
    .select("*")
    .eq("user_id", params.userId)
    .eq("status", "active")
    .eq("language", params.language ?? "ja")
    .eq("insight_type", params.insightType)
    .eq("body", toSafeBody(params.body))
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(
      `learningInsights:findActiveLearningInsightByExactBody failed: ${error.message}`,
    );
  }

  return (data as LearningInsightRow | null) ?? null;
}

export async function insertLearningInsight(
  supabase: SupabaseClient,
  input: LearningInsightInsertInput,
): Promise<LearningInsightRow> {
  assertUserId(input.userId);
  assertInsightBody(input.body);

  const normalizedEvidenceCount = clampEvidenceCount(input.evidenceCount ?? 1);
  const normalizedWeight = clampWeight(
    input.weight ?? deriveWeightFromEvidenceCount(normalizedEvidenceCount),
  );

  const payload = {
    user_id: input.userId,
    thread_id: input.threadId ?? null,
    source_message_id: input.sourceMessageId ?? null,
    source_assistant_message_id: input.sourceAssistantMessageId ?? null,
    language: input.language ?? "ja",
    insight_type: input.insightType,
    body: toSafeBody(input.body),
    applicability: normalizeNullableText(input.applicability),
    state_scope: toSafeStateScope(input.stateScope),
    avoidance_notes: normalizeNullableText(input.avoidanceNotes),
    evidence_count: normalizedEvidenceCount,
    weight: normalizedWeight,
    status: input.status ?? "active",
  };

  const { data, error } = await supabase
    .from("hopy_learning_insights")
    .insert(payload)
    .select("*")
    .single();

  if (error) {
    throw new Error(
      `learningInsights:insertLearningInsight failed: ${error.message}`,
    );
  }

  return data as LearningInsightRow;
}

export async function updateLearningInsightById(
  supabase: SupabaseClient,
  params: {
    insightId: string;
    applicability?: string | null;
    stateScope?: number[];
    avoidanceNotes?: string | null;
    evidenceCount?: number;
    weight?: number;
    status?: LearningInsightStatus;
    deletedAt?: string | null;
  },
): Promise<LearningInsightRow> {
  if (!params.insightId || params.insightId.trim().length === 0) {
    throw new Error("learningInsights: insightId is required.");
  }

  const patch: Record<string, unknown> = {};

  if (params.applicability !== undefined) {
    patch.applicability = normalizeNullableText(params.applicability);
  }
  if (params.stateScope !== undefined) {
    patch.state_scope = toSafeStateScope(params.stateScope);
  }
  if (params.avoidanceNotes !== undefined) {
    patch.avoidance_notes = normalizeNullableText(params.avoidanceNotes);
  }
  if (params.evidenceCount !== undefined) {
    patch.evidence_count = clampEvidenceCount(params.evidenceCount);
  }
  if (params.weight !== undefined) {
    patch.weight = clampWeight(params.weight);
  }
  if (params.status !== undefined) {
    patch.status = params.status;
  }
  if (params.deletedAt !== undefined) {
    patch.deleted_at = params.deletedAt;
  }

  const { data, error } = await supabase
    .from("hopy_learning_insights")
    .update(patch)
    .eq("id", params.insightId)
    .select("*")
    .single();

  if (error) {
    throw new Error(
      `learningInsights:updateLearningInsightById failed: ${error.message}`,
    );
  }

  return data as LearningInsightRow;
}

export async function mergeLearningInsight(
  supabase: SupabaseClient,
  input: LearningInsightMergeInput,
): Promise<LearningInsightRow> {
  assertUserId(input.userId);
  assertInsightBody(input.body);

  const existing = await findActiveLearningInsightByExactBody(supabase, {
    userId: input.userId,
    language: input.language ?? "ja",
    insightType: input.insightType,
    body: input.body,
  });

  const normalizedEvidenceIncrement = clampEvidenceCount(
    input.evidenceIncrement ?? 1,
  );

  if (!existing) {
    return insertLearningInsight(supabase, {
      userId: input.userId,
      threadId: input.threadId ?? null,
      sourceMessageId: input.triggerMessageId ?? null,
      sourceAssistantMessageId: input.assistantMessageId ?? null,
      language: input.language ?? "ja",
      insightType: input.insightType,
      body: input.body,
      applicability: input.applicability ?? null,
      stateScope: input.stateScope ?? [],
      avoidanceNotes: input.avoidanceNotes ?? null,
      evidenceCount: normalizedEvidenceIncrement,
      weight: input.weightIncrement ?? deriveWeightFromEvidenceCount(1),
      status: "active",
    });
  }

  const mergedStateScope = Array.from(
    new Set([
      ...parseStateScope(existing.state_scope),
      ...toSafeStateScope(input.stateScope),
    ]),
  ).sort((a, b) => a - b);

  const nextEvidenceCount =
    clampEvidenceCount(existing.evidence_count) + normalizedEvidenceIncrement;

  const nextWeight = resolveNextWeight({
    existingWeight: existing.weight,
    requestedWeightIncrement: input.weightIncrement,
    nextEvidenceCount,
  });

  const merged = await updateLearningInsightById(supabase, {
    insightId: existing.id,
    applicability:
      normalizeNullableText(input.applicability) ?? existing.applicability,
    stateScope: mergedStateScope,
    avoidanceNotes:
      normalizeNullableText(input.avoidanceNotes) ?? existing.avoidance_notes,
    evidenceCount: nextEvidenceCount,
    weight: nextWeight,
  });

  return merged;
}

export async function trashLearningInsight(
  supabase: SupabaseClient,
  params: { insightId: string },
): Promise<LearningInsightRow> {
  return updateLearningInsightById(supabase, {
    insightId: params.insightId,
    status: "trash",
    deletedAt: new Date().toISOString(),
  });
}

export async function restoreLearningInsight(
  supabase: SupabaseClient,
  params: { insightId: string },
): Promise<LearningInsightRow> {
  return updateLearningInsightById(supabase, {
    insightId: params.insightId,
    status: "active",
    deletedAt: null,
  });
}

export async function insertLearningUpdateLog(
  supabase: SupabaseClient,
  params: {
    userId: string;
    threadId?: string | null;
    triggerMessageId?: string | null;
    assistantMessageId?: string | null;
    insightId?: string | null;
    actionType: LearningUpdateActionType;
    actionNote?: string | null;
    deltaEvidenceCount?: number | null;
    deltaWeight?: number | null;
  },
): Promise<LearningUpdateLogRow> {
  assertUserId(params.userId);

  const payload = {
    user_id: params.userId,
    thread_id: params.threadId ?? null,
    trigger_message_id: params.triggerMessageId ?? null,
    assistant_message_id: params.assistantMessageId ?? null,
    insight_id: params.insightId ?? null,
    action_type: params.actionType,
    action_note: normalizeNullableText(params.actionNote),
    delta_evidence_count: params.deltaEvidenceCount ?? null,
    delta_weight: params.deltaWeight ?? null,
  };

  const { data, error } = await supabase
    .from("hopy_learning_update_logs")
    .insert(payload)
    .select("*")
    .single();

  if (error) {
    throw new Error(
      `learningInsights:insertLearningUpdateLog failed: ${error.message}`,
    );
  }

  return data as LearningUpdateLogRow;
}

export async function upsertLearningInsightWithLog(
  supabase: SupabaseClient,
  input: LearningInsightMergeInput,
): Promise<LearningInsightRow> {
  const existing = await findActiveLearningInsightByExactBody(supabase, {
    userId: input.userId,
    language: input.language ?? "ja",
    insightType: input.insightType,
    body: input.body,
  });

  const previousWeight = existing ? clampWeight(existing.weight) : null;
  const row = await mergeLearningInsight(supabase, input);
  const nextWeight = clampWeight(row.weight);

  await insertLearningUpdateLog(supabase, {
    userId: input.userId,
    threadId: input.threadId ?? null,
    triggerMessageId: input.triggerMessageId ?? null,
    assistantMessageId: input.assistantMessageId ?? null,
    insightId: row.id,
    actionType: existing ? "merge" : "insert",
    actionNote: existing
      ? "Merged evidence into existing learning insight and applied bounded weight update."
      : "Inserted new learning insight.",
    deltaEvidenceCount: clampEvidenceCount(input.evidenceIncrement ?? 1),
    deltaWeight:
      previousWeight == null ? nextWeight : Math.max(0, nextWeight - previousWeight),
  });

  return row;
}