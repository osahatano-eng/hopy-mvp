// /app/api/chat/_lib/hopy/future-chain/futureChainContextFromFinalizedTurn.ts

import {
  resolveFutureChainCategory,
  type FutureChainCategoryChangeTriggerKey,
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

function resolveCategoryFields(params: {
  reply?: string | null;
  handoffMessageSnapshot?: string | null;
}): FutureChainContextCategoryFields {
  if (!hasText(params.reply) && !hasText(params.handoffMessageSnapshot)) {
    return buildEmptyCategoryFields();
  }

  const category = resolveFutureChainCategory({
    reply: params.reply,
    handoffMessageSnapshot: params.handoffMessageSnapshot,
  });

  return {
    major_category: category.major_category,
    minor_category: category.minor_category,
    change_trigger_key: category.change_trigger_key,
  };
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

function buildRecipientSupportFutureChainContext(
  params: {
    reply?: string | null;
    state: FutureChainContextFromFinalizedTurnState | null | undefined;
  },
): FutureChainContextFromFinalizedTurn {
  const toStateLevel = resolveToStateLevel(params.state);

  if (!toStateLevel) {
    return buildNoneFutureChainContext();
  }

  const categoryFields = resolveCategoryFields({
    reply: params.reply,
    handoffMessageSnapshot: null,
  });

  return {
    delivery_mode: "recipient_support",
    ...categoryFields,
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
    reply,
    handoffMessageSnapshot: handoffSnapshot.snapshot,
  });

  return {
    context: {
      delivery_mode: "owner_handoff",
      ...categoryFields,
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
回答確定後の reply / state / Compass / assistantMessageId を受け取り、
state_changed=true、Compassあり、assistantMessageIdあり、handoff_message_snapshotありの場合は、
delivery_mode="owner_handoff" の短い context を返す。
state_changed=false、Compassなし、状態値1..5の場合は、
delivery_mode="recipient_support" の短い context を返す。
handoff_message_snapshot / reply から軽量カテゴリ分類を呼び、
major_category / minor_category / change_trigger_key を context に載せる。

このファイルは OpenAI JSON 生成、HOPY回答再要約、Compass再要約、
ユーザー発話読み取り、DB保存、Future Chain保存判定、state_changed再判定、
state_level再判定、current_phase再判定、Compass表示可否判定、
HOPY回答○判定、recipient_support検索、delivery_event保存、UI表示を担当しない。

【今回このファイルで修正したこと】
- futureChainCategory.ts の resolveFutureChainCategory(...) を import した。
- major_category / minor_category / change_trigger_key の型を null 固定からカテゴリ型へ広げた。
- owner_handoff 生成時に reply / handoff_message_snapshot からカテゴリを補完するようにした。
- recipient_support 生成時に reply からカテゴリを補完するようにした。
- none context ではカテゴリを null のまま維持した。
- OpenAI JSON契約を重くする処理は入れていない。
- HOPY回答全文、Compass全文、ユーザー発話生文を保存・再要約する処理は入れていない。
- state_changed、state_level、current_phase、prev系、Compass表示可否、HOPY回答○表示可否は再判定していない。

/app/api/chat/_lib/hopy/future-chain/futureChainContextFromFinalizedTurn.ts
*/