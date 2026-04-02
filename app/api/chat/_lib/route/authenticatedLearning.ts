// /app/api/chat/_lib/route/authenticatedLearning.ts

import type { SupabaseClient } from "@supabase/supabase-js";

import { errorText } from "../infra/text";
import { saveResponseGenerationLog } from "../learning/saveResponseGenerationLog";
import { saveStateTransitionSignal } from "../learning/saveStateTransitionSignal";
import {
  extractPhraseObservations,
  type ExtractedPhraseObservation,
} from "../learning/extractPhraseObservations";
import { insertPhraseObservations } from "../db/phraseObservations";
import { upsertPhrasePattern } from "../learning/upsertPhrasePattern";
import {
  extractLearningCandidates,
  type LearningCandidate,
} from "../hopy/learning/extractLearningCandidates";
import { shouldPersistLearning } from "../hopy/learning/shouldPersistLearning";
import { upsertLearningRecord } from "../db/upsertLearningRecord";
import {
  listLearningRecordsForPrompt,
  type LearningType,
} from "../db/listLearningRecordsForPrompt";
import {
  buildLearningPromptContext,
  type LearningPromptContext,
} from "../hopy/learning/buildLearningPromptContext";
import type { Lang } from "../router/simpleRouter";

export type AuthenticatedLearningConfirmedTurn = {
  assistantText: string;
  currentPhase: 1 | 2 | 3 | 4 | 5;
  currentStateLevel: 1 | 2 | 3 | 4 | 5;
  prevPhase: 1 | 2 | 3 | 4 | 5;
  prevStateLevel: 1 | 2 | 3 | 4 | 5;
  stateChanged: boolean;
};

export type UserPhraseLearningOutcome = {
  attempted: boolean;
  observationCount: number;
  persistableObservationCount: number;
  insertedObservationCount: number;
  upsertedPatternCount: number;
  reason: string | null;
  error: string | null;
};

export type AssistantLearningLogsOutcome = {
  responseGenerationLogOk: boolean | null;
  responseGenerationLogError: string | null;
  stateTransitionSignalOk: boolean | null;
  stateTransitionSignalError: string | null;
};

export type LearningInsightRow = {
  body: string | null;
  weight: number | null;
  updated_at?: string | null;
  state_scope?: unknown;
};

export type ConfirmedLearningSaveOutcome = {
  attempted: boolean;
  inserted: number;
  reason: string | null;
  error: string | null;
};

const PROMPT_LEARNING_TYPES: LearningType[] = [
  "expression_preference",
  "closing_preference",
  "support_style_preference",
  "concreteness_preference",
  "emotional_temperature_preference",
  "natural_phrase_asset",
  "anti_ai_pattern",
  "response_effect_signal",
  "state_specific_support_preference",
  "forbidden_expression_pattern",
];

const EXPLICIT_LEARNING_FEEDBACK_PATTERN =
  /説明っぽ|抽象的|きれいすぎ|AIっぽ|ChatGPTっぽ|不自然|違和感|寄り添|自然な日本語|うんうん|具体|小さく|提案|支え|締め|終わり方|感動|ワクワク|ウキウキ|響く|伝わる|しっくり|避けて|やめて|ほしい|してほしい|してください|自然|読みやす|わかりやす|助か|ありがた|好き|良い|いい|返し|回答|言い方|言い回し|文|文章|言葉|雰囲気|トーン|感じ/i;

function normalizeLearningInsightBody(value: unknown): string {
  if (typeof value !== "string") return "";
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : "";
}

function normalizeLearningInsightWeight(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string") {
    const n = Number(value);
    if (Number.isFinite(n)) {
      return n;
    }
  }

  return 0;
}

function parseLearningStateScope(raw: unknown): number[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter(
    (item): item is number =>
      Number.isInteger(item) && item >= 1 && item <= 5,
  );
}

function isAvoidLearningInsightBody(body: string): boolean {
  return [
    "避ける",
    "回避",
    "禁止",
    "AIっぽ",
    "抽象",
    "きれいすぎ",
    "違和感",
    "自然じゃ",
    "不自然",
    "avoid",
    "forbidden",
    "anti",
  ].some((keyword) => body.includes(keyword));
}

function sortLearningRows(params: {
  rows: LearningInsightRow[];
  currentStateLevel: 1 | 2 | 3 | 4 | 5;
}): LearningInsightRow[] {
  const { rows, currentStateLevel } = params;

  return [...rows].sort((a, b) => {
    const aBody = normalizeLearningInsightBody(a?.body);
    const bBody = normalizeLearningInsightBody(b?.body);

    const aAvoidRank = isAvoidLearningInsightBody(aBody) ? 0 : 1;
    const bAvoidRank = isAvoidLearningInsightBody(bBody) ? 0 : 1;
    if (aAvoidRank !== bAvoidRank) {
      return aAvoidRank - bAvoidRank;
    }

    const aScope = parseLearningStateScope(a?.state_scope);
    const bScope = parseLearningStateScope(b?.state_scope);

    const aStateRank =
      aScope.length > 0 && aScope.includes(currentStateLevel) ? 0 : 1;
    const bStateRank =
      bScope.length > 0 && bScope.includes(currentStateLevel) ? 0 : 1;
    if (aStateRank !== bStateRank) {
      return aStateRank - bStateRank;
    }

    const aWeight = normalizeLearningInsightWeight(a?.weight);
    const bWeight = normalizeLearningInsightWeight(b?.weight);
    if (aWeight !== bWeight) {
      return bWeight - aWeight;
    }

    const aUpdatedAt = typeof a?.updated_at === "string" ? a.updated_at : "";
    const bUpdatedAt = typeof b?.updated_at === "string" ? b.updated_at : "";
    if (aUpdatedAt !== bUpdatedAt) {
      return bUpdatedAt.localeCompare(aUpdatedAt);
    }

    return aBody.localeCompare(bBody);
  });
}

function buildLearningBlockFromRows(rows: LearningInsightRow[]): string {
  const normalizedLines = rows
    .map((row) => {
      const body = normalizeLearningInsightBody(row?.body);
      if (!body) return "";

      const weight = normalizeLearningInsightWeight(row?.weight);
      if (weight > 0) {
        return `- ${body} (weight: ${weight})`;
      }

      return `- ${body}`;
    })
    .filter(Boolean);

  if (normalizedLines.length <= 0) {
    return "";
  }

  return ["HOPY回答へ反映する学習知見:", ...normalizedLines].join("\n");
}

export function extractLearningBlockFromBaseSystemPrompt(
  baseSystemPrompt: string,
): string {
  const source = String(baseSystemPrompt ?? "");
  if (!source) return "";

  const marker = "学習DBブロック:";
  const markerIndex = source.indexOf(marker);
  if (markerIndex < 0) return "";

  const afterMarker = source.slice(markerIndex + marker.length).trimStart();
  if (!afterMarker) return "";

  const trimmed = afterMarker.trim();
  if (!trimmed || trimmed === "(なし)") {
    return "";
  }

  return trimmed;
}

export async function loadLearningBlock(params: {
  supabase: SupabaseClient;
  userId: string;
  currentStateLevel: 1 | 2 | 3 | 4 | 5;
}): Promise<string> {
  const { supabase, userId, currentStateLevel } = params;

  try {
    const { data, error } = await supabase
      .from("hopy_learning_insights")
      .select("body, weight, updated_at, state_scope")
      .eq("user_id", userId)
      .eq("status", "active")
      .limit(24);

    if (error || !Array.isArray(data) || data.length <= 0) {
      return "";
    }

    const sortedRows = sortLearningRows({
      rows: data as LearningInsightRow[],
      currentStateLevel,
    }).slice(0, 12);

    return buildLearningBlockFromRows(sortedRows);
  } catch {
    return "";
  }
}

export async function loadLearningPromptContext(params: {
  supabase: SupabaseClient;
  userId: string;
  currentStateLevel: 1 | 2 | 3 | 4 | 5;
}): Promise<LearningPromptContext | null> {
  const { supabase, userId, currentStateLevel } = params;

  try {
    const records = await listLearningRecordsForPrompt({
      supabase,
      userId,
      stateLevel: currentStateLevel,
      learningTypes: PROMPT_LEARNING_TYPES,
      limit: 16,
    });

    if (!Array.isArray(records) || records.length <= 0) {
      return null;
    }

    const context = buildLearningPromptContext({
      records,
      stateLevel: currentStateLevel,
      maxItemsPerCategory: 3,
    });

    const hasAnyItems =
      context.avoidPatterns.length > 0 ||
      context.preferredExpressions.length > 0 ||
      context.supportGuidance.length > 0 ||
      context.closingPreferences.length > 0 ||
      context.concretenessGuidance.length > 0 ||
      context.emotionalTemperatureGuidance.length > 0 ||
      context.effectiveSignals.length > 0;

    return hasAnyItems ? context : null;
  } catch {
    return null;
  }
}

function isLikelyTopicInterestPhrase(normalizedText: string): boolean {
  const s = String(normalizedText ?? "").replace(/\s+/g, " ").trim();
  if (!s) return false;
  if (s.length < 2 || s.length > 40) return false;

  if (/[?？!！。、,.]/.test(s)) return false;

  if (
    /助けて|支えて|聞いて|どうしたら|救って|大丈夫かな|不安|怖い|心配|迷う|迷い|揺れ|しんどい|苦しい|きつい|やる|やります|やってみる|進める|続ける|決めた|決断|逃げたい|避けたい|やりたくない|見たくない|触れたくない|祈る|願う|神頼み/.test(
      s,
    )
  ) {
    return false;
  }

  if (
    /\bhelp\b|\bafraid\b|\bworried\b|\btry\b|\bstart\b|\bdecided\b|\bavoid\b|\bpray\b/.test(
      s.toLowerCase(),
    )
  ) {
    return false;
  }

  return /^[ぁ-んァ-ヶ一-龠ーa-zA-Z0-9\s・&\-()（）]+$/.test(s);
}

function normalizeUserPhraseObservationForPersistence(
  observation: ExtractedPhraseObservation,
): ExtractedPhraseObservation {
  if (!observation || typeof observation !== "object") {
    return observation;
  }

  if (observation.isSensitive || observation.isNoise) {
    return observation;
  }

  if (String(observation.detectedIntent ?? "").trim() !== "不明") {
    return observation;
  }

  if (!isLikelyTopicInterestPhrase(observation.normalizedText)) {
    return observation;
  }

  return {
    ...observation,
    detectedIntent: "興味対象",
  };
}

function shouldPersistUserPhraseObservation(
  observation: ExtractedPhraseObservation,
): boolean {
  if (observation.isSensitive) return false;
  if (observation.isNoise) return false;
  if (String(observation.detectedIntent ?? "").trim() === "不明") return false;

  return true;
}

export async function saveUserPhraseLearning(params: {
  supabase: SupabaseClient;
  userMessageId: string;
  resolvedConversationId: string;
  authedUserId: string;
  userText: string;
  uiLang: Lang;
  estimatedStateLevel: 1 | 2 | 3 | 4 | 5;
}): Promise<UserPhraseLearningOutcome> {
  const {
    supabase,
    userMessageId,
    resolvedConversationId,
    authedUserId,
    userText,
    uiLang,
    estimatedStateLevel,
  } = params;

  try {
    const observations = extractPhraseObservations({
      userText,
      uiLang,
      estimatedStateLevel,
    });

    if (observations.length <= 0) {
      return {
        attempted: false,
        observationCount: 0,
        persistableObservationCount: 0,
        insertedObservationCount: 0,
        upsertedPatternCount: 0,
        reason: "no_observations",
        error: null,
      };
    }

    const persistableObservations: ExtractedPhraseObservation[] = [];

    for (const observation of observations) {
      const normalizedObservation =
        normalizeUserPhraseObservationForPersistence(observation);

      if (shouldPersistUserPhraseObservation(normalizedObservation)) {
        persistableObservations.push(normalizedObservation);
      }
    }

    if (persistableObservations.length <= 0) {
      return {
        attempted: true,
        observationCount: observations.length,
        persistableObservationCount: 0,
        insertedObservationCount: 0,
        upsertedPatternCount: 0,
        reason: "no_persistable_observations",
        error: null,
      };
    }

    const insertResult = await insertPhraseObservations({
      supabase,
      messageId: userMessageId,
      threadId: resolvedConversationId,
      userId: authedUserId,
      observations: persistableObservations,
    });

    if (!insertResult.ok) {
      return {
        attempted: true,
        observationCount: observations.length,
        persistableObservationCount: persistableObservations.length,
        insertedObservationCount: 0,
        upsertedPatternCount: 0,
        reason: "insert_failed",
        error:
          errorText((insertResult as any).error) ||
          "phrase_observations_insert_failed",
      };
    }

    const patternResults = await Promise.allSettled(
      persistableObservations.map((observation) =>
        upsertPhrasePattern({
          supabase,
          userId: authedUserId,
          observation,
        }),
      ),
    );

    const upsertedPatternCount = patternResults.reduce((count, result) => {
      if (result.status === "fulfilled" && result.value?.ok) {
        return count + 1;
      }
      return count;
    }, 0);

    return {
      attempted: true,
      observationCount: observations.length,
      persistableObservationCount: persistableObservations.length,
      insertedObservationCount: persistableObservations.length,
      upsertedPatternCount,
      reason: "saved",
      error: null,
    };
  } catch (e: any) {
    return {
      attempted: true,
      observationCount: 0,
      persistableObservationCount: 0,
      insertedObservationCount: 0,
      upsertedPatternCount: 0,
      reason: "exception",
      error: errorText(e) || String(e?.message ?? e),
    };
  }
}

export async function saveAssistantLearningLogs(params: {
  supabase: SupabaseClient;
  assistantMessageId: string;
  resolvedConversationId: string;
  authedUserId: string;
  confirmedTurn: AuthenticatedLearningConfirmedTurn;
  userMessageId: string;
  selectedStrategy: string;
}): Promise<AssistantLearningLogsOutcome> {
  const {
    supabase,
    assistantMessageId,
    resolvedConversationId,
    authedUserId,
    confirmedTurn,
    userMessageId,
    selectedStrategy,
  } = params;

  const outcome: AssistantLearningLogsOutcome = {
    responseGenerationLogOk: null,
    responseGenerationLogError: null,
    stateTransitionSignalOk: null,
    stateTransitionSignalError: null,
  };

  if (!assistantMessageId) return outcome;

  const responseGenerationLogPromise = saveResponseGenerationLog({
    supabase,
    assistantMessageId,
    threadId: resolvedConversationId,
    userId: authedUserId,
    detectedStateLevel: confirmedTurn.currentStateLevel,
    usedMemoryIds: [],
    usedPatternIds: [],
    usedExpressionAssetIds: [],
    transitionTargetLevel: confirmedTurn.currentStateLevel,
    replyStyle: selectedStrategy || null,
  });

  const stateTransitionSignalPromise = saveStateTransitionSignal({
    supabase,
    threadId: resolvedConversationId,
    userId: authedUserId,
    beforeStateLevel: confirmedTurn.prevStateLevel,
    afterStateLevel: confirmedTurn.currentStateLevel,
    triggerMessageId: userMessageId,
    assistantMessageId,
    transitionKind: confirmedTurn.stateChanged
      ? "state_changed"
      : "state_maintained",
    confidenceScore: confirmedTurn.stateChanged ? 1 : 0,
  });

  const [responseGenerationLogResult, stateTransitionSignalResult] =
    await Promise.allSettled([
      responseGenerationLogPromise,
      stateTransitionSignalPromise,
    ]);

  if (responseGenerationLogResult.status === "fulfilled") {
    outcome.responseGenerationLogOk = responseGenerationLogResult.value.ok;
    if (!responseGenerationLogResult.value.ok) {
      outcome.responseGenerationLogError =
        errorText((responseGenerationLogResult.value as any).error) ||
        "response_generation_log_failed";
    }
  } else {
    outcome.responseGenerationLogOk = false;
    outcome.responseGenerationLogError =
      errorText(responseGenerationLogResult.reason) ||
      String(
        (responseGenerationLogResult.reason as any)?.message ??
          responseGenerationLogResult.reason,
      );
  }

  if (stateTransitionSignalResult.status === "fulfilled") {
    outcome.stateTransitionSignalOk = stateTransitionSignalResult.value.ok;
    if (!stateTransitionSignalResult.value.ok) {
      outcome.stateTransitionSignalError =
        errorText((stateTransitionSignalResult.value as any).error) ||
        "state_transition_signal_failed";
    }
  } else {
    outcome.stateTransitionSignalOk = false;
    outcome.stateTransitionSignalError =
      errorText(stateTransitionSignalResult.reason) ||
      String(
        (stateTransitionSignalResult.reason as any)?.message ??
          stateTransitionSignalResult.reason,
      );
  }

  return outcome;
}

function isLikelyExplicitLearningFeedback(userText: string): boolean {
  const normalized = String(userText ?? "").trim();
  if (!normalized) return false;

  return EXPLICIT_LEARNING_FEEDBACK_PATTERN.test(normalized);
}

export async function saveConfirmedAssistantLearningEntry(params: {
  supabase: SupabaseClient;
  authedUserId: string;
  resolvedConversationId: string;
  userMessageId: string;
  assistantMessageId: string;
  userText: string;
  confirmedTurn: AuthenticatedLearningConfirmedTurn;
  uiLang: Lang;
}): Promise<ConfirmedLearningSaveOutcome> {
  const {
    supabase,
    authedUserId,
    resolvedConversationId,
    assistantMessageId,
    userText,
    confirmedTurn,
  } = params;

  if (!assistantMessageId.trim()) {
    return {
      attempted: false,
      inserted: 0,
      reason: "assistant_message_not_saved",
      error: null,
    };
  }

  if (!confirmedTurn.assistantText.trim()) {
    return {
      attempted: false,
      inserted: 0,
      reason: "assistant_not_confirmed",
      error: null,
    };
  }

  const explicitFeedbackText = isLikelyExplicitLearningFeedback(userText)
    ? userText
    : null;

  if (!explicitFeedbackText) {
    return {
      attempted: false,
      inserted: 0,
      reason: "not_explicit_feedback",
      error: null,
    };
  }

  try {
    const candidates = extractLearningCandidates({
      userMessage: userText,
      assistantReply: confirmedTurn.assistantText,
      stateLevel: confirmedTurn.currentStateLevel,
      currentPhase: confirmedTurn.currentPhase,
      explicitFeedback: explicitFeedbackText,
      reactionSummary: explicitFeedbackText,
      userId: authedUserId,
      sourceMessageId: assistantMessageId,
      sourceThreadId: resolvedConversationId,
    });

    if (!Array.isArray(candidates) || candidates.length <= 0) {
      return {
        attempted: true,
        inserted: 0,
        reason: "no_candidates",
        error: null,
      };
    }

    const persistableCandidates = candidates.filter((candidate) => {
      const decision = shouldPersistLearning(candidate);
      return decision.ok;
    });

    if (persistableCandidates.length <= 0) {
      return {
        attempted: true,
        inserted: 0,
        reason: "no_persistable_candidates",
        error: null,
      };
    }

    const learningResults = await Promise.allSettled(
      persistableCandidates.map((candidate) => {
        const normalizedCandidate: LearningCandidate = {
          ...candidate,
          userId: candidate.scope === "global" ? null : authedUserId,
          sourceMessageId: assistantMessageId,
          sourceThreadId: resolvedConversationId,
        };

        return upsertLearningRecord({
          supabase,
          candidate: normalizedCandidate,
        });
      }),
    );

    const inserted = learningResults.reduce((count, result) => {
      if (
        result.status === "fulfilled" &&
        result.value?.ok &&
        (result.value.action === "inserted" ||
          result.value.action === "updated")
      ) {
        return count + 1;
      }
      return count;
    }, 0);

    return {
      attempted: true,
      inserted,
      reason: inserted > 0 ? "saved" : "noop",
      error: null,
    };
  } catch (e: any) {
    return {
      attempted: true,
      inserted: 0,
      reason: "exception",
      error: errorText(e) || String(e?.message ?? e),
    };
  }
}