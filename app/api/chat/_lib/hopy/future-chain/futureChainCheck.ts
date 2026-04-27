// /app/api/chat/_lib/hopy/future-chain/futureChainCheck.ts

import type {
  HopyFutureChainConfirmedPayload,
  HopyFutureChainDecisionStatus,
  HopyFutureChainSourceContext,
  HopyFutureChainStateLevel,
  HopyFutureChainTransitionKind,
} from "./futureChainTypes";

export type HopyFutureChainPrecheckResult =
  | {
      decision: "continue";
      reason: string;
      status: "none";
      fromStateLevel: HopyFutureChainStateLevel;
      toStateLevel: HopyFutureChainStateLevel;
      transitionKind: HopyFutureChainTransitionKind;
    }
  | {
      decision: "skip";
      reason: string;
      status: HopyFutureChainDecisionStatus;
    };

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function normalizeStateLevel(
  value: unknown,
): HopyFutureChainStateLevel | null {
  if (typeof value !== "number" || !Number.isInteger(value)) return null;
  if (value < 1 || value > 5) return null;
  return value as HopyFutureChainStateLevel;
}

function normalizeText(value: unknown): string {
  if (typeof value !== "string") return "";
  return value.trim();
}

function normalizeTransitionKind(
  value: unknown,
): HopyFutureChainTransitionKind | null {
  if (value === "upward") return "upward";
  if (value === "downward") return "downward";
  if (value === "same_level") return "same_level";
  return null;
}

function isValidTransitionMeaning(value: unknown): boolean {
  const text = normalizeText(value);

  return (
    text === "progress" ||
    text === "readjustment" ||
    text === "recovery_entry" ||
    text === "premise_reconsideration" ||
    text === "stabilization" ||
    text === "reinforcement"
  );
}

function resolveConfirmedPayload(
  value: unknown,
): HopyFutureChainConfirmedPayload | null {
  if (!isRecord(value)) return null;
  return value as HopyFutureChainConfirmedPayload;
}

function resolveFutureChainContext(
  confirmedPayload: HopyFutureChainConfirmedPayload,
): Record<string, unknown> | null {
  const context = confirmedPayload.future_chain_context;
  if (!isRecord(context)) return null;
  return context;
}

function hasRequiredOwnerHandoffContext(
  context: Record<string, unknown>,
): boolean {
  return (
    !!normalizeText(context.support_shape_key) &&
    isValidTransitionMeaning(context.transition_meaning) &&
    !!normalizeText(context.handoff_message_snapshot)
  );
}

function isMissingRequiredId(value: unknown): boolean {
  return !normalizeText(value);
}

function isDevelopmentLikeInput(params: {
  sourceContext: HopyFutureChainSourceContext;
}): boolean {
  const { sourceContext } = params;

  return (
    sourceContext.isDevelopmentTest === true ||
    sourceContext.isFirstUserMessageInThread === true
  );
}

export function checkFutureChainSavePreconditions(params: {
  sourceContext: HopyFutureChainSourceContext;
}): HopyFutureChainPrecheckResult {
  const { sourceContext } = params;

  if (isMissingRequiredId(sourceContext.userId)) {
    return {
      decision: "skip",
      reason: "user_id が存在しない",
      status: "none",
    };
  }

  if (isMissingRequiredId(sourceContext.threadId)) {
    return {
      decision: "skip",
      reason: "thread_id が存在しない",
      status: "none",
    };
  }

  if (isMissingRequiredId(sourceContext.userMessageId)) {
    return {
      decision: "skip",
      reason: "user_message_id が存在しない",
      status: "none",
    };
  }

  if (isMissingRequiredId(sourceContext.assistantMessageId)) {
    return {
      decision: "skip",
      reason: "assistant_message_id が存在しない",
      status: "none",
    };
  }

  const confirmedPayload = resolveConfirmedPayload(
    sourceContext.hopyConfirmedPayload,
  );

  if (!confirmedPayload) {
    return {
      decision: "skip",
      reason: "hopy_confirmed_payload が存在しない",
      status: "none",
    };
  }

  const confirmedState = confirmedPayload.state;

  if (!isRecord(confirmedState)) {
    return {
      decision: "skip",
      reason: "hopy_confirmed_payload.state が存在しない",
      status: "none",
    };
  }

  if (confirmedState.state_changed !== true) {
    return {
      decision: "skip",
      reason: "state_changed が true ではない",
      status: "none",
    };
  }

  const fromStateLevel = normalizeStateLevel(confirmedState.prev_state_level);
  const toStateLevel = normalizeStateLevel(confirmedState.state_level);

  if (fromStateLevel === null) {
    return {
      decision: "skip",
      reason: "prev_state_level が 1..5 ではない",
      status: "none",
    };
  }

  if (toStateLevel === null) {
    return {
      decision: "skip",
      reason: "state_level が 1..5 ではない",
      status: "none",
    };
  }

  if (isDevelopmentLikeInput({ sourceContext })) {
    return {
      decision: "skip",
      reason: "新規チャット1発話目または開発テスト送信は保存対象外",
      status: "none",
    };
  }

  const futureChainContext = resolveFutureChainContext(confirmedPayload);

  if (!futureChainContext) {
    return {
      decision: "skip",
      reason: "future_chain_context が存在しない",
      status: "none",
    };
  }

  if (normalizeText(futureChainContext.delivery_mode) !== "owner_handoff") {
    return {
      decision: "skip",
      reason: "delivery_mode が owner_handoff ではない",
      status: "none",
    };
  }

  const transitionKind = normalizeTransitionKind(
    futureChainContext.transition_kind,
  );

  if (!transitionKind) {
    return {
      decision: "skip",
      reason: "future_chain_context.transition_kind が不正",
      status: "none",
    };
  }

  if (transitionKind === "same_level") {
    return {
      decision: "skip",
      reason: "same_level は保存候補にしない",
      status: "none",
    };
  }

  if (!hasRequiredOwnerHandoffContext(futureChainContext)) {
    return {
      decision: "skip",
      reason:
        "owner_handoff 保存に必要な handoff_message_snapshot が不足",
      status: "none",
    };
  }

  return {
    decision: "continue",
    reason: "保存前チェックを通過",
    status: "none",
    fromStateLevel,
    toStateLevel,
    transitionKind,
  };
}

/*
【このファイルの正式役割】
HOPY Future Chain DB の保存前チェックだけを担当する。
hopy_confirmed_payload.future_chain_context を唯一の起点として受け取り、
owner_handoff を保存処理へ進めてよいか、skip するかを判定する。
v3.1では、owner_handoff 4項目ではなく handoff_message_snapshot を保存前チェックの主条件にする。

このファイルは candidate生成、DB insert、HOPY回答再要約、Compass再要約、
state_changed再判定、state_level再判定、current_phase再判定、
Compass再判定、HOPY回答○再判定を担当しない。

【今回このファイルで修正したこと】
- 旧v3の owner_handoff.insight / hint / flow / reason 必須チェックを削除しました。
- owner_handoff 保存前チェックを、support_shape_key / transition_meaning / handoff_message_snapshot 必須へ変更しました。
- major_category / minor_category / change_trigger_key は v3.1 candidate側で最小分類値を補うため、保存前チェックでは必須にしない形へ変更しました。
- delivery_mode owner_handoff、transition_kind、same_level除外、state_changed確認、状態値1..5確認は維持しました。
- candidate生成、DB insert、UI判定、recipient_support検索、delivery_event保存には触れていません。

/app/api/chat/_lib/hopy/future-chain/futureChainCheck.ts
*/