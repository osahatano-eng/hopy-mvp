// /app/api/chat/_lib/hopy/future-chain/futureChainCandidate.ts

import type { HopyFutureChainPrecheckResult } from "./futureChainCheck";
import { buildDownwardMeaningParts } from "./futureChainDownwardCandidate";
import {
  type HopyFutureChainCandidate,
  type HopyFutureChainConfirmedPayload,
  type HopyFutureChainLanguage,
  type HopyFutureChainSaveCheckResult,
  type HopyFutureChainSourceContext,
  type HopyFutureChainStateLevel,
  type HopyFutureChainTransitionKind,
} from "./futureChainTypes";

type HopyFutureChainTransitionMeaning =
  | "progress"
  | "readjustment"
  | "recovery_entry"
  | "premise_reconsideration"
  | "stabilization"
  | "reinforcement";

type BridgeSummary = {
  insight: string;
  hint: string;
  flow: string;
  reason: string;
};

type HopyFutureChainBridgeEventCandidate = {
  language: HopyFutureChainLanguage;

  from_state_level: HopyFutureChainStateLevel;
  to_state_level: HopyFutureChainStateLevel;

  transition_kind: HopyFutureChainTransitionKind;
  transition_meaning: HopyFutureChainTransitionMeaning;

  user_signal_summary: string;
  hopy_support_summary: string;
  transition_reason: string;
  future_support_hint: string;

  bridge_insight: string;
  bridge_hint: string;
  bridge_flow: string;
  bridge_reason: string;

  owner_visible_summary: string;
  future_visible_summary: string;

  compass_basis: string | null;
  safety_notes: string | null;
  avoidance_notes: string | null;

  source_transition_signal_id: string | null;
  source_assistant_message_id: string;
  source_trigger_message_id: string | null;

  confidence_score: number;
  reuse_scope: "global" | "limited" | "experimental";
  status: "active" | "trash";

  metadata: {
    source: "hopy_confirmed_payload";
    version: "future_chain_pattern_v2";
  };
};

type HopyFutureChainCandidateV2 = HopyFutureChainCandidate & {
  transition_meaning: HopyFutureChainTransitionMeaning;
  support_shape_key: string;
  bridge_event: HopyFutureChainBridgeEventCandidate;
};

type MeaningEvidence = {
  userSignal: string;
  hopySupport: string;
  transitionReason: string;
  futureSupportHint: string;
  bridgeSummary: BridgeSummary;
  compassBasis: string | null;
  transitionMeaning: HopyFutureChainTransitionMeaning;
  supportShapeKey: string;
  evidenceSources: string[];
};

const STATE_LABELS: Record<HopyFutureChainStateLevel, string> = {
  1: "混線",
  2: "模索",
  3: "整理",
  4: "収束",
  5: "決定",
};

const DEFAULT_SAFETY_NOTES =
  "生ログ、個人情報、企業機密、医療・法律・金融判断の断定は保存しない。";

const DEFAULT_AVOIDANCE_NOTES =
  "他ユーザーへそのまま当てはめず、参考候補としてのみ扱う。";

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  return value as Record<string, unknown>;
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function normalizeText(value: unknown): string {
  if (typeof value !== "string") return "";

  return value
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function clipText(value: unknown, maxLength: number): string {
  const text = normalizeText(value);
  if (!text) return "";
  if (text.length <= maxLength) return text;

  return `${text.slice(0, Math.max(0, maxLength - 1)).trim()}…`;
}

function normalizeLanguage(
  value: HopyFutureChainLanguage,
): HopyFutureChainLanguage {
  const normalized = normalizeText(value).toLowerCase();
  if (normalized === "ja") return "ja";
  if (normalized === "en") return "en";
  return "ja";
}

function maskSensitiveText(value: unknown): string {
  return normalizeText(value)
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[email]")
    .replace(/https?:\/\/\S+/gi, "[url]")
    .replace(/\b\d{2,4}[-\s]?\d{2,4}[-\s]?\d{3,4}\b/g, "[number]")
    .replace(/\b\d{8,}\b/g, "[number]")
    .replace(/[「」『』]/g, "")
    .trim();
}

function readNestedRecord(
  record: Record<string, unknown> | null,
  key: string,
): Record<string, unknown> | null {
  if (!record) return null;
  return asRecord(record[key]);
}

function readStringByKeys(
  record: Record<string, unknown> | null,
  keys: string[],
): string {
  if (!record) return "";

  for (const key of keys) {
    const text = normalizeText(record[key]);
    if (text) return text;
  }

  return "";
}

function readMemoryCandidateBody(
  payload: HopyFutureChainConfirmedPayload,
): string {
  const payloadRecord = asRecord(payload);
  const candidates = asArray(payloadRecord?.memory_candidates);

  for (const item of candidates) {
    const candidate = asRecord(item);
    const body = normalizeText(candidate?.body);
    if (body) return body;
  }

  return "";
}

function readDashboardSignalSummary(
  payload: HopyFutureChainConfirmedPayload,
): string {
  const payloadRecord = asRecord(payload);
  const signals = asArray(payloadRecord?.dashboard_signals);

  for (const item of signals) {
    const signal = asRecord(item);
    const type = normalizeText(signal?.type);
    const summary = normalizeText(signal?.summary);

    if ((type === "state_transition" || type === "support_focus") && summary) {
      return summary;
    }
  }

  return "";
}

function readSourceContextUserText(
  sourceContext: HopyFutureChainSourceContext,
): string {
  const sourceRecord = asRecord(sourceContext);

  return readStringByKeys(sourceRecord, [
    "userText",
    "userInput",
    "triggerText",
    "triggerUserText",
    "triggerMessageText",
    "latestUserText",
    "inputText",
  ]);
}

function readSourceContextIds(
  sourceContext: HopyFutureChainSourceContext,
): {
  sourceTransitionSignalId: string | null;
  sourceResponseLearningId: string | null;
  sourceLearningInsightId: string | null;
  sourceAssistantMessageId: string | null;
  sourceTriggerMessageId: string | null;
} {
  const sourceRecord = asRecord(sourceContext);

  return {
    sourceTransitionSignalId:
      clipText(
        readStringByKeys(sourceRecord, [
          "sourceTransitionSignalId",
          "source_transition_signal_id",
          "transitionSignalId",
        ]),
        80,
      ) || null,
    sourceResponseLearningId:
      clipText(
        readStringByKeys(sourceRecord, [
          "sourceResponseLearningId",
          "source_response_learning_id",
          "responseLearningId",
        ]),
        80,
      ) || null,
    sourceLearningInsightId:
      clipText(
        readStringByKeys(sourceRecord, [
          "sourceLearningInsightId",
          "source_learning_insight_id",
          "learningInsightId",
        ]),
        80,
      ) || null,
    sourceAssistantMessageId:
      clipText(
        readStringByKeys(sourceRecord, [
          "sourceAssistantMessageId",
          "source_assistant_message_id",
          "assistantMessageId",
          "assistant_message_id",
        ]),
        80,
      ) || null,
    sourceTriggerMessageId:
      clipText(
        readStringByKeys(sourceRecord, [
          "sourceTriggerMessageId",
          "source_trigger_message_id",
          "triggerMessageId",
          "trigger_message_id",
        ]),
        80,
      ) || null,
  };
}

function collectMeaningText(params: {
  sourceContext: HopyFutureChainSourceContext;
  payload: HopyFutureChainConfirmedPayload;
}): { text: string; sources: string[] } {
  const payloadRecord = asRecord(params.payload);
  const compass = readNestedRecord(payloadRecord, "compass");

  const parts: Array<{ value: string; source: string }> = [
    {
      value: readMemoryCandidateBody(params.payload),
      source: "memory_candidates.body",
    },
    {
      value: readDashboardSignalSummary(params.payload),
      source: "dashboard_signals.summary",
    },
    {
      value: normalizeText(compass?.prompt),
      source: "compass.prompt",
    },
    {
      value: normalizeText(compass?.text),
      source: "compass.text",
    },
    {
      value: normalizeText(params.payload.reply),
      source: "hopy_confirmed_payload.reply",
    },
    {
      value: readSourceContextUserText(params.sourceContext),
      source: "source_context.user_text",
    },
  ];

  const used = parts.filter((part) => normalizeText(part.value));

  return {
    text: maskSensitiveText(used.map((part) => part.value).join("\n")),
    sources: used.map((part) => part.source),
  };
}

function includesAny(text: string, words: string[]): boolean {
  return words.some((word) => text.includes(word));
}

function deriveSupportShapeKeyFromText(text: string): string {
  if (includesAny(text, ["休", "何もしない", "無理に", "急が", "立て直"])) {
    return "rest_permission";
  }

  if (includesAny(text, ["一つ", "1つ", "基準", "判断軸", "絞"])) {
    return "single_criterion_narrowing";
  }

  if (includesAny(text, ["優先", "順番", "並べ", "整理"])) {
    return "priority_sorting";
  }

  if (includesAny(text, ["前提", "見直", "違和感", "戻"])) {
    return "premise_reset";
  }

  if (includesAny(text, ["小さ", "一歩", "少し", "次に"])) {
    return "action_step_smallening";
  }

  if (includesAny(text, ["つら", "しんど", "限界", "怖", "不安", "感情"])) {
    return "emotion_acknowledgement";
  }

  return "reframing";
}

function deriveTransitionMeaning(params: {
  transitionKind: HopyFutureChainTransitionKind;
  evidenceText: string;
  supportShapeKey: string;
}): HopyFutureChainTransitionMeaning | null {
  if (params.transitionKind === "same_level") {
    return null;
  }

  if (params.transitionKind === "upward") {
    if (params.supportShapeKey === "priority_sorting") return "progress";
    if (params.supportShapeKey === "single_criterion_narrowing") {
      return "progress";
    }
    if (params.supportShapeKey === "action_step_smallening") return "progress";
    return "progress";
  }

  if (includesAny(params.evidenceText, ["前提", "見直", "違和感", "戻"])) {
    return "premise_reconsideration";
  }

  if (includesAny(params.evidenceText, ["限界", "無理", "しんど", "つら"])) {
    return "recovery_entry";
  }

  return "readjustment";
}

function buildPatternKey(params: {
  fromStateLevel: HopyFutureChainStateLevel;
  toStateLevel: HopyFutureChainStateLevel;
  transitionMeaning: HopyFutureChainTransitionMeaning;
  supportShapeKey: string;
}): string {
  return [
    `state_${params.fromStateLevel}`,
    `to_${params.toStateLevel}`,
    params.transitionMeaning,
    "by",
    params.supportShapeKey,
  ].join("_");
}

function buildTransitionLabel(params: {
  fromStateLevel: HopyFutureChainStateLevel;
  toStateLevel: HopyFutureChainStateLevel;
  transitionKind: HopyFutureChainTransitionKind;
}): string {
  const fromLabel = STATE_LABELS[params.fromStateLevel];
  const toLabel = STATE_LABELS[params.toStateLevel];

  if (params.transitionKind === "downward") {
    return `${fromLabel}から${toLabel}への再調整`;
  }

  if (params.transitionKind === "same_level") {
    return `${fromLabel}での維持・補強`;
  }

  return `${fromLabel}から${toLabel}への前進`;
}

function buildUserSignalSummary(params: {
  transitionKind: HopyFutureChainTransitionKind;
  supportShapeKey: string;
}): string {
  if (params.transitionKind === "downward") {
    if (params.supportShapeKey === "emotion_acknowledgement") {
      return "ユーザーは、前進を続けるよりも感情や限界感を受け止める必要があるサインを示した。";
    }

    if (params.supportShapeKey === "premise_reset") {
      return "ユーザーは、いったん決めた前提をそのまま進めるより、見直す必要があるサインを示した。";
    }

    return "ユーザーは、決めた状態を保つよりも再調整が必要なサインを示した。";
  }

  if (params.supportShapeKey === "single_criterion_narrowing") {
    return "ユーザーは、迷いを広げるより一つの判断軸へ寄せられるサインを示した。";
  }

  if (params.supportShapeKey === "priority_sorting") {
    return "ユーザーは、複数の選択肢や考えを順番づけし、次に扱う対象を整理できるサインを示した。";
  }

  if (params.supportShapeKey === "action_step_smallening") {
    return "ユーザーは、大きな結論よりも小さな次の一歩へ移れるサインを示した。";
  }

  return "ユーザーは、混ざっていた考えをほどき、次の方向を受け取れるサインを示した。";
}

function buildHopySupportSummary(params: {
  transitionKind: HopyFutureChainTransitionKind;
  supportShapeKey: string;
}): string {
  if (params.supportShapeKey === "rest_permission") {
    return "HOPYは、無理に前進させず、休むことや立て直す余白を許す支援を返した。";
  }

  if (params.supportShapeKey === "single_criterion_narrowing") {
    return "HOPYは、判断軸を一つに絞り、迷いを扱いやすくする支援を返した。";
  }

  if (params.supportShapeKey === "priority_sorting") {
    return "HOPYは、優先順位を整理し、次に見るべき対象を絞る支援を返した。";
  }

  if (params.supportShapeKey === "premise_reset") {
    return "HOPYは、進める前に前提を見直し、無理な決定をほどく支援を返した。";
  }

  if (params.supportShapeKey === "emotion_acknowledgement") {
    return "HOPYは、感情や限界感を否定せず、再調整の入口として扱う支援を返した。";
  }

  if (params.supportShapeKey === "action_step_smallening") {
    return "HOPYは、結論を急がせず、次の一歩を小さくする支援を返した。";
  }

  if (params.transitionKind === "downward") {
    return "HOPYは、状態を無理に上げず、再調整に必要な余白を渡す支援を返した。";
  }

  return "HOPYは、考えをほどき、次の方向を受け取りやすくする支援を返した。";
}

function buildTransitionReason(params: {
  transitionKind: HopyFutureChainTransitionKind;
  transitionMeaning: HopyFutureChainTransitionMeaning;
  supportShapeKey: string;
}): string {
  if (params.transitionMeaning === "recovery_entry") {
    return "無理に決定状態を保つより、限界感を認めることが立て直しの入口になったため。";
  }

  if (params.transitionMeaning === "premise_reconsideration") {
    return "前に進む前に、前提そのものを見直す必要が会話上で明確になったため。";
  }

  if (params.transitionMeaning === "readjustment") {
    return "前進を急ぐより、いったん状態を整え直すことが次の行動につながりやすいため。";
  }

  if (params.supportShapeKey === "single_criterion_narrowing") {
    return "迷いを増やすより、一つの判断軸に寄せることで次の選択が扱いやすくなったため。";
  }

  if (params.supportShapeKey === "priority_sorting") {
    return "複数の考えを同時に抱えるより、優先順位を置くことで次に進みやすくなったため。";
  }

  if (params.transitionKind === "upward") {
    return "思考の焦点が絞られ、次の方向を受け取りやすい状態へ進んだため。";
  }

  return "今回の状態変化に、未来の似たユーザーへ渡せる支援意味が確認できたため。";
}

function buildFutureSupportHint(params: {
  transitionKind: HopyFutureChainTransitionKind;
  transitionMeaning: HopyFutureChainTransitionMeaning;
  supportShapeKey: string;
}): string {
  if (params.transitionMeaning === "recovery_entry") {
    return "似た状態のユーザーには、状態を無理に上げようとせず、まず限界感を認めて休む余白を渡す支援が有効な候補になる。";
  }

  if (params.transitionMeaning === "premise_reconsideration") {
    return "似た状態のユーザーには、答えを急がせず、前提を見直す時間を渡す支援が有効な候補になる。";
  }

  if (params.transitionMeaning === "readjustment") {
    return "似た状態のユーザーには、前進より再調整を先に置き、立て直しの足場を作る支援が有効な候補になる。";
  }

  if (params.supportShapeKey === "single_criterion_narrowing") {
    return "似た状態のユーザーには、選択肢を増やすより、一つの判断軸へ絞る支援が有効な候補になる。";
  }

  if (params.supportShapeKey === "priority_sorting") {
    return "似た状態のユーザーには、同時に全部を扱わせず、優先順位を一つ置く支援が有効な候補になる。";
  }

  if (params.transitionKind === "upward") {
    return "似た状態のユーザーには、見えてきた方向を小さく言語化し、次の一歩へつなげる支援が有効な候補になる。";
  }

  return "似た状態のユーザーには、今回の支援を参考候補として扱い、本人の納得を優先する形が安全である。";
}

function buildBridgeSummary(params: {
  fromStateLevel: HopyFutureChainStateLevel;
  toStateLevel: HopyFutureChainStateLevel;
  transitionKind: HopyFutureChainTransitionKind;
  transitionMeaning: HopyFutureChainTransitionMeaning;
  supportShapeKey: string;
  transitionReason: string;
  futureSupportHint: string;
}): BridgeSummary {
  const label = buildTransitionLabel(params);

  if (params.transitionMeaning === "recovery_entry") {
    return {
      insight: "限界感が出たときは、決定を保つより再調整が必要な場合がある。",
      hint: "答えを出す前に、まず休むことを選択肢に入れる。",
      flow: `${STATE_LABELS[params.fromStateLevel]} → 限界感の表出 → ${STATE_LABELS[params.toStateLevel]}`,
      reason: params.transitionReason,
    };
  }

  if (params.transitionMeaning === "premise_reconsideration") {
    return {
      insight: "違和感が出たときは、行動の前に前提を見直すことが支えになる場合がある。",
      hint: "次へ進む前に、いまの前提が本当に合っているかを一つ確認する。",
      flow: `${STATE_LABELS[params.fromStateLevel]} → 前提の見直し → ${STATE_LABELS[params.toStateLevel]}`,
      reason: params.transitionReason,
    };
  }

  if (params.transitionMeaning === "readjustment") {
    return {
      insight: "前進できない感覚は、失敗ではなく再調整の入口になる場合がある。",
      hint: "進むことより、いったん整え直すことを選択肢に入れる。",
      flow: `${STATE_LABELS[params.fromStateLevel]} → 再調整 → ${STATE_LABELS[params.toStateLevel]}`,
      reason: params.transitionReason,
    };
  }

  if (params.supportShapeKey === "single_criterion_narrowing") {
    return {
      insight: "迷いが広がるときは、一つの判断軸に絞ることで動きやすくなる場合がある。",
      hint: "まず一つだけ、今回の判断基準を決める。",
      flow: `${STATE_LABELS[params.fromStateLevel]} → 判断軸の一本化 → ${STATE_LABELS[params.toStateLevel]}`,
      reason: params.transitionReason,
    };
  }

  if (params.supportShapeKey === "priority_sorting") {
    return {
      insight: "複数の考えが並ぶときは、優先順位を置くことで次が見えやすくなる場合がある。",
      hint: "いま一番先に見るものを一つだけ選ぶ。",
      flow: `${STATE_LABELS[params.fromStateLevel]} → 優先順位の整理 → ${STATE_LABELS[params.toStateLevel]}`,
      reason: params.transitionReason,
    };
  }

  return {
    insight: `${label}として、次の方向を受け取りやすい状態変化が見えた。`,
    hint: params.futureSupportHint,
    flow: `${STATE_LABELS[params.fromStateLevel]} → 支援の受け取り → ${STATE_LABELS[params.toStateLevel]}`,
    reason: params.transitionReason,
  };
}

function buildOwnerVisibleSummary(params: {
  transitionMeaning: HopyFutureChainTransitionMeaning;
  bridgeInsight: string;
}): string {
  if (params.transitionMeaning === "progress") {
    return `今回は「${params.bridgeInsight}」という前進の支援パターンとして保存されます。`;
  }

  if (params.transitionMeaning === "recovery_entry") {
    return `今回は「${params.bridgeInsight}」という立て直しの入口として保存されます。`;
  }

  if (params.transitionMeaning === "premise_reconsideration") {
    return `今回は「${params.bridgeInsight}」という前提を見直す支援パターンとして保存されます。`;
  }

  return `今回は「${params.bridgeInsight}」という再調整の支援パターンとして保存されます。`;
}

function buildFutureVisibleSummary(params: {
  transitionMeaning: HopyFutureChainTransitionMeaning;
  bridgeHint: string;
}): string {
  if (params.transitionMeaning === "progress") {
    return `似た場面では、${params.bridgeHint}`;
  }

  if (params.transitionMeaning === "recovery_entry") {
    return `似た場面では、無理に前へ進むより、${params.bridgeHint}`;
  }

  if (params.transitionMeaning === "premise_reconsideration") {
    return `似た場面では、答えを急ぐより、${params.bridgeHint}`;
  }

  return `似た場面では、前進を急ぐより、${params.bridgeHint}`;
}

function resolveCompassBasis(params: {
  payload: HopyFutureChainConfirmedPayload;
  transitionMeaning: HopyFutureChainTransitionMeaning;
}): string | null {
  const payloadRecord = asRecord(params.payload);
  const compass = readNestedRecord(payloadRecord, "compass");
  const compassText = maskSensitiveText(
    [compass?.prompt, compass?.text].filter(Boolean).join("\n"),
  );

  if (!compassText) return null;

  if (params.transitionMeaning === "recovery_entry") {
    return "Compassは、限界感を再調整や回復入口として扱う根拠を補助している。";
  }

  if (params.transitionMeaning === "premise_reconsideration") {
    return "Compassは、前提を見直す必要がある状態変化の根拠を補助している。";
  }

  if (params.transitionMeaning === "readjustment") {
    return "Compassは、前進より再調整を優先する状態変化の根拠を補助している。";
  }

  return "Compassは、ユーザーの状態変化を前進として扱う根拠を補助している。";
}

function buildMeaningEvidence(params: {
  sourceContext: HopyFutureChainSourceContext;
  payload: HopyFutureChainConfirmedPayload;
  fromStateLevel: HopyFutureChainStateLevel;
  toStateLevel: HopyFutureChainStateLevel;
  transitionKind: HopyFutureChainTransitionKind;
}): MeaningEvidence | null {
  const evidence = collectMeaningText({
    sourceContext: params.sourceContext,
    payload: params.payload,
  });

  const supportShapeKey = deriveSupportShapeKeyFromText(evidence.text);
  const transitionMeaning = deriveTransitionMeaning({
    transitionKind: params.transitionKind,
    evidenceText: evidence.text,
    supportShapeKey,
  });

  if (!transitionMeaning) {
    return null;
  }

  if (params.transitionKind === "downward") {
    const downwardParts = buildDownwardMeaningParts({
      sourceContext: params.sourceContext,
      payload: params.payload,
      fromStateLevel: params.fromStateLevel,
      toStateLevel: params.toStateLevel,
    });

    return {
      userSignal: downwardParts.userProgressSignal,
      hopySupport: downwardParts.effectiveSupport,
      transitionReason: downwardParts.transitionReason,
      futureSupportHint: downwardParts.futureSupportHint,
      bridgeSummary: downwardParts.bridgeSummary,
      compassBasis: downwardParts.compassBasis,
      transitionMeaning,
      supportShapeKey,
      evidenceSources: Array.from(
        new Set([
          ...evidence.sources,
          ...downwardParts.evidenceSources,
          "hopy_confirmed_payload.state",
        ]),
      ),
    };
  }

  const userSignal = buildUserSignalSummary({
    transitionKind: params.transitionKind,
    supportShapeKey,
  });

  const hopySupport = buildHopySupportSummary({
    transitionKind: params.transitionKind,
    supportShapeKey,
  });

  const transitionReason = buildTransitionReason({
    transitionKind: params.transitionKind,
    transitionMeaning,
    supportShapeKey,
  });

  const futureSupportHint = buildFutureSupportHint({
    transitionKind: params.transitionKind,
    transitionMeaning,
    supportShapeKey,
  });

  const bridgeSummary = buildBridgeSummary({
    fromStateLevel: params.fromStateLevel,
    toStateLevel: params.toStateLevel,
    transitionKind: params.transitionKind,
    transitionMeaning,
    supportShapeKey,
    transitionReason,
    futureSupportHint,
  });

  return {
    userSignal,
    hopySupport,
    transitionReason,
    futureSupportHint,
    bridgeSummary,
    compassBasis: resolveCompassBasis({
      payload: params.payload,
      transitionMeaning,
    }),
    transitionMeaning,
    supportShapeKey,
    evidenceSources: Array.from(
      new Set([...evidence.sources, "hopy_confirmed_payload.state"]),
    ),
  };
}

export function buildFutureChainCandidate(params: {
  sourceContext: HopyFutureChainSourceContext;
  precheck: HopyFutureChainPrecheckResult;
}): HopyFutureChainSaveCheckResult {
  const { sourceContext, precheck } = params;

  if (precheck.decision !== "continue") {
    return {
      decision: "skip",
      reason: precheck.reason,
      status: "none",
    };
  }

  const payload = sourceContext.hopyConfirmedPayload;
  const language = normalizeLanguage(sourceContext.language);
  const fromStateLevel = precheck.fromStateLevel;
  const toStateLevel = precheck.toStateLevel;
  const transitionKind = precheck.transitionKind;
  const sourceIds = readSourceContextIds(sourceContext);

  if (transitionKind === "same_level") {
    return {
      decision: "skip",
      reason: "Future Chain v2 の本線では same_level を保存対象にしない",
      status: "none",
    };
  }

  if (!sourceIds.sourceAssistantMessageId) {
    return {
      decision: "skip",
      reason: "source_assistant_message_id が存在しないため bridge_event を保存しない",
      status: "none",
    };
  }

  const meaning = buildMeaningEvidence({
    sourceContext,
    payload,
    fromStateLevel,
    toStateLevel,
    transitionKind,
  });

  if (!meaning) {
    return {
      decision: "skip",
      reason: "transition_meaning を安全に決められなかった",
      status: "none",
    };
  }

  const patternKey = buildPatternKey({
    fromStateLevel,
    toStateLevel,
    transitionMeaning: meaning.transitionMeaning,
    supportShapeKey: meaning.supportShapeKey,
  });

  const ownerVisibleSummary = buildOwnerVisibleSummary({
    transitionMeaning: meaning.transitionMeaning,
    bridgeInsight: meaning.bridgeSummary.insight,
  });

  const futureVisibleSummary = buildFutureVisibleSummary({
    transitionMeaning: meaning.transitionMeaning,
    bridgeHint: meaning.bridgeSummary.hint,
  });

  const bridgeEvent: HopyFutureChainBridgeEventCandidate = {
    language,

    from_state_level: fromStateLevel,
    to_state_level: toStateLevel,

    transition_kind: transitionKind,
    transition_meaning: meaning.transitionMeaning,

    user_signal_summary: clipText(meaning.userSignal, 360),
    hopy_support_summary: clipText(meaning.hopySupport, 360),
    transition_reason: clipText(meaning.transitionReason, 360),
    future_support_hint: clipText(meaning.futureSupportHint, 360),

    bridge_insight: clipText(meaning.bridgeSummary.insight, 220),
    bridge_hint: clipText(meaning.bridgeSummary.hint, 220),
    bridge_flow: clipText(meaning.bridgeSummary.flow, 220),
    bridge_reason: clipText(meaning.bridgeSummary.reason, 220),

    owner_visible_summary: clipText(ownerVisibleSummary, 260),
    future_visible_summary: clipText(futureVisibleSummary, 260),

    compass_basis: meaning.compassBasis,
    safety_notes: DEFAULT_SAFETY_NOTES,
    avoidance_notes: DEFAULT_AVOIDANCE_NOTES,

    source_transition_signal_id: sourceIds.sourceTransitionSignalId,
    source_assistant_message_id: sourceIds.sourceAssistantMessageId,
    source_trigger_message_id: sourceIds.sourceTriggerMessageId,

    confidence_score: 0.5,
    reuse_scope: "experimental",
    status: "active",

    metadata: {
      source: "hopy_confirmed_payload",
      version: "future_chain_pattern_v2",
    },
  };

  const candidate: HopyFutureChainCandidateV2 = {
    pattern_key: patternKey,
    language,
    from_state_level: fromStateLevel,
    to_state_level: toStateLevel,
    transition_kind: transitionKind,
    transition_meaning: meaning.transitionMeaning,
    support_shape_key: meaning.supportShapeKey,

    abstract_context: clipText(meaning.bridgeSummary.insight, 360),
    transition_reason: meaning.transitionReason,
    effective_support: clipText(meaning.hopySupport, 360),
    user_progress_signal: clipText(meaning.userSignal, 360),
    future_support_hint: meaning.futureSupportHint,
    bridge_summary: meaning.bridgeSummary,
    compass_basis: meaning.compassBasis,
    safety_notes: DEFAULT_SAFETY_NOTES,
    avoidance_notes: DEFAULT_AVOIDANCE_NOTES,

    evidence_count: 1,
    weight: 1,
    confidence_score: 0.5,
    reuse_scope: "experimental",
    status: "active",
    metadata: {
      source: "hopy_confirmed_payload",
      version: "future_chain_pattern_v2",
    },

    source_transition_signal_id: sourceIds.sourceTransitionSignalId,
    source_response_learning_id: sourceIds.sourceResponseLearningId,
    source_learning_insight_id: sourceIds.sourceLearningInsightId,

    bridge_event: bridgeEvent,
  };

  return {
    decision: "save",
    reason:
      "Future Chain v2 candidate を hopy_confirmed_payload の意味情報から生成した",
    status: "active",
    candidate,
  };
}

/*
【このファイルの正式役割】
HOPY Future Chain DB の保存候補 candidate 生成だけを担当する。
保存前チェックを通過した hopy_confirmed_payload 起点の情報を、DB保存用の匿名化・抽象化candidateへ変換する。
このファイルは保存前チェック、DB insert、state_changed再判定、state_level再判定、current_phase再判定、Compass再判定を担当しない。

【今回このファイルで修正したこと】
- downward の保存候補生成で futureChainDownwardCandidate.ts の buildDownwardMeaningParts(...) を使うようにした。
- downward の場合だけ、下降専用ファイルが生成する user_progress_signal / effective_support / transition_reason / future_support_hint / bridge_summary / compass_basis を保存候補へ反映するようにした。
- upward はこれまで通り、このファイル内の既存ロジックで生成するようにして、安定している前進側を触らないようにした。
- 保存前チェック、DB insert、DB制約、UI、HOPY回答○、Compass表示、MEMORIES、DASHBOARDには触れていない。

/app/api/chat/_lib/hopy/future-chain/futureChainCandidate.ts
*/