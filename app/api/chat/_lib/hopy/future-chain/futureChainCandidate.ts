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

type BridgeSummary = {
  insight: string;
  hint: string;
  flow: string;
  reason: string;
};

type MeaningEvidence = {
  userSignal: string;
  hopySupport: string;
  transitionReason: string;
  futureSupportHint: string;
  bridgeSummary: BridgeSummary;
  compassBasis: string | null;
  evidenceSources: string[];
};

const STATE_LABELS: Record<HopyFutureChainStateLevel, string> = {
  1: "混線",
  2: "模索",
  3: "整理",
  4: "収束",
  5: "決定",
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
  payload: HopyFutureChainConfirmedPayload,
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
  payload: HopyFutureChainConfirmedPayload,
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
  sourceContext: HopyFutureChainSourceContext,
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

function readSourceContextIds(
  sourceContext: HopyFutureChainSourceContext,
): {
  sourceTransitionSignalId: string | null;
  sourceResponseLearningId: string | null;
  sourceLearningInsightId: string | null;
} {
  const sourceRecord = asRecord(sourceContext);

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
  };
}

function buildStableHash(value: string): string {
  let hash = 2166136261;

  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }

  return (hash >>> 0).toString(36);
}

function buildPatternKey(params: {
  language: HopyFutureChainLanguage;
  fromStateLevel: HopyFutureChainStateLevel;
  toStateLevel: HopyFutureChainStateLevel;
  transitionKind: HopyFutureChainTransitionKind;
  userSignal: string;
  hopySupport: string;
}): string {
  const seed = [
    params.language,
    params.fromStateLevel,
    params.toStateLevel,
    params.transitionKind,
    params.userSignal,
    params.hopySupport,
  ].join("|");

  return `state_${params.fromStateLevel}_to_${params.toStateLevel}_${params.transitionKind}_${buildStableHash(seed)}`;
}

function buildTransitionLabel(params: {
  fromStateLevel: HopyFutureChainStateLevel;
  toStateLevel: HopyFutureChainStateLevel;
  transitionKind: HopyFutureChainTransitionKind;
}): string {
  const fromLabel = STATE_LABELS[params.fromStateLevel];
  const toLabel = STATE_LABELS[params.toStateLevel];

  if (params.transitionKind === "downward") {
    return `${fromLabel}から${toLabel}への再調整`;
  }

  if (params.transitionKind === "same_level") {
    return `${fromLabel}での維持・補強`;
  }

  return `${fromLabel}から${toLabel}への前進`;
}

function resolveCompassBasis(
  payload: HopyFutureChainConfirmedPayload,
): string | null {
  const payloadRecord = asRecord(payload);
  const compass = readNestedRecord(payloadRecord, "compass");
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

function buildUserSignal(params: {
  sourceContext: HopyFutureChainSourceContext;
  payload: HopyFutureChainConfirmedPayload;
}): { text: string; sources: string[] } {
  const memoryBody = sentenceLike(readMemoryCandidateBody(params.payload), 180);
  if (memoryBody) {
    return {
      text: `${memoryBody}`,
      sources: ["memory_candidates.body"],
    };
  }

  const sourceUserText = sentenceLike(
    readSourceContextUserText(params.sourceContext),
    160,
  );

  if (sourceUserText) {
    return {
      text: `ユーザーは、${sourceUserText}という会話上のサインを示した。`,
      sources: ["source_context.user_text"],
    };
  }

  const dashboardSummary = sentenceLike(
    readDashboardSignalSummary(params.payload),
    160,
  );

  if (dashboardSummary) {
    return {
      text: `ユーザー側の状態変化は、${dashboardSummary}`,
      sources: ["dashboard_signals.summary"],
    };
  }

  return {
    text: "ユーザー側の状態変化サインが、HOPY確定payload上で確認された。",
    sources: ["hopy_confirmed_payload.state"],
  };
}

function buildHopySupport(params: {
  payload: HopyFutureChainConfirmedPayload;
}): { text: string; sources: string[] } {
  const payloadRecord = asRecord(params.payload);
  const compass = readNestedRecord(payloadRecord, "compass");

  const compassPrompt = sentenceLike(compass?.prompt, 160);
  if (compassPrompt) {
    return {
      text: `HOPYは、${compassPrompt}という支援の方向を返した。`,
      sources: ["compass.prompt"],
    };
  }

  const reply = sentenceLike(params.payload.reply, 180);
  if (reply) {
    return {
      text: `HOPYは、${reply}という支援を返した。`,
      sources: ["hopy_confirmed_payload.reply"],
    };
  }

  const dashboardSummary = sentenceLike(
    readDashboardSignalSummary(params.payload),
    180,
  );

  if (dashboardSummary) {
    return {
      text: `HOPYは、${dashboardSummary}という支援を返した。`,
      sources: ["dashboard_signals.summary"],
    };
  }

  return {
    text: "HOPYは、状態変化に合わせた支援を返した。",
    sources: ["hopy_confirmed_payload.state"],
  };
}

function buildTransitionReason(params: {
  fromStateLevel: HopyFutureChainStateLevel;
  toStateLevel: HopyFutureChainStateLevel;
  transitionKind: HopyFutureChainTransitionKind;
  userSignal: string;
  hopySupport: string;
}): string {
  const label = buildTransitionLabel(params);

  if (params.transitionKind === "downward") {
    return clipText(
      `${label}として、${params.userSignal} そのため、前進を急がせるより、${params.hopySupport}`,
      360,
    );
  }

  if (params.transitionKind === "same_level") {
    return clipText(
      `${label}として、${params.userSignal} その状態を崩さず支えるため、${params.hopySupport}`,
      360,
    );
  }

  return clipText(
    `${label}として、${params.userSignal} その変化を支えるため、${params.hopySupport}`,
    360,
  );
}

function buildFutureSupportHint(params: {
  transitionKind: HopyFutureChainTransitionKind;
  userSignal: string;
  hopySupport: string;
}): string {
  if (params.transitionKind === "downward") {
    return clipText(
      `似た状態のユーザーには、状態を無理に上げようとせず、${params.userSignal} そのうえで、${params.hopySupport}`,
      360,
    );
  }

  if (params.transitionKind === "same_level") {
    return clipText(
      `似た状態のユーザーには、変化を急がせず、${params.userSignal} その状態を支える形で、${params.hopySupport}`,
      360,
    );
  }

  return clipText(
    `似た状態のユーザーには、${params.userSignal} このサインが見えた段階で、${params.hopySupport}`,
    360,
  );
}

function buildBridgeSummary(params: {
  fromStateLevel: HopyFutureChainStateLevel;
  toStateLevel: HopyFutureChainStateLevel;
  transitionKind: HopyFutureChainTransitionKind;
  userSignal: string;
  hopySupport: string;
  transitionReason: string;
  futureSupportHint: string;
}): BridgeSummary {
  const label = buildTransitionLabel(params);

  return {
    insight: clipText(
      `この回では、${params.userSignal} そこから、${label}として扱える状態変化が見えた。`,
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

function buildMeaningEvidence(params: {
  sourceContext: HopyFutureChainSourceContext;
  payload: HopyFutureChainConfirmedPayload;
  fromStateLevel: HopyFutureChainStateLevel;
  toStateLevel: HopyFutureChainStateLevel;
  transitionKind: HopyFutureChainTransitionKind;
}): MeaningEvidence {
  const userSignal = buildUserSignal({
    sourceContext: params.sourceContext,
    payload: params.payload,
  });

  const hopySupport = buildHopySupport({
    payload: params.payload,
  });

  const transitionReason = buildTransitionReason({
    fromStateLevel: params.fromStateLevel,
    toStateLevel: params.toStateLevel,
    transitionKind: params.transitionKind,
    userSignal: userSignal.text,
    hopySupport: hopySupport.text,
  });

  const futureSupportHint = buildFutureSupportHint({
    transitionKind: params.transitionKind,
    userSignal: userSignal.text,
    hopySupport: hopySupport.text,
  });

  const bridgeSummary = buildBridgeSummary({
    fromStateLevel: params.fromStateLevel,
    toStateLevel: params.toStateLevel,
    transitionKind: params.transitionKind,
    userSignal: userSignal.text,
    hopySupport: hopySupport.text,
    transitionReason,
    futureSupportHint,
  });

  return {
    userSignal: userSignal.text,
    hopySupport: hopySupport.text,
    transitionReason,
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
  const sourceIds = readSourceContextIds(sourceContext);

  const meaning = buildMeaningEvidence({
    sourceContext,
    payload,
    fromStateLevel,
    toStateLevel,
    transitionKind,
  });

  const candidate: HopyFutureChainCandidate = {
    pattern_key: buildPatternKey({
      language,
      fromStateLevel,
      toStateLevel,
      transitionKind,
      userSignal: meaning.userSignal,
      hopySupport: meaning.hopySupport,
    }),
    language,
    from_state_level: fromStateLevel,
    to_state_level: toStateLevel,
    transition_kind: transitionKind,
    abstract_context: clipText(
      `この回では、${meaning.userSignal}`,
      360,
    ),
    transition_reason: meaning.transitionReason,
    effective_support: clipText(meaning.hopySupport, 360),
    user_progress_signal: clipText(
      `ユーザー側の状態変化サイン: ${meaning.userSignal}`,
      360,
    ),
    future_support_hint: meaning.futureSupportHint,
    bridge_summary: meaning.bridgeSummary,
    compass_basis: meaning.compassBasis,
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
      generation: "payload_meaning_extraction_v1",
      evidence_sources: meaning.evidenceSources,
      raw_log_saved: false,
    },
    source_transition_signal_id: sourceIds.sourceTransitionSignalId,
    source_response_learning_id: sourceIds.sourceResponseLearningId,
    source_learning_insight_id: sourceIds.sourceLearningInsightId,
  };

  return {
    decision: "save",
    reason: "Future Chain candidate を hopy_confirmed_payload の意味情報から生成した",
    status: "active",
    candidate,
  };
}

/*
【このファイルの正式役割】
HOPY Future Chain DB の保存候補 candidate 生成だけを担当する。
保存前チェックを通過した hopy_confirmed_payload 起点の情報を、DB保存用の匿名化・抽象化candidateへ変換する。
このファイルは保存前チェック、DB insert、state_changed再判定、state_level再判定、current_phase再判定、Compass再判定を担当しない。

【今回このファイルで修正したこと】
- 状態値だけを見て定形文を返す switch / 固定文生成をやめた。
- hopy_confirmed_payload の memory_candidates / reply / compass / dashboard_signals / state から、ユーザー側の状態変化サイン、HOPY側の支援、変化理由、未来ユーザーへのヒントを抽出する形へ全文置き換えした。
- bridge_summary の insight / hint / flow / reason も、from/to状態だけではなく payload 由来の意味情報を含めて生成するようにした。
- pattern_key を state だけの固定キーではなく、匿名化・抽象化された userSignal / hopySupport を含む安定hash付きキーに変更し、同じ状態遷移でも別の意味を持つ橋渡しを別候補として保存できるようにした。
- metadata に generation / evidence_sources / raw_log_saved=false を追加し、生ログではなくHOPY確定payload由来の意味抽出であることを明示した。
- futureChainDownwardCandidate.ts の定形文生成には依存しない形へ戻した。
- 保存前チェック、DB insert、DB制約、UI、HOPY回答○、Compass表示、MEMORIES、DASHBOARDには触れていない。

/app/api/chat/_lib/hopy/future-chain/futureChainCandidate.ts
*/