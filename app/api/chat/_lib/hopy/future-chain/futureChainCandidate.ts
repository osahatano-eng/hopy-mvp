// /app/api/chat/_lib/hopy/future-chain/futureChainCandidate.ts

import type { HopyFutureChainPrecheckResult } from "./futureChainCheck";
import {
  readFutureChainPayloadContext,
  type HopyFutureChainChangeTriggerKey,
  type HopyFutureChainPayloadContext,
  type HopyFutureChainSupportShapeKey,
  type HopyFutureChainTransitionMeaning,
} from "./futureChainPayloadContext";
import {
  HOPY_FUTURE_CHAIN_GENERATION_VERSION,
  type HopyFutureChainCandidate,
  type HopyFutureChainConfirmedPayload,
  type HopyFutureChainLanguage,
  type HopyFutureChainSaveCheckResult,
  type HopyFutureChainSourceContext,
  type HopyFutureChainStateLevel,
  type HopyFutureChainTransitionKind,
} from "./futureChainTypes";

type BridgeSummary = {
  insight: string;
  hint: string;
  flow: string;
  reason: string;
};

type HopyFutureChainBridgeEventCandidate = {
  owner_user_id: string;

  language: HopyFutureChainLanguage;

  from_state_level: HopyFutureChainStateLevel;
  to_state_level: HopyFutureChainStateLevel;

  transition_kind: HopyFutureChainTransitionKind;
  transition_meaning: HopyFutureChainTransitionMeaning;

  major_category: NonNullable<HopyFutureChainPayloadContext["majorCategory"]>;
  minor_category: NonNullable<HopyFutureChainPayloadContext["minorCategory"]>;
  change_trigger_key: HopyFutureChainChangeTriggerKey;
  support_shape_key: HopyFutureChainSupportShapeKey;

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

  handoff_message_snapshot: string;

  compass_basis: string | null;
  safety_notes: string | null;
  avoidance_notes: string | null;

  source_transition_signal_id: string | null;
  source_assistant_message_id: string;
  source_trigger_message_id: string | null;

  delivery_eligible: boolean;

  confidence_score: number;
  reuse_scope: "global" | "limited" | "experimental";
  status: "active" | "trash";

  metadata: {
    source: "hopy_confirmed_payload.future_chain_context";
    version: typeof HOPY_FUTURE_CHAIN_GENERATION_VERSION;
  };
};

type HopyFutureChainCandidateV31 = HopyFutureChainCandidate & {
  transition_meaning: HopyFutureChainTransitionMeaning;
  support_shape_key: HopyFutureChainSupportShapeKey;
  major_category: NonNullable<HopyFutureChainPayloadContext["majorCategory"]>;
  minor_category: NonNullable<HopyFutureChainPayloadContext["minorCategory"]>;
  change_trigger_key: HopyFutureChainChangeTriggerKey;
  handoff_message_snapshot: string;
  bridge_event: HopyFutureChainBridgeEventCandidate;
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
    .trim();
}

function sanitizeText(value: unknown, maxLength: number): string {
  return clipText(maskSensitiveText(value), maxLength);
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

function readFutureChainContextRecord(
  payload: HopyFutureChainConfirmedPayload,
): Record<string, unknown> | null {
  return asRecord(
    (payload as { future_chain_context?: unknown; futureChainContext?: unknown })
      .future_chain_context ??
      (payload as {
        future_chain_context?: unknown;
        futureChainContext?: unknown;
      }).futureChainContext,
  );
}

function readHandoffMessageSnapshot(
  payload: HopyFutureChainConfirmedPayload,
): string {
  const contextRecord = readFutureChainContextRecord(payload);

  return sanitizeText(
    readStringByKeys(contextRecord, [
      "handoff_message_snapshot",
      "handoffMessageSnapshot",
    ]),
    360,
  );
}

function readSourceContextIds(
  sourceContext: HopyFutureChainSourceContext,
  payload: HopyFutureChainConfirmedPayload,
): {
  sourceTransitionSignalId: string | null;
  sourceResponseLearningId: string | null;
  sourceLearningInsightId: string | null;
  sourceAssistantMessageId: string | null;
  sourceTriggerMessageId: string | null;
} {
  const sourceRecord = asRecord(sourceContext);
  const contextRecord = readFutureChainContextRecord(payload);

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
        ]) ||
          readStringByKeys(contextRecord, [
            "source_assistant_message_id",
            "sourceAssistantMessageId",
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

function buildPatternKey(params: {
  fromStateLevel: HopyFutureChainStateLevel;
  toStateLevel: HopyFutureChainStateLevel;
  transitionMeaning: HopyFutureChainTransitionMeaning;
  supportShapeKey: HopyFutureChainSupportShapeKey;
}): string {
  return [
    `state_${params.fromStateLevel}`,
    `to_${params.toStateLevel}`,
    params.transitionMeaning,
    "by",
    params.supportShapeKey,
  ].join("_");
}

function resolveTransitionMeaning(
  context: HopyFutureChainPayloadContext,
  transitionKind: HopyFutureChainTransitionKind,
): HopyFutureChainTransitionMeaning | null {
  if (context.transitionMeaning) {
    return context.transitionMeaning;
  }

  if (transitionKind === "upward") {
    return "progress";
  }

  if (transitionKind === "downward") {
    return "readjustment";
  }

  return null;
}

function resolveMajorCategory(
  context: HopyFutureChainPayloadContext,
): NonNullable<HopyFutureChainPayloadContext["majorCategory"]> | null {
  return context.majorCategory || null;
}

function resolveMinorCategory(
  context: HopyFutureChainPayloadContext,
): NonNullable<HopyFutureChainPayloadContext["minorCategory"]> | null {
  return context.minorCategory || null;
}

function resolveChangeTriggerKey(
  context: HopyFutureChainPayloadContext,
): HopyFutureChainChangeTriggerKey | null {
  return context.changeTriggerKey || null;
}

function resolveSupportShapeKey(
  context: HopyFutureChainPayloadContext,
): HopyFutureChainSupportShapeKey | null {
  return context.supportShapeKey || null;
}

function resolveBridgeSummaryFromSnapshot(
  handoffMessageSnapshot: string,
): BridgeSummary | null {
  const snapshot = sanitizeText(handoffMessageSnapshot, 360);

  if (!snapshot) {
    return null;
  }

  return {
    insight: snapshot,
    hint: snapshot,
    flow: snapshot,
    reason: snapshot,
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

  const payload: HopyFutureChainConfirmedPayload =
    sourceContext.hopyConfirmedPayload;
  const context = readFutureChainPayloadContext(payload);
  const language = normalizeLanguage(sourceContext.language);
  const fromStateLevel = precheck.fromStateLevel;
  const toStateLevel = precheck.toStateLevel;
  const transitionKind = precheck.transitionKind;
  const sourceIds = readSourceContextIds(sourceContext, payload);
  const handoffMessageSnapshot = readHandoffMessageSnapshot(payload);

  if (context.deliveryMode !== "owner_handoff") {
    return {
      decision: "skip",
      reason: "Future Chain v3.1 owner_handoff ではないため保存候補を生成しない",
      status: "none",
    };
  }

  if (transitionKind === "same_level") {
    return {
      decision: "skip",
      reason: "Future Chain v3.1 の本線では same_level を保存対象にしない",
      status: "none",
    };
  }

  if (context.transitionKind !== transitionKind) {
    return {
      decision: "skip",
      reason:
        "保存前チェックの transition_kind と future_chain_context.transition_kind が一致しない",
      status: "none",
    };
  }

  const transitionMeaning = resolveTransitionMeaning(context, transitionKind);

  if (!transitionMeaning) {
    return {
      decision: "skip",
      reason:
        "hopy_confirmed_payload.future_chain_context の transition_meaning が不足している",
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

  if (!handoffMessageSnapshot) {
    return {
      decision: "skip",
      reason:
        "hopy_confirmed_payload.future_chain_context.handoff_message_snapshot が存在しないため保存候補を生成しない",
      status: "none",
    };
  }

  const bridgeSummary = resolveBridgeSummaryFromSnapshot(handoffMessageSnapshot);

  if (!bridgeSummary) {
    return {
      decision: "skip",
      reason: "handoff_message_snapshot が保存候補として空のため bridge_event を保存しない",
      status: "none",
    };
  }

  const majorCategory = resolveMajorCategory(context);

  if (!majorCategory) {
    return {
      decision: "skip",
      reason:
        "hopy_confirmed_payload.future_chain_context.major_category が存在しないため保存候補を生成しない",
      status: "none",
    };
  }

  const minorCategory = resolveMinorCategory(context);

  if (!minorCategory) {
    return {
      decision: "skip",
      reason:
        "hopy_confirmed_payload.future_chain_context.minor_category が存在しないため保存候補を生成しない",
      status: "none",
    };
  }

  const changeTriggerKey = resolveChangeTriggerKey(context);

  if (!changeTriggerKey) {
    return {
      decision: "skip",
      reason:
        "hopy_confirmed_payload.future_chain_context.change_trigger_key が存在しないため保存候補を生成しない",
      status: "none",
    };
  }

  const supportShapeKey = resolveSupportShapeKey(context);

  if (!supportShapeKey) {
    return {
      decision: "skip",
      reason:
        "hopy_confirmed_payload.future_chain_context.support_shape_key が存在しないため保存候補を生成しない",
      status: "none",
    };
  }

  const patternKey = buildPatternKey({
    fromStateLevel,
    toStateLevel,
    transitionMeaning,
    supportShapeKey,
  });

  const bridgeEvent: HopyFutureChainBridgeEventCandidate = {
    owner_user_id: sourceContext.userId,

    language,

    from_state_level: fromStateLevel,
    to_state_level: toStateLevel,

    transition_kind: transitionKind,
    transition_meaning: transitionMeaning,

    major_category: majorCategory,
    minor_category: minorCategory,
    change_trigger_key: changeTriggerKey,
    support_shape_key: supportShapeKey,

    user_signal_summary: clipText(bridgeSummary.insight, 360),
    hopy_support_summary: clipText(bridgeSummary.hint, 360),
    transition_reason: clipText(bridgeSummary.reason, 360),
    future_support_hint: clipText(bridgeSummary.hint, 360),

    bridge_insight: bridgeSummary.insight,
    bridge_hint: bridgeSummary.hint,
    bridge_flow: bridgeSummary.flow,
    bridge_reason: bridgeSummary.reason,

    owner_visible_summary: clipText(handoffMessageSnapshot, 260),
    future_visible_summary: clipText(handoffMessageSnapshot, 260),

    handoff_message_snapshot: handoffMessageSnapshot,

    compass_basis: null,
    safety_notes: DEFAULT_SAFETY_NOTES,
    avoidance_notes: DEFAULT_AVOIDANCE_NOTES,

    source_transition_signal_id: sourceIds.sourceTransitionSignalId,
    source_assistant_message_id: sourceIds.sourceAssistantMessageId,
    source_trigger_message_id: sourceIds.sourceTriggerMessageId,

    delivery_eligible: true,

    confidence_score: 0.5,
    reuse_scope: "experimental",
    status: "active",

    metadata: {
      source: "hopy_confirmed_payload.future_chain_context",
      version: HOPY_FUTURE_CHAIN_GENERATION_VERSION,
    },
  };

  const candidate: HopyFutureChainCandidateV31 = {
    pattern_key: patternKey,
    language,
    from_state_level: fromStateLevel,
    to_state_level: toStateLevel,
    transition_kind: transitionKind,
    transition_meaning: transitionMeaning,
    support_shape_key: supportShapeKey,
    major_category: majorCategory,
    minor_category: minorCategory,
    change_trigger_key: changeTriggerKey,
    delivery_target_state_level: toStateLevel,
    delivery_usage: "owner_handoff",

    abstract_context: clipText(handoffMessageSnapshot, 360),
    transition_reason: clipText(handoffMessageSnapshot, 360),
    effective_support: clipText(handoffMessageSnapshot, 360),
    user_progress_signal: clipText(handoffMessageSnapshot, 360),
    future_support_hint: clipText(handoffMessageSnapshot, 360),
    handoff_message_snapshot: handoffMessageSnapshot,
    bridge_summary: bridgeSummary,
    compass_basis: null,
    safety_notes: DEFAULT_SAFETY_NOTES,
    avoidance_notes: DEFAULT_AVOIDANCE_NOTES,

    evidence_count: 1,
    weight: 1,
    confidence_score: 0.5,
    reuse_scope: "experimental",
    status: "active",
    metadata: {
      source: "hopy_confirmed_payload",
      version: HOPY_FUTURE_CHAIN_GENERATION_VERSION,
    },

    source_transition_signal_id: sourceIds.sourceTransitionSignalId,
    source_response_learning_id: sourceIds.sourceResponseLearningId,
    source_learning_insight_id: sourceIds.sourceLearningInsightId,

    bridge_event: bridgeEvent,
  };

  return {
    decision: "save",
    reason:
      "Future Chain v3.1 candidate を handoff_message_snapshot から生成した",
    status: "active",
    candidate,
  };
}

/*
【このファイルの正式役割】
HOPY Future Chain DB の保存候補 candidate 生成だけを担当する。
保存前チェックを通過した hopy_confirmed_payload.future_chain_context 起点の情報を、
DB保存用のcandidateへ変換する。
v3.1では、owner_handoff 4項目ではなく、
handoff_message_snapshot を主役として保存候補を作る。

このファイルは保存前チェック、DB insert、state_changed再判定、
state_level再判定、current_phase再判定、Compass再判定、
HOPY回答再要約、Compass再要約、ユーザー発話読み取りを担当しない。

【今回このファイルで修正したこと】
- major_category / minor_category の旧カテゴリfallbackを削除した。
- change_trigger_key / support_shape_key のfallbackも削除した。
- hopy_confirmed_payload.future_chain_context の major_category / minor_category / change_trigger_key / support_shape_key が不足している場合は、旧値で補完せず保存候補生成をskipするようにした。
- Future Chain保存層がカテゴリを作り直さず、hopy_confirmed_payload.future_chain_context の確定値だけをDB保存候補へ渡す形に戻した。
- HOPY回答やCompassをFuture Chain側で再要約していない。
- 保存前チェック、DB insert、DB制約、UI、HOPY回答○、Compass表示、MEMORIES、DASHBOARDには触れていない。

/app/api/chat/_lib/hopy/future-chain/futureChainCandidate.ts
*/