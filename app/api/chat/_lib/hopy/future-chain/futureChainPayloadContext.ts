// /app/api/chat/_lib/hopy/future-chain/futureChainPayloadContext.ts

import type {
  HopyFutureChainChangeTriggerKey,
  HopyFutureChainConfirmedPayload,
  HopyFutureChainDisplayMode,
  HopyFutureChainMajorCategory,
  HopyFutureChainMinorCategory,
  HopyFutureChainOwnerHandoff,
  HopyFutureChainRecipientSupportQuery,
  HopyFutureChainStateLevel,
  HopyFutureChainSupportShapeKey,
  HopyFutureChainTransitionKind,
  HopyFutureChainTransitionMeaning,
} from "./futureChainTypes";

export type {
  HopyFutureChainChangeTriggerKey,
  HopyFutureChainDisplayMode,
  HopyFutureChainMajorCategory,
  HopyFutureChainMinorCategory,
  HopyFutureChainOwnerHandoff,
  HopyFutureChainRecipientSupportQuery,
  HopyFutureChainStateLevel,
  HopyFutureChainSupportShapeKey,
  HopyFutureChainTransitionKind,
  HopyFutureChainTransitionMeaning,
} from "./futureChainTypes";

export type HopyFutureChainPayloadContext = {
  deliveryMode: HopyFutureChainDisplayMode;

  majorCategory: HopyFutureChainMajorCategory | null;
  minorCategory: HopyFutureChainMinorCategory | null;

  currentStuckState: string | null;
  trueFeelingHypothesis: string | null;
  changeTriggerKey: HopyFutureChainChangeTriggerKey | null;

  supportNeeded: boolean;

  transitionKind: HopyFutureChainTransitionKind | null;
  transitionMeaning: HopyFutureChainTransitionMeaning | null;

  supportShapeKey: HopyFutureChainSupportShapeKey | null;

  handoffMessageSnapshot: string | null;
  handoffSnapshotReason: string | null;
  sourceAssistantMessageId: string | null;

  ownerHandoff: HopyFutureChainOwnerHandoff | null;

  recipientSupportQuery: HopyFutureChainRecipientSupportQuery | null;
};

export type HopyFutureChainContext = {
  delivery_mode: HopyFutureChainDisplayMode;

  major_category: HopyFutureChainMajorCategory | null;
  minor_category: HopyFutureChainMinorCategory | null;

  current_stuck_state: string | null;
  true_feeling_hypothesis: string | null;
  change_trigger_key: HopyFutureChainChangeTriggerKey | null;

  support_needed: boolean;

  transition_kind: HopyFutureChainTransitionKind | null;
  transition_meaning: HopyFutureChainTransitionMeaning | null;

  support_shape_key: HopyFutureChainSupportShapeKey | null;

  handoff_message_snapshot: string | null;
  handoff_snapshot_reason: string | null;
  source_assistant_message_id: string | null;

  owner_handoff: HopyFutureChainOwnerHandoff | null;

  recipient_support_query: HopyFutureChainRecipientSupportQuery | null;
};

type ResolveFutureChainContextForConfirmedPayloadParams = {
  rawContext: unknown;
  stateChanged: boolean;
};

const MAJOR_CATEGORY_KEYS = new Set<HopyFutureChainMajorCategory>([
  "work",
  "relationship",
  "money",
  "family",
  "learning",
  "development",
  "creation",
  "life",
  "future",
  "self",
]);

const MINOR_CATEGORY_KEYS = new Set<HopyFutureChainMinorCategory>([
  "anxiety",
  "confusion",
  "decision",
  "action",
  "continuity",
  "relationship",
  "confidence",
  "priority",
  "letting_go",
  "retry",
  "visualization",
]);

const CHANGE_TRIGGER_KEYS = new Set<HopyFutureChainChangeTriggerKey>([
  "verbalized",
  "narrowed_to_one",
  "noticed_true_feeling",
  "stated_action",
  "accepted_discomfort",
  "found_priority",
  "found_purpose",
  "noticed_fear_source",
  "allowed_to_release",
  "rested_before_action",
  "reset_premise",
]);

const DISPLAY_MODES = new Set<HopyFutureChainDisplayMode>([
  "owner_handoff",
  "recipient_support",
  "none",
]);

const TRANSITION_KINDS = new Set<HopyFutureChainTransitionKind>([
  "upward",
  "same_level",
  "downward",
]);

const TRANSITION_MEANINGS = new Set<HopyFutureChainTransitionMeaning>([
  "progress",
  "readjustment",
  "recovery_entry",
  "premise_reconsideration",
  "stabilization",
  "reinforcement",
]);

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

function readString(
  record: Record<string, unknown> | null,
  key: string,
): string {
  if (!record) return "";
  return normalizeText(record[key]);
}

function readNullableString(
  record: Record<string, unknown> | null,
  key: string,
): string | null {
  const text = readString(record, key);
  return text || null;
}

function readNullableStringByKeys(
  record: Record<string, unknown> | null,
  keys: string[],
): string | null {
  if (!record) return null;

  for (const key of keys) {
    const text = readNullableString(record, key);
    if (text) return text;
  }

  return null;
}

function readBoolean(
  record: Record<string, unknown> | null,
  key: string,
): boolean {
  if (!record) return false;
  return record[key] === true;
}

function normalizeStateLevel(value: unknown): HopyFutureChainStateLevel | null {
  if (typeof value === "number" && Number.isInteger(value)) {
    if (value >= 1 && value <= 5) {
      return value as HopyFutureChainStateLevel;
    }

    return null;
  }

  const normalized = normalizeText(value);
  if (!normalized) return null;

  const numeric = Number(normalized);
  if (!Number.isInteger(numeric)) return null;
  if (numeric < 1 || numeric > 5) return null;

  return numeric as HopyFutureChainStateLevel;
}

function normalizeMajorCategory(
  value: unknown,
): HopyFutureChainMajorCategory | null {
  const key = normalizeText(value);
  if (!MAJOR_CATEGORY_KEYS.has(key as HopyFutureChainMajorCategory)) {
    return null;
  }

  return key as HopyFutureChainMajorCategory;
}

function normalizeMinorCategory(
  value: unknown,
): HopyFutureChainMinorCategory | null {
  const key = normalizeText(value);
  if (!MINOR_CATEGORY_KEYS.has(key as HopyFutureChainMinorCategory)) {
    return null;
  }

  return key as HopyFutureChainMinorCategory;
}

function normalizeChangeTriggerKey(
  value: unknown,
): HopyFutureChainChangeTriggerKey | null {
  const key = normalizeText(value);
  if (!CHANGE_TRIGGER_KEYS.has(key as HopyFutureChainChangeTriggerKey)) {
    return null;
  }

  return key as HopyFutureChainChangeTriggerKey;
}

function normalizeDisplayMode(value: unknown): HopyFutureChainDisplayMode {
  const key = normalizeText(value);
  if (!DISPLAY_MODES.has(key as HopyFutureChainDisplayMode)) {
    return "none";
  }

  return key as HopyFutureChainDisplayMode;
}

function normalizeTransitionKind(
  value: unknown,
): HopyFutureChainTransitionKind | null {
  const key = normalizeText(value);
  if (!TRANSITION_KINDS.has(key as HopyFutureChainTransitionKind)) {
    return null;
  }

  return key as HopyFutureChainTransitionKind;
}

function normalizeTransitionMeaning(
  value: unknown,
): HopyFutureChainTransitionMeaning | null {
  const key = normalizeText(value);
  if (!TRANSITION_MEANINGS.has(key as HopyFutureChainTransitionMeaning)) {
    return null;
  }

  return key as HopyFutureChainTransitionMeaning;
}

function normalizeSupportShapeKey(
  value: unknown,
): HopyFutureChainSupportShapeKey | null {
  const key = normalizeText(value);
  return key || null;
}

function readOwnerHandoff(
  record: Record<string, unknown> | null,
): HopyFutureChainOwnerHandoff | null {
  const ownerHandoff = asRecord(record?.owner_handoff);
  if (!ownerHandoff) return null;

  return {
    insight: readNullableString(ownerHandoff, "insight"),
    hint: readNullableString(ownerHandoff, "hint"),
    flow: readNullableString(ownerHandoff, "flow"),
    reason: readNullableString(ownerHandoff, "reason"),
  };
}

function readRecipientSupportQuery(
  record: Record<string, unknown> | null,
): HopyFutureChainRecipientSupportQuery | null {
  const query = asRecord(record?.recipient_support_query);
  if (!query) return null;

  return {
    target_state_level: normalizeStateLevel(query.target_state_level),
    major_category: normalizeMajorCategory(query.major_category),
    minor_category: normalizeMinorCategory(query.minor_category),
    change_trigger_key: normalizeChangeTriggerKey(query.change_trigger_key),
    support_shape_key: normalizeSupportShapeKey(query.support_shape_key),
  };
}

function readFutureChainContextRecord(
  payload: HopyFutureChainConfirmedPayload,
): Record<string, unknown> | null {
  const payloadRecord = asRecord(payload);
  return asRecord(payloadRecord?.future_chain_context);
}

function readFutureChainPayloadContextFromRecord(
  context: Record<string, unknown> | null,
): HopyFutureChainPayloadContext {
  return {
    deliveryMode: normalizeDisplayMode(context?.delivery_mode),

    majorCategory: normalizeMajorCategory(context?.major_category),
    minorCategory: normalizeMinorCategory(context?.minor_category),

    currentStuckState: readNullableString(context, "current_stuck_state"),
    trueFeelingHypothesis: readNullableString(
      context,
      "true_feeling_hypothesis",
    ),
    changeTriggerKey: normalizeChangeTriggerKey(context?.change_trigger_key),

    supportNeeded: readBoolean(context, "support_needed"),

    transitionKind: normalizeTransitionKind(context?.transition_kind),
    transitionMeaning: normalizeTransitionMeaning(context?.transition_meaning),

    supportShapeKey: normalizeSupportShapeKey(context?.support_shape_key),

    handoffMessageSnapshot: readNullableStringByKeys(context, [
      "handoff_message_snapshot",
      "handoffMessageSnapshot",
    ]),
    handoffSnapshotReason: readNullableStringByKeys(context, [
      "handoff_snapshot_reason",
      "handoffSnapshotReason",
    ]),
    sourceAssistantMessageId: readNullableStringByKeys(context, [
      "source_assistant_message_id",
      "sourceAssistantMessageId",
    ]),

    ownerHandoff: readOwnerHandoff(context),

    recipientSupportQuery: readRecipientSupportQuery(context),
  };
}

function toConfirmedPayloadFutureChainContext(
  context: HopyFutureChainPayloadContext,
): HopyFutureChainContext {
  return {
    delivery_mode: context.deliveryMode,

    major_category: context.majorCategory,
    minor_category: context.minorCategory,

    current_stuck_state: context.currentStuckState,
    true_feeling_hypothesis: context.trueFeelingHypothesis,
    change_trigger_key: context.changeTriggerKey,

    support_needed: context.supportNeeded,

    transition_kind: context.transitionKind,
    transition_meaning: context.transitionMeaning,

    support_shape_key: context.supportShapeKey,

    handoff_message_snapshot:
      context.deliveryMode === "owner_handoff"
        ? context.handoffMessageSnapshot
        : null,
    handoff_snapshot_reason:
      context.deliveryMode === "owner_handoff"
        ? context.handoffSnapshotReason
        : null,
    source_assistant_message_id:
      context.deliveryMode === "owner_handoff"
        ? context.sourceAssistantMessageId
        : null,

    owner_handoff:
      context.deliveryMode === "owner_handoff" ? context.ownerHandoff : null,

    recipient_support_query:
      context.deliveryMode === "recipient_support"
        ? context.recipientSupportQuery
        : null,
  };
}

export function readFutureChainPayloadContext(
  payload: HopyFutureChainConfirmedPayload,
): HopyFutureChainPayloadContext {
  return readFutureChainPayloadContextFromRecord(
    readFutureChainContextRecord(payload),
  );
}

export function resolveFutureChainContextForConfirmedPayload(
  params: ResolveFutureChainContextForConfirmedPayloadParams,
): HopyFutureChainContext | null {
  const rawContext = asRecord(params.rawContext);
  if (!rawContext) return null;

  const context = readFutureChainPayloadContextFromRecord(rawContext);

  if (context.deliveryMode === "none") return null;

  if (context.deliveryMode === "owner_handoff" && !params.stateChanged) {
    return null;
  }

  if (context.deliveryMode === "recipient_support" && params.stateChanged) {
    return null;
  }

  return toConfirmedPayloadFutureChainContext(context);
}

export function hasFutureChainOwnerHandoffContext(
  context: HopyFutureChainPayloadContext,
): boolean {
  return (
    context.deliveryMode === "owner_handoff" &&
    context.transitionKind !== null &&
    context.transitionKind !== "same_level" &&
    context.transitionMeaning !== null &&
    context.supportShapeKey !== null &&
    context.handoffMessageSnapshot !== null
  );
}

export function hasFutureChainRecipientSupportContext(
  context: HopyFutureChainPayloadContext,
): boolean {
  const query = context.recipientSupportQuery;

  return (
    context.deliveryMode === "recipient_support" &&
    context.supportNeeded &&
    query !== null &&
    query.target_state_level !== null &&
    query.major_category !== null &&
    query.minor_category !== null
  );
}

/*
【このファイルの正式役割】
HOPY Future Chain v3.1 用に、hopy_confirmed_payload.future_chain_context を安全に読み取ることだけを担当する。
また、HOPY回答確定時に受け取った rawContext を、confirmed payload に載せられる future_chain_context 形式へ正規化する。
v3.1では、owner_handoff 4項目ではなく handoff_message_snapshot を主役として通す。

このファイルは、Future Chain の意味生成、DB保存候補生成、DB insert、
state_changed再判定、state_level再判定、current_phase再判定、
Compass再判定、UI表示判定、HOPY回答再要約、Compass再要約、
ユーザー発話読み取りを担当しない。

【今回このファイルで修正したこと】
- HopyFutureChainPayloadContext に handoffMessageSnapshot / handoffSnapshotReason / sourceAssistantMessageId を追加しました。
- HopyFutureChainContext に handoff_message_snapshot / handoff_snapshot_reason / source_assistant_message_id を追加しました。
- rawContext から handoff_message_snapshot / handoffMessageSnapshot を読み取る処理を追加しました。
- confirmed payload へ載せる snake_case 形式に handoff_message_snapshot を含めるようにしました。
- hasFutureChainOwnerHandoffContext(...) を owner_handoff 4項目必須から handoff_message_snapshot 必須へ変更しました。
- Future Chain の意味生成・保存判定・DB保存・UI判定・HOPY回答再要約は持たせていません。

/app/api/chat/_lib/hopy/future-chain/futureChainPayloadContext.ts
*/