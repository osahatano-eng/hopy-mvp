// /app/api/chat/_lib/hopy/future-chain/futureChainDownwardCandidate.ts

import type { HopyFutureChainStateLevel } from "./futureChainTypes";

export type FutureChainBridgeSummary = {
  insight: string;
  hint: string;
  flow: string;
  reason: string;
};

const STATE_LABELS: Record<HopyFutureChainStateLevel, string> = {
  1: "混線",
  2: "模索",
  3: "整理",
  4: "収束",
  5: "決定",
};

function buildTransitionKey(params: {
  fromStateLevel: HopyFutureChainStateLevel;
  toStateLevel: HopyFutureChainStateLevel;
}): string {
  return `${params.fromStateLevel}_${params.toStateLevel}`;
}

function buildDownwardStateTransitionLabel(params: {
  fromStateLevel: HopyFutureChainStateLevel;
  toStateLevel: HopyFutureChainStateLevel;
}): string {
  const { fromStateLevel, toStateLevel } = params;
  return `${STATE_LABELS[fromStateLevel]}から${STATE_LABELS[toStateLevel]}への再調整`;
}

export function buildDownwardAbstractContext(params: {
  fromStateLevel: HopyFutureChainStateLevel;
  toStateLevel: HopyFutureChainStateLevel;
}): string {
  return `${buildDownwardStateTransitionLabel(params)}が、自然な会話の流れの中で確認された。`;
}

export function buildDownwardTransitionReason(params: {
  fromStateLevel: HopyFutureChainStateLevel;
  toStateLevel: HopyFutureChainStateLevel;
}): string {
  return `ユーザーの状態が ${STATE_LABELS[params.fromStateLevel]} から ${STATE_LABELS[params.toStateLevel]} へ変化し、見直しや再調整が必要な論点が言葉になった。`;
}

export function buildDownwardEffectiveSupport(params: {
  toStateLevel: HopyFutureChainStateLevel;
}): string {
  switch (params.toStateLevel) {
    case 4:
      return "HOPYが無理に前進を急がせず、判断軸の揺れを見直すための支えを返した。";
    case 3:
      return "HOPYが無理に進行を促さず、不安や引っかかりを整理し直すための支えを返した。";
    case 2:
      return "HOPYが結論へ押し戻さず、何を頼りに進むかを探し直すための支えを返した。";
    case 1:
      return "HOPYが無理に整えようとせず、混線そのものを言葉にし直すための足場を返した。";
    default:
      return "HOPYが無理に前進を急がせず、再調整に必要な見直しの支えを返した。";
  }
}

export function buildDownwardUserProgressSignal(params: {
  fromStateLevel: HopyFutureChainStateLevel;
  toStateLevel: HopyFutureChainStateLevel;
}): string {
  return `状態値が ${params.fromStateLevel} から ${params.toStateLevel} へ下がり、再調整が必要なサインが会話上で確認された。`;
}

export function buildDownwardFutureSupportHint(params: {
  toStateLevel: HopyFutureChainStateLevel;
}): string {
  switch (params.toStateLevel) {
    case 4:
      return "似た状態のユーザーには、決め直しを急ぐより、いま揺れている判断軸を一つ言葉にする支援が有効な候補になる。";
    case 3:
      return "似た状態のユーザーには、進行を急がせるより、不安や引っかかりを一つずつ整理する支援が有効な候補になる。";
    case 2:
      return "似た状態のユーザーには、何を頼りに進めなくなったのかを言葉にし直す支援が有効な候補になる。";
    case 1:
      return "似た状態のユーザーには、まず混線そのものを言葉にして足場を取り戻す支援が有効な候補になる。";
    default:
      return "似た状態のユーザーには、進行を急がせるより、再調整に必要な違和感を言葉にする支援が有効な候補になる。";
  }
}

function buildDownwardBridgeInsight(params: {
  fromStateLevel: HopyFutureChainStateLevel;
  toStateLevel: HopyFutureChainStateLevel;
}): string {
  const transitionKey = buildTransitionKey(params);

  switch (transitionKey) {
    case "5_4":
      return "今回の再調整では、決めた方向をそのまま進めるより、判断軸の揺れを見直す必要が見えてきた。";
    case "5_3":
      return "今回の再調整では、決めたつもりだった方向よりも、不安や引っかかりを整理し直す必要が見えてきた。";
    case "5_2":
      return "今回の再調整では、決めたつもりだった方向よりも、何を頼りに進むかを探し直す必要が見えてきた。";
    case "5_1":
      return "今回の再調整では、決定を保つことより先に、混線そのものをほどく必要が見えてきた。";
    case "4_3":
      return "今回の再調整では、絞っていた方向よりも、整理し直すべき論点が残っていることが見えてきた。";
    case "4_2":
      return "今回の再調整では、収束させることより、模索し直す必要があることが見えてきた。";
    case "3_2":
      return "今回の再調整では、整理したつもりだった内容より、まだ探し直すべき判断軸が残っていることが見えてきた。";
    case "3_1":
      return "今回の再調整では、整理を進める前に、混線そのものを言葉にし直す必要が見えてきた。";
    case "2_1":
      return "今回の再調整では、模索を続ける前に、混線した現在地を取り戻す必要が見えてきた。";
    default:
      return `${STATE_LABELS[params.fromStateLevel]}から${STATE_LABELS[params.toStateLevel]}への変化では、無理に進むより見直しが必要な論点が見えてきた。`;
  }
}

function buildDownwardBridgeHint(params: {
  toStateLevel: HopyFutureChainStateLevel;
}): string {
  switch (params.toStateLevel) {
    case 4:
      return "決め直しを急ぐ前に、いま揺れている判断軸を一つ言葉にすると再調整しやすい。";
    case 3:
      return "まず不安や引っかかりを一つずつ並べると、再整理につながりやすい。";
    case 2:
      return "進む答えを急ぐ前に、何を頼りにできなくなったのかを言葉にすると模索し直しやすい。";
    case 1:
      return "まず混線そのものをそのまま言葉にすると、立て直しの足場につながりやすい。";
    default:
      return "前進を急ぐより、いまの違和感や揺れを一つ言葉にすると再調整しやすい。";
  }
}

function buildDownwardBridgeFlow(params: {
  fromStateLevel: HopyFutureChainStateLevel;
  toStateLevel: HopyFutureChainStateLevel;
}): string {
  const transitionKey = buildTransitionKey(params);

  switch (transitionKey) {
    case "5_4":
      return "決定 → 判断軸の揺れの言語化 → 収束";
    case "5_3":
      return "決定 → 不安の言語化 → 整理";
    case "5_2":
      return "決定 → 迷いの再燃 → 模索";
    case "5_1":
      return "決定 → 混線の再燃 → 混線";
    case "4_3":
      return "収束 → 引っかかりの言語化 → 整理";
    case "4_2":
      return "収束 → 方向の揺れ → 模索";
    case "3_2":
      return "整理 → 判断軸の揺れ → 模索";
    case "3_1":
      return "整理 → 混線の再燃 → 混線";
    case "2_1":
      return "模索 → 足場の喪失 → 混線";
    default:
      return `${STATE_LABELS[params.fromStateLevel]} → 再調整 → ${STATE_LABELS[params.toStateLevel]}`;
  }
}

function buildDownwardBridgeReason(params: {
  fromStateLevel: HopyFutureChainStateLevel;
  toStateLevel: HopyFutureChainStateLevel;
}): string {
  return `${STATE_LABELS[params.fromStateLevel]}から${STATE_LABELS[params.toStateLevel]}への変化が確認され、進み方を見直す必要が会話上で明確になったため。`;
}

export function buildDownwardBridgeSummary(params: {
  fromStateLevel: HopyFutureChainStateLevel;
  toStateLevel: HopyFutureChainStateLevel;
}): FutureChainBridgeSummary {
  return {
    insight: buildDownwardBridgeInsight(params),
    hint: buildDownwardBridgeHint({
      toStateLevel: params.toStateLevel,
    }),
    flow: buildDownwardBridgeFlow(params),
    reason: buildDownwardBridgeReason(params),
  };
}

/*
【このファイルの正式役割】
HOPY Future Chain DB の downward 専用 candidate 文言生成だけを担当する。
保存前チェックを通過した downward 遷移について、abstract_context / transition_reason / effective_support / user_progress_signal / future_support_hint / bridge_summary を下降専用文言で返す。
このファイルは保存前チェック、DB insert、state_changed再判定、state_level再判定、current_phase再判定、Compass再判定を担当しない。

【今回このファイルで修正したこと】
- downward 専用の新規ファイルを追加した。
- upward 前提の「前進」文言を使わず、下降を「再調整」「見直し」「揺れ」の文脈で表現する関数群を分離した。
- bridge_summary の insight / hint / flow / reason も downward 専用で分けた。
- まだ futureChainCandidate.ts からの import 接続と export 接続はしていない。

/app/api/chat/_lib/hopy/future-chain/futureChainDownwardCandidate.ts
*/