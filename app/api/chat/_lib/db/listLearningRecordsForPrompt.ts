// /app/api/chat/_lib/db/listLearningRecordsForPrompt.ts
import type { SupabaseClient } from "@supabase/supabase-js";

export type LearningPolarity = "avoid" | "promote";
export type LearningScope = "global" | "user" | "state_specific";
export type LearningType =
  | "expression_preference"
  | "closing_preference"
  | "support_style_preference"
  | "concreteness_preference"
  | "emotional_temperature_preference"
  | "natural_phrase_asset"
  | "anti_ai_pattern"
  | "response_effect_signal"
  | "state_specific_support_preference"
  | "forbidden_expression_pattern";

export type LearningPromptRecord = {
  id: string;
  user_id: string | null;
  source_type: string;
  learning_type: LearningType | string;
  body: string;
  cue: string;
  polarity: LearningPolarity | string;
  scope: LearningScope | string;
  weight: number;
  evidence_count: number;
  source_message_id: string | null;
  source_thread_id: string | null;
  state_level: 1 | 2 | 3 | 4 | 5 | null;
  current_phase: 1 | 2 | 3 | 4 | 5 | null;
  status: string;
  created_at: string;
  updated_at: string;
};

export type ListLearningRecordsForPromptParams = {
  supabase: SupabaseClient;
  userId: string | null;
  stateLevel: 1 | 2 | 3 | 4 | 5 | null;
  learningTypes?: LearningType[];
  limit?: number;
};

const DEFAULT_LIMIT = 24;
const MAX_FETCH_MULTIPLIER = 8;
const MIN_FETCH_SIZE = 120;

function isLearningScope(value: string): value is LearningScope {
  return value === "global" || value === "user" || value === "state_specific";
}

function isLearningPolarity(value: string): value is LearningPolarity {
  return value === "avoid" || value === "promote";
}

function isLearningType(value: string): value is LearningType {
  return (
    value === "expression_preference" ||
    value === "closing_preference" ||
    value === "support_style_preference" ||
    value === "concreteness_preference" ||
    value === "emotional_temperature_preference" ||
    value === "natural_phrase_asset" ||
    value === "anti_ai_pattern" ||
    value === "response_effect_signal" ||
    value === "state_specific_support_preference" ||
    value === "forbidden_expression_pattern"
  );
}

function normalizeLimit(limit?: number): number {
  if (!Number.isFinite(limit)) return DEFAULT_LIMIT;
  const safe = Math.floor(limit as number);
  if (safe <= 0) return DEFAULT_LIMIT;
  return safe;
}

function shouldIncludeRecord(
  record: LearningPromptRecord,
  userId: string | null,
  stateLevel: 1 | 2 | 3 | 4 | 5 | null,
): boolean {
  if (record.status !== "active") return false;
  if (!isLearningScope(record.scope)) return false;
  if (!isLearningPolarity(record.polarity)) return false;

  if (record.scope === "global") {
    return record.user_id == null && record.state_level == null;
  }

  if (record.scope === "user") {
    if (!userId) return false;
    if (record.state_level != null) return false;
    return record.user_id === userId;
  }

  if (record.scope === "state_specific") {
    if (stateLevel == null) return false;
    if (record.state_level !== stateLevel) return false;
    return record.user_id == null || record.user_id === userId;
  }

  return false;
}

function scopePriority(scope: LearningScope): number {
  if (scope === "user") return 0;
  if (scope === "state_specific") return 1;
  return 2;
}

function polarityPriority(polarity: LearningPolarity): number {
  if (polarity === "avoid") return 0;
  return 1;
}

function buildLearningTypePriorityMap(
  learningTypes?: LearningType[],
): Map<LearningType, number> {
  const priorityMap = new Map<LearningType, number>();

  if (!learningTypes || learningTypes.length === 0) {
    return priorityMap;
  }

  for (let index = 0; index < learningTypes.length; index += 1) {
    const learningType = learningTypes[index];
    if (!priorityMap.has(learningType)) {
      priorityMap.set(learningType, index);
    }
  }

  return priorityMap;
}

function learningTypePriority(
  learningType: LearningType | string,
  priorityMap: Map<LearningType, number>,
): number {
  if (!isLearningType(learningType)) return Number.MAX_SAFE_INTEGER;
  const priority = priorityMap.get(learningType);
  return priority == null ? Number.MAX_SAFE_INTEGER : priority;
}

function comparePromptRecord(
  a: LearningPromptRecord,
  b: LearningPromptRecord,
  learningTypePriorityMap: Map<LearningType, number>,
): number {
  const polarityDiff =
    polarityPriority(a.polarity as LearningPolarity) -
    polarityPriority(b.polarity as LearningPolarity);
  if (polarityDiff !== 0) return polarityDiff;

  const scopeDiff =
    scopePriority(a.scope as LearningScope) -
    scopePriority(b.scope as LearningScope);
  if (scopeDiff !== 0) return scopeDiff;

  const learningTypeDiff =
    learningTypePriority(a.learning_type, learningTypePriorityMap) -
    learningTypePriority(b.learning_type, learningTypePriorityMap);
  if (learningTypeDiff !== 0) return learningTypeDiff;

  const weightDiff = Number(b.weight) - Number(a.weight);
  if (weightDiff !== 0) return weightDiff;

  const evidenceDiff = b.evidence_count - a.evidence_count;
  if (evidenceDiff !== 0) return evidenceDiff;

  return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
}

async function fetchScopedLearningRecords(params: {
  supabase: SupabaseClient;
  userId: string | null;
  stateLevel: 1 | 2 | 3 | 4 | 5 | null;
  learningTypes?: LearningType[];
  fetchSize: number;
}): Promise<LearningPromptRecord[]> {
  const { supabase, userId, stateLevel, learningTypes, fetchSize } = params;

  const baseSelect = [
    "id",
    "user_id",
    "source_type",
    "learning_type",
    "body",
    "cue",
    "polarity",
    "scope",
    "weight",
    "evidence_count",
    "source_message_id",
    "source_thread_id",
    "state_level",
    "current_phase",
    "status",
    "created_at",
    "updated_at",
  ].join(", ");

  const rows: LearningPromptRecord[] = [];

  async function runScopedQuery(
    scope: LearningScope,
    options?: {
      userScoped?: boolean;
      stateScoped?: boolean;
    },
  ): Promise<void> {
    let query = supabase
      .from("hopy_response_learning")
      .select(baseSelect)
      .eq("status", "active")
      .eq("scope", scope)
      .order("weight", { ascending: false })
      .order("evidence_count", { ascending: false })
      .order("updated_at", { ascending: false })
      .limit(fetchSize);

    if (learningTypes && learningTypes.length > 0) {
      query = query.in("learning_type", learningTypes);
    }

    if (options?.userScoped) {
      if (!userId) return;
      query = query.eq("user_id", userId).is("state_level", null);
    }

    if (options?.stateScoped) {
      if (stateLevel == null) return;
      query = query.eq("state_level", stateLevel);

      if (userId) {
        query = query.or(`user_id.is.null,user_id.eq.${userId}`);
      } else {
        query = query.is("user_id", null);
      }
    }

    if (!options?.userScoped && !options?.stateScoped) {
      query = query.is("user_id", null).is("state_level", null);
    }

    const { data, error } = await query;
    if (error) {
      throw new Error(
        `Failed to list learning records for prompt: ${error.message}`,
      );
    }

    rows.push(...(((data ?? []) as LearningPromptRecord[]).filter(Boolean)));
  }

  await runScopedQuery("user", { userScoped: true });
  await runScopedQuery("state_specific", { stateScoped: true });
  await runScopedQuery("global");

  return rows;
}

function dedupeRecords(records: LearningPromptRecord[]): LearningPromptRecord[] {
  const seen = new Set<string>();
  const out: LearningPromptRecord[] = [];

  for (const record of records) {
    const key = String(record.id ?? "").trim();
    if (!key) continue;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(record);
  }

  return out;
}

export async function listLearningRecordsForPrompt({
  supabase,
  userId,
  stateLevel,
  learningTypes,
  limit,
}: ListLearningRecordsForPromptParams): Promise<LearningPromptRecord[]> {
  const resolvedLimit = normalizeLimit(limit);
  const fetchSize = Math.max(
    resolvedLimit * MAX_FETCH_MULTIPLIER,
    MIN_FETCH_SIZE,
  );
  const learningTypePriorityMap = buildLearningTypePriorityMap(learningTypes);

  const rows = await fetchScopedLearningRecords({
    supabase,
    userId,
    stateLevel,
    learningTypes,
    fetchSize,
  });

  return dedupeRecords(rows)
    .filter((record) => shouldIncludeRecord(record, userId, stateLevel))
    .sort((a, b) => comparePromptRecord(a, b, learningTypePriorityMap))
    .slice(0, resolvedLimit);
}

export default listLearningRecordsForPrompt;