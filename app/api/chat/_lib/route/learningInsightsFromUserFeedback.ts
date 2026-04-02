// /app/api/chat/_lib/route/learningInsightsFromUserFeedback.ts
import type { SupabaseClient } from "@supabase/supabase-js";

import { errorText } from "../infra/text";
import type { Lang } from "../router/simpleRouter";
import {
  upsertLearningInsightWithLog,
  type LearningInsightType,
} from "../db/learningInsights";

export type LearningInsightCandidate = {
  insightType: LearningInsightType;
  body: string;
  stateScope?: number[];
  weightIncrement?: number;
};

export type LearningSaveDebug = {
  attempted: boolean;
  inserted: number;
  reason: string | null;
  error: string | null;
};

function normalizeText(value: string): string {
  return value.trim();
}

function includesAnyKeyword(text: string, keywords: string[]): boolean {
  return keywords.some((keyword) => keyword && text.includes(keyword));
}

function isStrongFeedbackSignal(text: string): boolean {
  return includesAnyKeyword(text, [
    "違う",
    "ちがう",
    "嫌",
    "いや",
    "やめて",
    "避け",
    "回避",
    "いらない",
    "弱い",
    "不自然",
    "不満",
    "AIっぽ",
    "ChatGPTっぽ",
    "chatgptっぽ",
    "きれいすぎ",
    "抽象",
    "余白",
    "脇に置",
    "足場",
    "受け止めだけ",
  ]);
}

function buildExpressionAvoidanceCandidate(
  text: string,
): LearningInsightCandidate | null {
  if (
    !includesAnyKeyword(text, [
      "AIっぽ",
      "ChatGPTっぽ",
      "chatgptっぽ",
      "抽象",
      "きれいすぎ",
      "美文",
      "余白",
      "脇に置",
      "足場",
      "比喩",
    ])
  ) {
    return null;
  }

  return {
    insightType: "expression_avoidance",
    body: "抽象的できれいすぎる表現やAIっぽい定型表現は避ける。",
    weightIncrement: 5,
  };
}

function buildExpressionPreferenceCandidate(
  text: string,
): LearningInsightCandidate | null {
  if (
    !includesAnyKeyword(text, [
      "自然な日本語",
      "自然",
      "人が書いた",
      "うんうん",
      "読める",
      "読み進め",
      "実感",
      "体感",
    ])
  ) {
    return null;
  }

  return {
    insightType: "expression_preference",
    body: "実感に触る自然な日本語と、人が書いたように読める表現を優先する。",
    weightIncrement: 5,
  };
}

function buildSupportStyleCandidate(params: {
  text: string;
  currentStateLevel: 1 | 2 | 3 | 4 | 5;
}): LearningInsightCandidate | null {
  const { text, currentStateLevel } = params;

  if (
    !includesAnyKeyword(text, [
      "提案",
      "具体",
      "小さな進み方",
      "次になに",
      "次はなに",
      "放置",
      "受け止めだけ",
      "行動してみる",
      "やってみる",
      "始める",
      "一歩",
      "まずは",
      "小さく",
    ])
  ) {
    return null;
  }

  return {
    insightType: "state_support_style",
    body: "受け止めだけで終わらず、小さく具体的な支えや提案を含める。",
    stateScope: currentStateLevel <= 3 ? [1, 2, 3] : [currentStateLevel],
    weightIncrement: 5,
  };
}

function buildClosingPreferenceCandidate(
  text: string,
): LearningInsightCandidate | null {
  if (
    !includesAnyKeyword(text, [
      "締め",
      "終わり方",
      "まとめ方",
      "きれいにまとめる",
      "最後の1",
      "最後の1〜2文",
    ])
  ) {
    return null;
  }

  return {
    insightType: "closing_preference",
    body: "抽象的にきれいにまとめる締めを避け、少し具体を残して終える。",
    weightIncrement: 4,
  };
}

function buildTonePreferenceCandidate(
  text: string,
): LearningInsightCandidate | null {
  if (
    !includesAnyKeyword(text, [
      "温度",
      "熱量",
      "テンション",
      "冷たく",
      "明るすぎ",
      "しっとり",
    ])
  ) {
    return null;
  }

  return {
    insightType: "tone_preference",
    body: "明るすぎず冷たすぎない温度感で、静かに届く熱量を優先する。",
    weightIncrement: 4,
  };
}

function buildLearningInsightCandidatesFromUserText(params: {
  userText: string;
  currentStateLevel: 1 | 2 | 3 | 4 | 5;
}): LearningInsightCandidate[] {
  const { userText, currentStateLevel } = params;
  const text = normalizeText(userText);
  if (!text) return [];

  // β版Freeでは保存しすぎない。
  // 明示指摘・強い違和感・回答品質へ継続的に効くものを優先する。
  const strongFeedback = isStrongFeedbackSignal(text);

  const candidates: LearningInsightCandidate[] = [];

  const expressionAvoidanceCandidate = buildExpressionAvoidanceCandidate(text);
  if (expressionAvoidanceCandidate) {
    candidates.push(expressionAvoidanceCandidate);
  }

  const supportStyleCandidate = buildSupportStyleCandidate({
    text,
    currentStateLevel,
  });
  if (supportStyleCandidate) {
    candidates.push(supportStyleCandidate);
  }

  const closingPreferenceCandidate = buildClosingPreferenceCandidate(text);
  if (closingPreferenceCandidate) {
    candidates.push(closingPreferenceCandidate);
  }

  // 強い違和感指摘がある場合は、品質へ効きやすい preference 系も保存候補にする
  if (strongFeedback) {
    const expressionPreferenceCandidate =
      buildExpressionPreferenceCandidate(text);
    if (expressionPreferenceCandidate) {
      candidates.push(expressionPreferenceCandidate);
    }

    const tonePreferenceCandidate = buildTonePreferenceCandidate(text);
    if (tonePreferenceCandidate) {
      candidates.push(tonePreferenceCandidate);
    }
  }

  const unique = new Map<string, LearningInsightCandidate>();
  for (const candidate of candidates) {
    const stateKey =
      candidate.stateScope && candidate.stateScope.length > 0
        ? candidate.stateScope.join(",")
        : "";
    const key = `${candidate.insightType}:${candidate.body}:${stateKey}`;
    if (!unique.has(key)) {
      unique.set(key, candidate);
    }
  }

  return Array.from(unique.values());
}

export async function saveLearningInsightsFromUserFeedback(params: {
  supabase: SupabaseClient;
  authedUserId: string;
  resolvedConversationId: string;
  userMessageId: string;
  assistantMessageId: string;
  userText: string;
  currentStateLevel: 1 | 2 | 3 | 4 | 5;
  uiLang: Lang;
}): Promise<LearningSaveDebug> {
  const {
    supabase,
    authedUserId,
    resolvedConversationId,
    userMessageId,
    assistantMessageId,
    userText,
    currentStateLevel,
    uiLang,
  } = params;

  const normalizedUserText = normalizeText(userText);
  if (!normalizedUserText) {
    return {
      attempted: false,
      inserted: 0,
      reason: "empty_user_text",
      error: null,
    };
  }

  const candidates = buildLearningInsightCandidatesFromUserText({
    userText: normalizedUserText,
    currentStateLevel,
  });

  if (candidates.length <= 0) {
    return {
      attempted: false,
      inserted: 0,
      reason: "no_candidates",
      error: null,
    };
  }

  let inserted = 0;
  let firstError: string | null = null;

  for (const candidate of candidates) {
    try {
      await upsertLearningInsightWithLog(supabase, {
        userId: authedUserId,
        threadId: resolvedConversationId,
        triggerMessageId: userMessageId,
        assistantMessageId: assistantMessageId || null,
        language: uiLang === "en" ? "en" : "ja",
        insightType: candidate.insightType,
        body: candidate.body,
        stateScope: candidate.stateScope ?? [],
        evidenceIncrement: 1,
        weightIncrement: candidate.weightIncrement ?? 1,
      });
      inserted += 1;
    } catch (e: any) {
      if (!firstError) {
        firstError = errorText(e) || String(e?.message ?? e);
      }
    }
  }

  if (inserted > 0) {
    return {
      attempted: true,
      inserted,
      reason: "inserted",
      error: firstError,
    };
  }

  return {
    attempted: true,
    inserted: 0,
    reason: "all_failed",
    error: firstError ?? "learning_save_failed",
  };
}