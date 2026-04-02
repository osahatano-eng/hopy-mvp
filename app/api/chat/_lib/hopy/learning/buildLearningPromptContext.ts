// /app/api/chat/_lib/hopy/learning/buildLearningPromptContext.ts
import type {
  LearningPromptRecord,
  LearningScope,
  LearningType,
} from "../../db/listLearningRecordsForPrompt";

export type LearningPromptContext = {
  avoidPatterns: string[];
  preferredExpressions: string[];
  supportGuidance: string[];
  closingPreferences: string[];
  concretenessGuidance: string[];
  emotionalTemperatureGuidance: string[];
  effectiveSignals: string[];
};

export type BuildLearningPromptContextParams = {
  records: LearningPromptRecord[];
  stateLevel: 1 | 2 | 3 | 4 | 5 | null;
  maxItemsPerCategory?: number;
};

const DEFAULT_MAX_ITEMS_PER_CATEGORY = 3;

function normalizeMaxItems(value?: number): number {
  if (!Number.isFinite(value)) return DEFAULT_MAX_ITEMS_PER_CATEGORY;
  const safe = Math.floor(value as number);
  if (safe <= 0) return DEFAULT_MAX_ITEMS_PER_CATEGORY;
  return safe;
}

function normalizeBody(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function isNonEmptyBody(value: string): boolean {
  return normalizeBody(value).length > 0;
}

function parseStateScope(raw: unknown): number[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter(
    (item): item is 1 | 2 | 3 | 4 | 5 =>
      Number.isInteger(item) && item >= 1 && item <= 5,
  );
}

function isStateSpecificMatch(
  record: LearningPromptRecord,
  currentStateLevel: 1 | 2 | 3 | 4 | 5 | null,
): boolean {
  if (record.scope !== "state_specific") return false;
  if (currentStateLevel == null) return false;

  const scope = parseStateScope((record as LearningPromptRecord & { state_scope?: unknown }).state_scope);
  if (scope.length <= 0) return false;

  return scope.includes(currentStateLevel);
}

function scopePriority(
  record: LearningPromptRecord,
  currentStateLevel: 1 | 2 | 3 | 4 | 5 | null,
): number {
  if (record.scope === "user") return 0;
  if (isStateSpecificMatch(record, currentStateLevel)) return 1;
  if (record.scope === "global") return 2;
  if (record.scope === "state_specific") return 3;
  if (record.scope === "user" || record.scope === "global") {
    return 4;
  }
  return 99;
}

function compareByPromptPriority(
  a: LearningPromptRecord,
  b: LearningPromptRecord,
  currentStateLevel: 1 | 2 | 3 | 4 | 5 | null,
): number {
  const scopeDiff =
    scopePriority(a, currentStateLevel) - scopePriority(b, currentStateLevel);
  if (scopeDiff !== 0) return scopeDiff;

  const weightDiff = Number(b.weight) - Number(a.weight);
  if (weightDiff !== 0) return weightDiff;

  const evidenceDiff = b.evidence_count - a.evidence_count;
  if (evidenceDiff !== 0) return evidenceDiff;

  return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
}

function sortRecords(
  records: LearningPromptRecord[],
  currentStateLevel: 1 | 2 | 3 | 4 | 5 | null,
): LearningPromptRecord[] {
  return [...records].sort((a, b) =>
    compareByPromptPriority(a, b, currentStateLevel),
  );
}

function dedupeBodies(
  records: LearningPromptRecord[],
  maxItems: number,
): string[] {
  const result: string[] = [];
  const seen = new Set<string>();

  for (const record of records) {
    const normalized = normalizeBody(record.body);
    if (!normalized) continue;
    if (seen.has(normalized)) continue;
    seen.add(normalized);
    result.push(normalized);
    if (result.length >= maxItems) break;
  }

  return result;
}

function isAvoidRecord(record: LearningPromptRecord): boolean {
  return record.polarity === "avoid";
}

function isPromoteRecord(record: LearningPromptRecord): boolean {
  return record.polarity === "promote";
}

function matchesLearningType(
  record: LearningPromptRecord,
  learningTypes: LearningType[],
): boolean {
  return learningTypes.includes(record.learning_type as LearningType);
}

function takeBalancedBodies(
  records: LearningPromptRecord[],
  maxItems: number,
  currentStateLevel: 1 | 2 | 3 | 4 | 5 | null,
): string[] {
  const sorted = sortRecords(records, currentStateLevel);

  const userRecords = sorted.filter((record) => record.scope === "user");
  const matchedStateSpecificRecords = sorted.filter((record) =>
    isStateSpecificMatch(record, currentStateLevel),
  );
  const globalRecords = sorted.filter((record) => record.scope === "global");
  const otherStateSpecificRecords = sorted.filter(
    (record) =>
      record.scope === "state_specific" &&
      !isStateSpecificMatch(record, currentStateLevel),
  );

  const result: string[] = [];
  const seen = new Set<string>();

  function pushFrom(source: LearningPromptRecord[]): void {
    for (const record of source) {
      const normalized = normalizeBody(record.body);
      if (!normalized) continue;
      if (seen.has(normalized)) continue;
      seen.add(normalized);
      result.push(normalized);
      if (result.length >= maxItems) return;
    }
  }

  pushFrom(userRecords);
  if (result.length >= maxItems) return result;

  pushFrom(matchedStateSpecificRecords);
  if (result.length >= maxItems) return result;

  pushFrom(globalRecords);
  if (result.length >= maxItems) return result;

  pushFrom(otherStateSpecificRecords);
  if (result.length >= maxItems) return result;

  for (const record of sorted) {
    const normalized = normalizeBody(record.body);
    if (!normalized) continue;
    if (seen.has(normalized)) continue;
    seen.add(normalized);
    result.push(normalized);
    if (result.length >= maxItems) break;
  }

  return result;
}

function selectAvoidPatterns(
  records: LearningPromptRecord[],
): LearningPromptRecord[] {
  return records.filter(
    (record) =>
      isAvoidRecord(record) &&
      matchesLearningType(record, [
        "anti_ai_pattern",
        "forbidden_expression_pattern",
      ]) &&
      isNonEmptyBody(record.body),
  );
}

function selectPreferredExpressions(
  records: LearningPromptRecord[],
): LearningPromptRecord[] {
  return records.filter(
    (record) =>
      isPromoteRecord(record) &&
      matchesLearningType(record, [
        "expression_preference",
        "natural_phrase_asset",
      ]) &&
      isNonEmptyBody(record.body),
  );
}

function selectSupportGuidance(
  records: LearningPromptRecord[],
): LearningPromptRecord[] {
  return records.filter(
    (record) =>
      isPromoteRecord(record) &&
      matchesLearningType(record, [
        "support_style_preference",
        "state_specific_support_preference",
      ]) &&
      isNonEmptyBody(record.body),
  );
}

function selectClosingPreferences(
  records: LearningPromptRecord[],
): LearningPromptRecord[] {
  return records.filter(
    (record) =>
      matchesLearningType(record, ["closing_preference"]) &&
      isNonEmptyBody(record.body),
  );
}

function selectConcretenessGuidance(
  records: LearningPromptRecord[],
): LearningPromptRecord[] {
  return records.filter(
    (record) =>
      isPromoteRecord(record) &&
      matchesLearningType(record, ["concreteness_preference"]) &&
      isNonEmptyBody(record.body),
  );
}

function selectEmotionalTemperatureGuidance(
  records: LearningPromptRecord[],
): LearningPromptRecord[] {
  return records.filter(
    (record) =>
      isPromoteRecord(record) &&
      matchesLearningType(record, ["emotional_temperature_preference"]) &&
      isNonEmptyBody(record.body),
  );
}

function selectEffectiveSignals(
  records: LearningPromptRecord[],
): LearningPromptRecord[] {
  return records.filter(
    (record) =>
      isPromoteRecord(record) &&
      matchesLearningType(record, ["response_effect_signal"]) &&
      isNonEmptyBody(record.body),
  );
}

export function buildLearningPromptContext({
  records,
  stateLevel,
  maxItemsPerCategory,
}: BuildLearningPromptContextParams): LearningPromptContext {
  const resolvedMaxItems = normalizeMaxItems(maxItemsPerCategory);

  return {
    avoidPatterns: takeBalancedBodies(
      selectAvoidPatterns(records),
      resolvedMaxItems,
      stateLevel,
    ),
    preferredExpressions: takeBalancedBodies(
      selectPreferredExpressions(records),
      resolvedMaxItems,
      stateLevel,
    ),
    supportGuidance: takeBalancedBodies(
      selectSupportGuidance(records),
      resolvedMaxItems,
      stateLevel,
    ),
    closingPreferences: takeBalancedBodies(
      selectClosingPreferences(records),
      resolvedMaxItems,
      stateLevel,
    ),
    concretenessGuidance: takeBalancedBodies(
      selectConcretenessGuidance(records),
      resolvedMaxItems,
      stateLevel,
    ),
    emotionalTemperatureGuidance: takeBalancedBodies(
      selectEmotionalTemperatureGuidance(records),
      resolvedMaxItems,
      stateLevel,
    ),
    effectiveSignals: takeBalancedBodies(
      selectEffectiveSignals(records),
      resolvedMaxItems,
      stateLevel,
    ),
  };
}

export default buildLearningPromptContext;