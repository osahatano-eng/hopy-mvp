// /app/api/chat/_lib/hopy/future-chain/futureChainContextFromFinalizedTurn.ts

import {
  resolveFutureChainCategory,
  type FutureChainCategoryChangeTriggerKey,
  type FutureChainCategoryConfidence,
  type FutureChainCategoryMajor,
  type FutureChainCategoryMinor,
} from "./futureChainCategory";
import {
  buildFutureChainHandoffSnapshot,
  type FutureChainHandoffSnapshotReason,
} from "./futureChainHandoffSnapshot";

export type FutureChainContextStateLevel = 1 | 2 | 3 | 4 | 5;

export type FutureChainContextDeliveryMode =
  | "owner_handoff"
  | "recipient_support"
  | "none";

export type FutureChainContextTransitionKind =
  | "upward"
  | "downward"
  | "same_level";

export type FutureChainContextTransitionMeaning =
  | "progress"
  | "readjustment"
  | "reinforcement";

export type FutureChainContextFromFinalizedTurnState = {
  state_level?: number | null;
  current_phase?: number | null;
  prev_state_level?: number | null;
  prev_phase?: number | null;
  state_changed?: boolean | null;
};

type FutureChainContextCategoryFields = {
  major_category: FutureChainCategoryMajor | null;
  minor_category: FutureChainCategoryMinor | null;
  change_trigger_key: FutureChainCategoryChangeTriggerKey | null;
};

type ResolvedFutureChainContextCategoryFields =
  FutureChainContextCategoryFields & {
    confidence: FutureChainCategoryConfidence;
    reason: string;
  };

export type FutureChainContextFromFinalizedTurn = {
  delivery_mode: FutureChainContextDeliveryMode;
  major_category: FutureChainCategoryMajor | null;
  minor_category: FutureChainCategoryMinor | null;
  current_stuck_state: null;
  true_feeling_hypothesis: null;
  change_trigger_key: FutureChainCategoryChangeTriggerKey | null;
  support_needed: boolean;
  transition_kind: FutureChainContextTransitionKind | null;
  transition_meaning: FutureChainContextTransitionMeaning | null;
  support_shape_key: "handoff_message_snapshot" | null;
  handoff_message_snapshot: string | null;
  handoff_snapshot_reason: FutureChainHandoffSnapshotReason | null;
  source_assistant_message_id: string | null;
  owner_handoff: null;
  recipient_support_query: null;
};

export type BuildFutureChainContextFromFinalizedTurnParams = {
  userMessage?: string | null;
  recentUserText?: string | null;
  reply?: string | null;
  state?: FutureChainContextFromFinalizedTurnState | null;
  compassText?: string | null;
  compassPrompt?: string | null;
  assistantMessageId?: string | null;
  maxSnapshotChars?: number;
};

export type BuildFutureChainContextFromFinalizedTurnResult = {
  context: FutureChainContextFromFinalizedTurn;
};

const ALLOWED_RECIPIENT_SUPPORT_CATEGORY_PAIR_KEYS = new Set<string>([
  "romance:anxiety",
  "romance:unclear_feelings",
  "romance:boundary",
  "romance:decision",
  "romance:self_doubt",
  "romance:future_uncertainty",
  "romance:trust_issue",

  "relationships:anxiety",
  "relationships:communication",
  "relationships:boundary",
  "relationships:repair",
  "relationships:loneliness",
  "relationships:trust_issue",

  "family:communication",
  "family:boundary",
  "family:guilt",
  "family:repair",
  "family:overwhelm",
  "family:role_pressure",
  "family:trust_issue",

  "parenting:guilt",
  "parenting:repair",
  "parenting:communication",
  "parenting:overwhelm",
  "parenting:role_pressure",
  "parenting:self_doubt",

  "caregiving:overwhelm",
  "caregiving:role_pressure",
  "caregiving:guilt",
  "caregiving:recovery_pause",
  "caregiving:readjustment",
  "caregiving:self_doubt",

  "work:anxiety",
  "work:communication",
  "work:boundary",
  "work:overwhelm",
  "work:priority_confusion",
  "work:task_overload",
  "work:role_pressure",
  "work:trust_issue",

  "career:future_uncertainty",
  "career:self_doubt",
  "career:decision",
  "career:value_clarification",

  "school:anxiety",
  "school:communication",
  "school:self_doubt",
  "school:loneliness",

  "learning:first_step",
  "learning:continuity",
  "learning:self_doubt",
  "learning:priority_confusion",

  "creation:first_step",
  "creation:continuity",
  "creation:self_doubt",
  "creation:meaning_loss",

  "business:decision",
  "business:priority_confusion",
  "business:task_overload",
  "business:self_doubt",

  "community:communication",
  "community:boundary",
  "community:loneliness",
  "community:trust_issue",

  "sns:anxiety",
  "sns:comparison",
  "sns:boundary",
  "sns:communication",

  "life:future_uncertainty",
  "life:value_clarification",
  "life:meaning_loss",
  "life:self_doubt",
  "life:loneliness",
  "life:unclear_feelings",
]);

function normalizeText(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function hasText(value: unknown): boolean {
  return normalizeText(value).length > 0;
}

function normalizeStateLevel(
  value: unknown,
): FutureChainContextStateLevel | null {
  if (typeof value !== "number" || !Number.isInteger(value)) {
    return null;
  }

  if (value < 1 || value > 5) {
    return null;
  }

  return value as FutureChainContextStateLevel;
}

function resolveFromStateLevel(
  state: FutureChainContextFromFinalizedTurnState | null | undefined,
): FutureChainContextStateLevel | null {
  return normalizeStateLevel(state?.prev_state_level ?? state?.prev_phase);
}

function resolveToStateLevel(
  state: FutureChainContextFromFinalizedTurnState | null | undefined,
): FutureChainContextStateLevel | null {
  return normalizeStateLevel(state?.state_level ?? state?.current_phase);
}

function resolveTransitionKind(params: {
  fromStateLevel: FutureChainContextStateLevel;
  toStateLevel: FutureChainContextStateLevel;
}): FutureChainContextTransitionKind {
  if (params.toStateLevel > params.fromStateLevel) {
    return "upward";
  }

  if (params.toStateLevel < params.fromStateLevel) {
    return "downward";
  }

  return "same_level";
}

function resolveTransitionMeaning(
  transitionKind: FutureChainContextTransitionKind,
): FutureChainContextTransitionMeaning {
  if (transitionKind === "upward") {
    return "progress";
  }

  if (transitionKind === "downward") {
    return "readjustment";
  }

  return "reinforcement";
}

function buildEmptyCategoryFields(): FutureChainContextCategoryFields {
  return {
    major_category: null,
    minor_category: null,
    change_trigger_key: null,
  };
}

function buildEmptyResolvedCategoryFields(): ResolvedFutureChainContextCategoryFields {
  return {
    ...buildEmptyCategoryFields(),
    confidence: "low",
    reason: "category:none",
  };
}

function pickContextCategoryFields(
  fields: ResolvedFutureChainContextCategoryFields,
): FutureChainContextCategoryFields {
  return {
    major_category: fields.major_category,
    minor_category: fields.minor_category,
    change_trigger_key: fields.change_trigger_key,
  };
}

function resolveCategoryFields(params: {
  userMessage?: string | null;
  recentUserText?: string | null;
  reply?: string | null;
  handoffMessageSnapshot?: string | null;
}): ResolvedFutureChainContextCategoryFields {
  if (
    !hasText(params.userMessage) &&
    !hasText(params.recentUserText) &&
    !hasText(params.reply) &&
    !hasText(params.handoffMessageSnapshot)
  ) {
    return buildEmptyResolvedCategoryFields();
  }

  const category = resolveFutureChainCategory({
    userMessage: params.userMessage,
    recentUserText: params.recentUserText,
    reply: params.reply,
    handoffMessageSnapshot: params.handoffMessageSnapshot,
  });

  return {
    major_category: category.major_category,
    minor_category: category.minor_category,
    change_trigger_key: category.change_trigger_key,
    confidence: category.confidence,
    reason: category.reason,
  };
}

function buildRecipientSupportCategoryPairKey(
  fields: ResolvedFutureChainContextCategoryFields,
): string | null {
  if (!fields.major_category || !fields.minor_category) {
    return null;
  }

  return `${fields.major_category}:${fields.minor_category}`;
}

function shouldBuildRecipientSupportContext(
  fields: ResolvedFutureChainContextCategoryFields,
): boolean {
  if (fields.confidence === "low") {
    return false;
  }

  const pairKey = buildRecipientSupportCategoryPairKey(fields);

  if (!pairKey) {
    return false;
  }

  return ALLOWED_RECIPIENT_SUPPORT_CATEGORY_PAIR_KEYS.has(pairKey);
}

function buildNoneFutureChainContext(): FutureChainContextFromFinalizedTurn {
  return {
    delivery_mode: "none",
    ...buildEmptyCategoryFields(),
    current_stuck_state: null,
    true_feeling_hypothesis: null,
    support_needed: false,
    transition_kind: null,
    transition_meaning: null,
    support_shape_key: null,
    handoff_message_snapshot: null,
    handoff_snapshot_reason: null,
    source_assistant_message_id: null,
    owner_handoff: null,
    recipient_support_query: null,
  };
}

function buildRecipientSupportFutureChainContext(params: {
  userMessage?: string | null;
  recentUserText?: string | null;
  reply?: string | null;
  state: FutureChainContextFromFinalizedTurnState | null | undefined;
}): FutureChainContextFromFinalizedTurn {
  const toStateLevel = resolveToStateLevel(params.state);

  if (!toStateLevel) {
    return buildNoneFutureChainContext();
  }

  const categoryFields = resolveCategoryFields({
    userMessage: params.userMessage,
    recentUserText: params.recentUserText,
    reply: params.reply,
    handoffMessageSnapshot: null,
  });

  if (!shouldBuildRecipientSupportContext(categoryFields)) {
    return buildNoneFutureChainContext();
  }

  return {
    delivery_mode: "recipient_support",
    ...pickContextCategoryFields(categoryFields),
    current_stuck_state: null,
    true_feeling_hypothesis: null,
    support_needed: true,
    transition_kind: null,
    transition_meaning: null,
    support_shape_key: null,
    handoff_message_snapshot: null,
    handoff_snapshot_reason: null,
    source_assistant_message_id: null,
    owner_handoff: null,
    recipient_support_query: null,
  };
}

export function buildFutureChainContextFromFinalizedTurn({
  userMessage,
  recentUserText,
  reply,
  state,
  compassText,
  compassPrompt,
  assistantMessageId,
  maxSnapshotChars,
}: BuildFutureChainContextFromFinalizedTurnParams): BuildFutureChainContextFromFinalizedTurnResult {
  const noneContext = buildNoneFutureChainContext();

  if (state?.state_changed === false) {
    if (hasText(compassText) || hasText(compassPrompt)) {
      return {
        context: noneContext,
      };
    }

    return {
      context: buildRecipientSupportFutureChainContext({
        userMessage,
        recentUserText,
        reply,
        state,
      }),
    };
  }

  if (state?.state_changed !== true) {
    return {
      context: noneContext,
    };
  }

  if (!hasText(compassText) || !hasText(compassPrompt)) {
    return {
      context: noneContext,
    };
  }

  const sourceAssistantMessageId = normalizeText(assistantMessageId);

  if (!sourceAssistantMessageId) {
    return {
      context: noneContext,
    };
  }

  const fromStateLevel = resolveFromStateLevel(state);
  const toStateLevel = resolveToStateLevel(state);

  if (!fromStateLevel || !toStateLevel) {
    return {
      context: noneContext,
    };
  }

  const handoffSnapshot = buildFutureChainHandoffSnapshot({
    reply,
    maxChars: maxSnapshotChars,
  });

  if (!handoffSnapshot.snapshot) {
    return {
      context: {
        ...noneContext,
        handoff_snapshot_reason: handoffSnapshot.reason,
        source_assistant_message_id: sourceAssistantMessageId,
      },
    };
  }

  const transitionKind = resolveTransitionKind({
    fromStateLevel,
    toStateLevel,
  });

  const categoryFields = resolveCategoryFields({
    userMessage,
    recentUserText,
    reply,
    handoffMessageSnapshot: handoffSnapshot.snapshot,
  });

  return {
    context: {
      delivery_mode: "owner_handoff",
      ...pickContextCategoryFields(categoryFields),
      current_stuck_state: null,
      true_feeling_hypothesis: null,
      support_needed: false,
      transition_kind: transitionKind,
      transition_meaning: resolveTransitionMeaning(transitionKind),
      support_shape_key: "handoff_message_snapshot",
      handoff_message_snapshot: handoffSnapshot.snapshot,
      handoff_snapshot_reason: handoffSnapshot.reason,
      source_assistant_message_id: sourceAssistantMessageId,
      owner_handoff: null,
      recipient_support_query: null,
    },
  };
}

/*
【このファイルの正式役割】
HOPY Future Chain v3.1 の future_chain_context 生成だけを担当する。
回答確定後の userMessage / recentUserText / reply / state / Compass / assistantMessageId を受け取り、
state_changed=true、Compassあり、assistantMessageIdあり、handoff_message_snapshotありの場合は、
delivery_mode="owner_handoff" の短い context を返す。
state_changed=false、Compassなし、状態値1..5、かつ major_category + minor_category の許可ペアに一致する場合だけ、
delivery_mode="recipient_support" の短い context を返す。
userMessage / recentUserText / handoff_message_snapshot / reply から軽量カテゴリ分類を呼び、
major_category / minor_category / change_trigger_key を context に載せる。

このファイルは OpenAI JSON 生成、HOPY回答再要約、Compass再要約、
ユーザー発話生文の保存、DB保存、Future Chain保存判定、state_changed再判定、
state_level再判定、current_phase再判定、Compass表示可否判定、
HOPY回答○判定、recipient_support検索、delivery_event保存、UI表示を担当しない。

【今回このファイルで修正したこと】
- recipient_support の生成条件を、major_category の除外リスト + minor_category の許可リストから、major_category + minor_category の明示ペア判定へ変更した。
- おはようございます / ありがとう / buildOK などの軽い通常会話や、実用・検索・健康安全系だけの分類では recipient_support が立ちにくい構造へ戻した。
- romance + anxiety、caregiving + overwhelm、parenting + guilt、work + communication、life + value_clarification など、Future Chainが補助として届きやすい組み合わせだけを許可した。
- health / pain / sleep / menopause / legal / money など、risk_level 未反映の段階で慎重に扱うべき領域は、このファイルでは recipient_support 自動生成ペアに含めない方針にした。
- owner_handoff 側は維持し、state_changed=true / Compassあり / assistantMessageIdあり / handoff_message_snapshotあり の既存条件を壊していない。
- state_changed、state_level、current_phase、prev系、Compass表示可否、HOPY回答○表示可否は再判定していない。

/app/api/chat/_lib/hopy/future-chain/futureChainContextFromFinalizedTurn.ts
*/