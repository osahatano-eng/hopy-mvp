// /app/api/chat/_lib/hopy/future-chain/futureChainCandidate.ts

import type { HopyFutureChainPrecheckResult } from "./futureChainCheck";
import {
  buildDownwardAbstractContext,
  buildDownwardBridgeSummary,
  buildDownwardEffectiveSupport,
  buildDownwardFutureSupportHint,
  buildDownwardTransitionReason,
  buildDownwardUserProgressSignal,
  type FutureChainBridgeSummary,
} from "./futureChainDownwardCandidate";
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

type BridgeSummary = FutureChainBridgeSummary;

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

function buildTransitionKey(params: {
  fromStateLevel: HopyFutureChainStateLevel;
  toStateLevel: HopyFutureChainStateLevel;
}): string {
  return `${params.fromStateLevel}_${params.toStateLevel}`;
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
  return "似た状態のユーザーには、まず現在地を言語化し、次に進む方向を一つに絞る支援が有効な候補になる。";
}

function buildBridgeInsight(params: {
  fromStateLevel: HopyFutureChainStateLevel;
  toStateLevel: HopyFutureChainStateLevel;
}): string {
  const transitionKey = buildTransitionKey(params);

  switch (transitionKey) {
    case "1_2":
      return "今回の前進では、混線の中でも次に向かう方向を一つ持てる段階へ進んだ。";
    case "1_3":
      return "今回の前進では、混線していた状態から、論点を整理できる段階へ進んだ。";
    case "1_4":
      return "今回の前進では、混線していた状態から、進む方向をかなり絞れる段階へ進んだ。";
    case "1_5":
      return "今回の前進では、混線していた状態から、進む方向を決められる段階まで進んだ。";
    case "2_3":
      return "今回の前進では、模索していた状態から、論点を整理できる段階へ進んだ。";
    case "2_4":
      return "今回の前進では、模索していた状態から、進む方向を絞れる段階へ進んだ。";
    case "2_5":
      return "今回の前進では、模索していた状態から、進む方向を決定できる段階へ進んだ。";
    case "3_4":
      return "今回の前進では、整理された内容が、進む方向の収束につながった。";
    case "3_5":
      return "今回の前進では、整理された内容が、そのまま決定につながった。";
    case "4_5":
      return "今回の前進では、絞られた方向が、決定へつながった。";
    default:
      return `今回の前進では、${STATE_LABELS[params.fromStateLevel]}から${STATE_LABELS[params.toStateLevel]}へ進み、次に向かう方向が見えやすくなった。`;
  }
}

function buildBridgeHint(params: {
  toStateLevel: HopyFutureChainStateLevel;
}): string {
  switch (params.toStateLevel) {
    case 2:
      return "まずは現在地を言葉にし、次に進む方向を一つだけ持つと前進しやすい。";
    case 3:
      return "見えてきた論点を一度並べ替え、何を優先するかを言葉にすると整理が進みやすい。";
    case 4:
      return "整理できた内容の中から、いま最も大切な方向を一つに絞ると進みやすい。";
    case 5:
      return "絞れた方向に対して、小さくても採用の言葉を置くと決定につながりやすい。";
    default:
      return "まず現在地を言語化し、次に進む方向を一つに絞ると前進しやすい。";
  }
}

function buildBridgeFlow(params: {
  fromStateLevel: HopyFutureChainStateLevel;
  toStateLevel: HopyFutureChainStateLevel;
}): string {
  const transitionKey = buildTransitionKey(params);

  switch (transitionKey) {
    case "1_2":
      return "混線 → 次の方向の言語化 → 模索";
    case "1_3":
      return "混線 → 論点の整理 → 整理";
    case "1_4":
      return "混線 → 方向の絞り込み → 収束";
    case "1_5":
      return "混線 → 判断軸の明確化 → 決定";
    case "2_3":
      return "模索 → 優先順位の整理 → 整理";
    case "2_4":
      return "模索 → 方向の絞り込み → 収束";
    case "2_5":
      return "模索 → 判断軸の明確化 → 決定";
    case "3_4":
      return "整理 → 方向の絞り込み → 収束";
    case "3_5":
      return "整理 → 採用の明確化 → 決定";
    case "4_5":
      return "収束 → 最終判断 → 決定";
    default:
      return `${STATE_LABELS[params.fromStateLevel]} → 方向の言語化 → ${STATE_LABELS[params.toStateLevel]}`;
  }
}

function buildBridgeReason(params: {
  fromStateLevel: HopyFutureChainStateLevel;
  toStateLevel: HopyFutureChainStateLevel;
}): string {
  return `${STATE_LABELS[params.fromStateLevel]}から${STATE_LABELS[params.toStateLevel]}への変化が確認され、次に進む方向が会話上で明確になったため。`;
}

function buildBridgeSummary(params: {
  fromStateLevel: HopyFutureChainStateLevel;
  toStateLevel: HopyFutureChainStateLevel;
}): BridgeSummary {
  return {
    insight: buildBridgeInsight(params),
    hint: buildBridgeHint({
      toStateLevel: params.toStateLevel,
    }),
    flow: buildBridgeFlow(params),
    reason: buildBridgeReason(params),
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

  const isDownward = transitionKind === "downward";

  const bridgeSummary = isDownward
    ? buildDownwardBridgeSummary({
        fromStateLevel,
        toStateLevel,
      })
    : buildBridgeSummary({
        fromStateLevel,
        toStateLevel,
      });

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
    abstract_context: isDownward
      ? buildDownwardAbstractContext({
          fromStateLevel,
          toStateLevel,
        })
      : buildAbstractContext({
          fromStateLevel,
          toStateLevel,
        }),
    transition_reason: isDownward
      ? buildDownwardTransitionReason({
          fromStateLevel,
          toStateLevel,
        })
      : buildTransitionReason({
          fromStateLevel,
          toStateLevel,
        }),
    effective_support: isDownward
      ? buildDownwardEffectiveSupport({
          toStateLevel,
        })
      : buildEffectiveSupport({
          toStateLevel,
        }),
    user_progress_signal: isDownward
      ? buildDownwardUserProgressSignal({
          fromStateLevel,
          toStateLevel,
        })
      : buildUserProgressSignal({
          fromStateLevel,
          toStateLevel,
        }),
    future_support_hint: isDownward
      ? buildDownwardFutureSupportHint({
          toStateLevel,
        })
      : buildFutureSupportHint({
          fromStateLevel,
          toStateLevel,
        }),
    bridge_summary: bridgeSummary,
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
- downward 専用新規ファイル futureChainDownwardCandidate.ts を import した。
- transitionKind === "downward" のときだけ、abstract_context / transition_reason / effective_support / user_progress_signal / future_support_hint / bridge_summary を下降専用文言生成へ分岐するようにした。
- upward 側の既存生成関数は残し、upward 文言責務はこのファイルのまま維持した。
- pattern_key、保存前チェック、DB insert、Compass基準、metadata には触れていない。

【このファイルの正式役割】
HOPY Future Chain DB の保存候補 candidate 生成だけを担当する。
保存前チェックを通過した hopy_confirmed_payload 起点の情報を、DB保存用の抽象化candidateへ変換する。
このファイルは保存前チェック、DB insert、state_changed再判定、state_level再判定、current_phase再判定、Compass再判定を担当しない。

/app/api/chat/_lib/hopy/future-chain/futureChainCandidate.ts
*/