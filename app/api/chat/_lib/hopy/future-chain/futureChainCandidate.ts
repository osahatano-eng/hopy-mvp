// /app/api/chat/_lib/hopy/future-chain/futureChainCandidate.ts

import type { HopyFutureChainPrecheckResult } from "./futureChainCheck";
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

const STATE_LABELS: Record<HopyFutureChainStateLevel, string> = {
  1: "混線",
  2: "模索",
  3: "整理",
  4: "収束",
  5: "決定",
};

function normalizeText(value: unknown): string {
  if (typeof value !== "string") return "";
  return value.trim();
}

function normalizeLanguage(
  value: HopyFutureChainLanguage,
): HopyFutureChainLanguage {
  const normalized = normalizeText(value).toLowerCase();
  if (normalized === "ja") return "ja";
  if (normalized === "en") return "en";
  return "ja";
}

function buildStateTransitionLabel(params: {
  fromStateLevel: HopyFutureChainStateLevel;
  toStateLevel: HopyFutureChainStateLevel;
}): string {
  const { fromStateLevel, toStateLevel } = params;
  return `${STATE_LABELS[fromStateLevel]}から${STATE_LABELS[toStateLevel]}への前進`;
}

function buildPatternKey(params: {
  fromStateLevel: HopyFutureChainStateLevel;
  toStateLevel: HopyFutureChainStateLevel;
  transitionKind: HopyFutureChainTransitionKind;
}): string {
  const { fromStateLevel, toStateLevel, transitionKind } = params;
  return `state_${fromStateLevel}_to_${toStateLevel}_${transitionKind}_by_hopy_direction`;
}

function resolveCompassBasis(
  payload: HopyFutureChainConfirmedPayload,
): string | null {
  const compassText = normalizeText(payload.compass?.text);
  const compassPrompt = normalizeText(payload.compass?.prompt);

  if (compassText && compassPrompt) {
    return "HOPY回答○に紐づくCompass根拠が存在する。";
  }

  if (compassText) {
    return "HOPY回答○に紐づくCompass本文が存在する。";
  }

  if (compassPrompt) {
    return "HOPY回答○に紐づくCompass prompt が存在する。";
  }

  return null;
}

function buildAbstractContext(params: {
  fromStateLevel: HopyFutureChainStateLevel;
  toStateLevel: HopyFutureChainStateLevel;
}): string {
  return `${buildStateTransitionLabel(params)}が、自然な会話の流れの中で確認された。`;
}

function buildTransitionReason(params: {
  fromStateLevel: HopyFutureChainStateLevel;
  toStateLevel: HopyFutureChainStateLevel;
}): string {
  return `ユーザーの状態が ${STATE_LABELS[params.fromStateLevel]} から ${STATE_LABELS[params.toStateLevel]} へ進み、前進方向が明確になった。`;
}

function buildEffectiveSupport(params: {
  toStateLevel: HopyFutureChainStateLevel;
}): string {
  return `HOPYが現在地を整理し、${STATE_LABELS[params.toStateLevel]}へ進むための方向を示した。`;
}

function buildUserProgressSignal(params: {
  fromStateLevel: HopyFutureChainStateLevel;
  toStateLevel: HopyFutureChainStateLevel;
}): string {
  return `状態値が ${params.fromStateLevel} から ${params.toStateLevel} へ上昇した。`;
}

function buildFutureSupportHint(params: {
  fromStateLevel: HopyFutureChainStateLevel;
  toStateLevel: HopyFutureChainStateLevel;
}): string {
  return `似た状態のユーザーには、まず現在地を言語化し、次に進む方向を一つに絞る支援が有効な候補になる。`;
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

  const candidate: HopyFutureChainCandidate = {
    pattern_key: buildPatternKey({
      fromStateLevel,
      toStateLevel,
      transitionKind,
    }),
    language,
    from_state_level: fromStateLevel,
    to_state_level: toStateLevel,
    transition_kind: transitionKind,
    abstract_context: buildAbstractContext({
      fromStateLevel,
      toStateLevel,
    }),
    transition_reason: buildTransitionReason({
      fromStateLevel,
      toStateLevel,
    }),
    effective_support: buildEffectiveSupport({
      toStateLevel,
    }),
    user_progress_signal: buildUserProgressSignal({
      fromStateLevel,
      toStateLevel,
    }),
    future_support_hint: buildFutureSupportHint({
      fromStateLevel,
      toStateLevel,
    }),
    compass_basis: resolveCompassBasis(payload),
    safety_notes:
      "生ログ、個人情報、企業機密、医療・法律・金融判断の断定は保存しない。",
    avoidance_notes:
      "他ユーザーへそのまま当てはめず、参考候補としてのみ扱う。",
    evidence_count: 1,
    weight: 1,
    confidence_score: 0.5,
    reuse_scope: "experimental",
    status: "active",
    metadata: {
      source: "hopy_confirmed_payload",
      version: HOPY_FUTURE_CHAIN_GENERATION_VERSION,
    },
    source_transition_signal_id: null,
    source_response_learning_id: null,
    source_learning_insight_id: null,
  };

  return {
    decision: "save",
    reason: "Future Chain candidate を生成した",
    status: "active",
    candidate,
  };
}

/*
【このファイルの正式役割】
HOPY Future Chain DB の保存候補 candidate 生成だけを担当する。
保存前チェックを通過した hopy_confirmed_payload 起点の情報を、DB保存用の抽象化candidateへ変換する。
このファイルは保存前チェック、DB insert、state_changed再判定、state_level再判定、current_phase再判定、Compass再判定を担当しない。

【今回このファイルで修正したこと】
- Future Chain 専用フォルダ内に、candidate生成専用ファイルを新規作成した。
- 保存前チェックを通過した upward の状態変化だけを、匿名化・抽象化された Future Chain candidate に変換する処理を作成した。
- 生ログ、個人情報、企業機密を保存しないため、reply本文やCompass本文そのものをcandidate本文へ混ぜない構造にした。
- metadata は source と version のみに限定した。
- DB insert、重複確認、既存Learning処理への接続はまだ実装していない。

/app/api/chat/_lib/hopy/future-chain/futureChainCandidate.ts
*/