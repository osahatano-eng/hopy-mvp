// /app/api/chat/_lib/hopy/future-chain/futureChainDownwardCandidate.ts

import type {
  HopyFutureChainConfirmedPayload,
  HopyFutureChainSourceContext,
  HopyFutureChainStateLevel,
} from "./futureChainTypes";

export type FutureChainBridgeSummary = {
  insight: string;
  hint: string;
  flow: string;
  reason: string;
};

export type FutureChainDownwardMeaningParts = {
  abstractContext: string;
  transitionReason: string;
  effectiveSupport: string;
  userProgressSignal: string;
  futureSupportHint: string;
  bridgeSummary: FutureChainBridgeSummary;
  compassBasis: string | null;
  evidenceSources: string[];
};

type FutureChainDownwardTransitionParams = {
  fromStateLevel: HopyFutureChainStateLevel;
  toStateLevel: HopyFutureChainStateLevel;
};

type FutureChainDownwardMeaningInput = {
  payload?: HopyFutureChainConfirmedPayload | null;
  sourceContext?: HopyFutureChainSourceContext | null;
  userSignal?: string | null;
  hopySupport?: string | null;
};

type MeaningSource = {
  text: string;
  sources: string[];
};

const STATE_LABELS: Record<HopyFutureChainStateLevel, string> = {
  1: "混線",
  2: "模索",
  3: "整理",
  4: "収束",
  5: "決定",
};

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

function maskSensitiveText(value: unknown): string {
  return normalizeText(value)
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[email]")
    .replace(/https?:\/\/\S+/gi, "[url]")
    .replace(/\b\d{2,4}[-\s]?\d{2,4}[-\s]?\d{3,4}\b/g, "[number]")
    .replace(/\b\d{8,}\b/g, "[number]")
    .replace(/[「」『』]/g, "")
    .trim();
}

function sentenceLike(value: unknown, maxLength: number): string {
  const text = maskSensitiveText(value);
  if (!text) return "";

  const firstLine = text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)[0];

  if (!firstLine) return "";

  const firstSentence =
    firstLine.match(/^(.+?[。.!?！？])(?:\s|$)/)?.[1] ?? firstLine;

  return clipText(firstSentence, maxLength);
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
  payload?: HopyFutureChainConfirmedPayload | null,
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
  payload?: HopyFutureChainConfirmedPayload | null,
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
  sourceContext?: HopyFutureChainSourceContext | null,
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

function readCompassRecord(
  payload?: HopyFutureChainConfirmedPayload | null,
): Record<string, unknown> | null {
  const payloadRecord = asRecord(payload);
  return readNestedRecord(payloadRecord, "compass");
}

function abstractUserSignalFromText(value: unknown): string {
  const text = maskSensitiveText(value);
  const lower = text.toLowerCase();

  if (!text) {
    return "";
  }

  if (
    text.includes("もうだめ") ||
    text.includes("だめだ") ||
    text.includes("限界") ||
    text.includes("無理") ||
    text.includes("しんど") ||
    text.includes("つら") ||
    lower.includes("tired") ||
    lower.includes("exhausted")
  ) {
    return "ユーザーは、限界感や強いしんどさによって、決定状態を保つより回復や再調整が必要なサインを示した。";
  }

  if (
    text.includes("混乱") ||
    text.includes("頭") ||
    text.includes("整理付かない") ||
    text.includes("整理つかない") ||
    text.includes("整理がつかない") ||
    text.includes("何を話せば") ||
    text.includes("何から話せば") ||
    text.includes("相談する内容") ||
    lower.includes("confused")
  ) {
    return "ユーザーは、相談内容や思考がまとまらず、前進より先に現在地を言葉にし直す必要があるサインを示した。";
  }

  if (
    text.includes("不安") ||
    text.includes("怖") ||
    text.includes("心配") ||
    text.includes("引っかか") ||
    lower.includes("anxious") ||
    lower.includes("worried")
  ) {
    return "ユーザーは、不安や引っかかりが再燃し、進めていた方向を一度見直す必要があるサインを示した。";
  }

  if (
    text.includes("迷") ||
    text.includes("わからない") ||
    text.includes("分からない") ||
    text.includes("決められない") ||
    lower.includes("lost") ||
    lower.includes("not sure")
  ) {
    return "ユーザーは、決めた方向をそのまま保てず、判断軸を探し直す必要があるサインを示した。";
  }

  if (
    text.includes("違和感") ||
    text.includes("違う") ||
    text.includes("ズレ") ||
    lower.includes("off") ||
    lower.includes("wrong")
  ) {
    return "ユーザーは、進めていた方向への違和感を示し、再調整が必要なサインを出した。";
  }

  if (
    text.includes("疲れ") ||
    text.includes("休") ||
    text.includes("動けない") ||
    text.includes("止まりたい") ||
    lower.includes("rest")
  ) {
    return "ユーザーは、行動を続けるより回復を優先すべき消耗サインを示した。";
  }

  const sentence = sentenceLike(text, 160);
  if (!sentence) {
    return "";
  }

  return `ユーザーは、${sentence}という再調整につながる会話上のサインを示した。`;
}

function abstractHopySupportFromText(value: unknown): string {
  const text = maskSensitiveText(value);
  const lower = text.toLowerCase();

  if (!text) {
    return "";
  }

  if (
    text.includes("休") ||
    text.includes("何もしない") ||
    text.includes("無理に") ||
    text.includes("流れが変わる") ||
    text.includes("責め") ||
    lower.includes("rest")
  ) {
    return "HOPYは、無理に前進させず、休むことや何もしない時間を許す支援を返した。";
  }

  if (
    text.includes("一つ") ||
    text.includes("1つ") ||
    text.includes("書き出") ||
    text.includes("言葉") ||
    text.includes("外に出す")
  ) {
    return "HOPYは、すべてを解決しようとせず、まず一つだけ言葉にして足場を作る支援を返した。";
  }

  if (
    text.includes("整理") ||
    text.includes("並べ") ||
    text.includes("分け") ||
    text.includes("見直")
  ) {
    return "HOPYは、急いで決め直すより、不安や論点を整理し直す支援を返した。";
  }

  if (
    text.includes("判断軸") ||
    text.includes("軸") ||
    text.includes("方向") ||
    text.includes("優先")
  ) {
    return "HOPYは、進む方向を押しつけず、揺れている判断軸を見直す支援を返した。";
  }

  const sentence = sentenceLike(text, 180);
  if (!sentence) {
    return "";
  }

  return `HOPYは、${sentence}という再調整を支える応答を返した。`;
}

function buildTransitionLabel(params: FutureChainDownwardTransitionParams): string {
  const { fromStateLevel, toStateLevel } = params;
  return `${STATE_LABELS[fromStateLevel]}から${STATE_LABELS[toStateLevel]}への再調整`;
}

function resolveUserSignal(
  params: FutureChainDownwardMeaningInput,
): MeaningSource {
  const explicit = abstractUserSignalFromText(params.userSignal);
  if (explicit) {
    return {
      text: explicit,
      sources: ["explicit.user_signal"],
    };
  }

  const memoryBody = abstractUserSignalFromText(
    readMemoryCandidateBody(params.payload),
  );

  if (memoryBody) {
    return {
      text: memoryBody,
      sources: ["memory_candidates.body"],
    };
  }

  const sourceUserText = abstractUserSignalFromText(
    readSourceContextUserText(params.sourceContext),
  );

  if (sourceUserText) {
    return {
      text: sourceUserText,
      sources: ["source_context.user_text"],
    };
  }

  const dashboardSummary = abstractUserSignalFromText(
    readDashboardSignalSummary(params.payload),
  );

  if (dashboardSummary) {
    return {
      text: dashboardSummary,
      sources: ["dashboard_signals.summary"],
    };
  }

  return {
    text: "ユーザー側に、前の状態をそのまま保つより再調整が必要なサインが確認された。",
    sources: ["hopy_confirmed_payload.state"],
  };
}

function resolveHopySupport(
  params: FutureChainDownwardMeaningInput,
): MeaningSource {
  const explicit = abstractHopySupportFromText(params.hopySupport);
  if (explicit) {
    return {
      text: explicit,
      sources: ["explicit.hopy_support"],
    };
  }

  const compass = readCompassRecord(params.payload);
  const compassPrompt = abstractHopySupportFromText(compass?.prompt);

  if (compassPrompt) {
    return {
      text: compassPrompt,
      sources: ["compass.prompt"],
    };
  }

  const reply = abstractHopySupportFromText(params.payload?.reply);

  if (reply) {
    return {
      text: reply,
      sources: ["hopy_confirmed_payload.reply"],
    };
  }

  const dashboardSummary = abstractHopySupportFromText(
    readDashboardSignalSummary(params.payload),
  );

  if (dashboardSummary) {
    return {
      text: dashboardSummary,
      sources: ["dashboard_signals.summary"],
    };
  }

  return {
    text: "HOPYは、前進を急がせず、いま必要な再調整を支える応答を返した。",
    sources: ["hopy_confirmed_payload.state"],
  };
}

function resolveCompassBasis(
  payload?: HopyFutureChainConfirmedPayload | null,
): string | null {
  const compass = readCompassRecord(payload);
  const compassPrompt = sentenceLike(compass?.prompt, 120);
  const compassText = sentenceLike(compass?.text, 160);

  if (compassPrompt) {
    return `Compass根拠: ${compassPrompt}`;
  }

  if (compassText) {
    return `Compass根拠: ${compassText}`;
  }

  return null;
}

function buildDownwardTransitionReasonFromMeaning(params: {
  fromStateLevel: HopyFutureChainStateLevel;
  toStateLevel: HopyFutureChainStateLevel;
  userSignal: string;
  hopySupport: string;
}): string {
  const label = buildTransitionLabel(params);

  return clipText(
    `${label}として、${params.userSignal} そのため、状態を無理に上げようとせず、${params.hopySupport}`,
    360,
  );
}

function buildDownwardFutureSupportHintFromMeaning(params: {
  userSignal: string;
  hopySupport: string;
}): string {
  return clipText(
    `似た状態のユーザーには、状態を無理に上げようとせず、${params.userSignal} そのうえで、${params.hopySupport}`,
    360,
  );
}

function buildDownwardBridgeSummaryFromMeaning(params: {
  fromStateLevel: HopyFutureChainStateLevel;
  toStateLevel: HopyFutureChainStateLevel;
  userSignal: string;
  hopySupport: string;
  transitionReason: string;
  futureSupportHint: string;
}): FutureChainBridgeSummary {
  const label = buildTransitionLabel(params);

  return {
    insight: clipText(
      `この回では、${params.userSignal} そこから、${label}として扱える見直しの必要性が見えた。`,
      220,
    ),
    hint: clipText(params.futureSupportHint, 220),
    flow: clipText(
      `${STATE_LABELS[params.fromStateLevel]} → ${params.userSignal} → ${STATE_LABELS[params.toStateLevel]}`,
      220,
    ),
    reason: clipText(params.transitionReason, 220),
  };
}

export function buildDownwardMeaningParts(
  params: FutureChainDownwardTransitionParams & FutureChainDownwardMeaningInput,
): FutureChainDownwardMeaningParts {
  const userSignal = resolveUserSignal(params);
  const hopySupport = resolveHopySupport(params);

  const transitionReason = buildDownwardTransitionReasonFromMeaning({
    fromStateLevel: params.fromStateLevel,
    toStateLevel: params.toStateLevel,
    userSignal: userSignal.text,
    hopySupport: hopySupport.text,
  });

  const futureSupportHint = buildDownwardFutureSupportHintFromMeaning({
    userSignal: userSignal.text,
    hopySupport: hopySupport.text,
  });

  const bridgeSummary = buildDownwardBridgeSummaryFromMeaning({
    fromStateLevel: params.fromStateLevel,
    toStateLevel: params.toStateLevel,
    userSignal: userSignal.text,
    hopySupport: hopySupport.text,
    transitionReason,
    futureSupportHint,
  });

  return {
    abstractContext: clipText(
      `この回では、${userSignal.text}`,
      360,
    ),
    transitionReason,
    effectiveSupport: clipText(hopySupport.text, 360),
    userProgressSignal: clipText(
      `ユーザー側の再調整サイン: ${userSignal.text}`,
      360,
    ),
    futureSupportHint,
    bridgeSummary,
    compassBasis: resolveCompassBasis(params.payload),
    evidenceSources: Array.from(
      new Set([
        ...userSignal.sources,
        ...hopySupport.sources,
        "hopy_confirmed_payload.state",
      ]),
    ),
  };
}

export function buildDownwardAbstractContext(
  params: FutureChainDownwardTransitionParams & FutureChainDownwardMeaningInput,
): string {
  return buildDownwardMeaningParts(params).abstractContext;
}

export function buildDownwardTransitionReason(
  params: FutureChainDownwardTransitionParams & FutureChainDownwardMeaningInput,
): string {
  return buildDownwardMeaningParts(params).transitionReason;
}

export function buildDownwardEffectiveSupport(
  params: {
    toStateLevel: HopyFutureChainStateLevel;
  } & Partial<FutureChainDownwardTransitionParams> &
    FutureChainDownwardMeaningInput,
): string {
  const fromStateLevel = params.fromStateLevel ?? params.toStateLevel;

  return buildDownwardMeaningParts({
    fromStateLevel,
    toStateLevel: params.toStateLevel,
    payload: params.payload,
    sourceContext: params.sourceContext,
    userSignal: params.userSignal,
    hopySupport: params.hopySupport,
  }).effectiveSupport;
}

export function buildDownwardUserProgressSignal(
  params: FutureChainDownwardTransitionParams & FutureChainDownwardMeaningInput,
): string {
  return buildDownwardMeaningParts(params).userProgressSignal;
}

export function buildDownwardFutureSupportHint(
  params: {
    toStateLevel: HopyFutureChainStateLevel;
  } & Partial<FutureChainDownwardTransitionParams> &
    FutureChainDownwardMeaningInput,
): string {
  const fromStateLevel = params.fromStateLevel ?? params.toStateLevel;

  return buildDownwardMeaningParts({
    fromStateLevel,
    toStateLevel: params.toStateLevel,
    payload: params.payload,
    sourceContext: params.sourceContext,
    userSignal: params.userSignal,
    hopySupport: params.hopySupport,
  }).futureSupportHint;
}

export function buildDownwardBridgeSummary(
  params: FutureChainDownwardTransitionParams & FutureChainDownwardMeaningInput,
): FutureChainBridgeSummary {
  return buildDownwardMeaningParts(params).bridgeSummary;
}

/*
【このファイルの正式役割】
HOPY Future Chain DB の downward 専用 candidate 意味生成を担当する。
保存前チェックを通過した downward 遷移について、hopy_confirmed_payload / sourceContext / 明示的な userSignal / hopySupport をもとに、
abstract_context / transition_reason / effective_support / user_progress_signal / future_support_hint / bridge_summary を匿名化・抽象化して返す。
このファイルは保存前チェック、DB insert、state_changed再判定、state_level再判定、current_phase再判定、Compass再判定を担当しない。

【今回このファイルで修正したこと】
- 状態値だけを見て定形文を返す switch / 固定文生成をやめた。
- hopy_confirmed_payload の memory_candidates / reply / compass / dashboard_signals / state、および sourceContext から、下降・再調整に必要な意味を抽出する形へ全文置き換えした。
- ユーザー側の再調整サイン、HOPY側の支援、変化理由、未来ユーザーへのヒント、bridge_summary を payload 由来の意味情報から生成するようにした。
- 生ログをそのまま保存しないため、メール、URL、長い数字などをマスクし、引用記号を外し、短い抽象文へ変換する処理を入れた。
- buildDownwardMeaningParts(...) を追加し、下降candidateに必要な意味生成結果をまとめて返せるようにした。
- 既存の buildDownwardAbstractContext / buildDownwardTransitionReason / buildDownwardEffectiveSupport / buildDownwardUserProgressSignal / buildDownwardFutureSupportHint / buildDownwardBridgeSummary の export 名は維持した。
- 保存前チェック、DB insert、DB制約、UI、HOPY回答○、Compass表示、MEMORIES、DASHBOARDには触れていない。

/app/api/chat/_lib/hopy/future-chain/futureChainDownwardCandidate.ts
*/