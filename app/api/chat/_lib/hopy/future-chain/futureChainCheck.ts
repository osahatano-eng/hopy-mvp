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

function resolveTransitionKind(params: {
  fromStateLevel: HopyFutureChainStateLevel;
  toStateLevel: HopyFutureChainStateLevel;
}): HopyFutureChainTransitionKind {
  const { fromStateLevel, toStateLevel } = params;

  if (toStateLevel > fromStateLevel) return "upward";
  if (toStateLevel < fromStateLevel) return "downward";
  return "same_level";
}

function resolveConfirmedPayload(
  value: unknown,
): HopyFutureChainConfirmedPayload | null {
  if (!isRecord(value)) return null;
  return value as HopyFutureChainConfirmedPayload;
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

  const transitionKind = resolveTransitionKind({
    fromStateLevel,
    toStateLevel,
  });

  if (transitionKind === "same_level") {
    return {
      decision: "skip",
      reason: "same_level は保存候補にしない",
      status: "none",
    };
  }

  const reply = normalizeText(confirmedPayload.reply);

  if (!reply) {
    return {
      decision: "skip",
      reason: "reply が存在しない",
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
hopy_confirmed_payload を唯一の起点として受け取り、保存処理へ進んでよいか、skip するかを判定する。
このファイルは candidate生成、DB insert、state_changed再判定、state_level再判定、current_phase再判定、Compass再判定を担当しない。

【今回このファイルで修正したこと】
- Future Chain 保存前チェックの遷移条件を、upward限定から same_level除外へ変更した。
- これにより、state_changed=true の downward 遷移も保存候補として先へ進めるようにした。
- 開発テスト除外、新規チャット1発話目除外、state_changed確認、状態値1..5確認、reply確認には触れていない。

 /app/api/chat/_lib/hopy/future-chain/futureChainCheck.ts
*/