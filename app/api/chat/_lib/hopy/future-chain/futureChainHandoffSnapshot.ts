// /app/api/chat/_lib/hopy/future-chain/futureChainHandoffSnapshot.ts

export type FutureChainHandoffSnapshotReason =
  | "selected_direction_and_reason"
  | "selected_direction"
  | "selected_reason"
  | "selected_supportive_sentence"
  | "reply_empty"
  | "no_safe_sentence"
  | "snapshot_too_short";

export type FutureChainHandoffSnapshotResult = {
  snapshot: string | null;
  reason: FutureChainHandoffSnapshotReason;
};

export type BuildFutureChainHandoffSnapshotParams = {
  reply?: string | null;
  maxChars?: number;
};

const DEFAULT_MAX_SNAPSHOT_CHARS = 220;
const MIN_SNAPSHOT_CHARS = 18;

const URL_PATTERN = /https?:\/\/|www\./i;
const EMAIL_PATTERN = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i;
const PHONE_PATTERN = /(?:\+?\d[\d\s-]{8,}\d)/;
const LONG_NUMBER_PATTERN = /\d{10,}/;

const DIRECTION_PATTERNS: RegExp[] = [
  /HOPYとしては/,
  /まず/,
  /ここから/,
  /次に/,
  /おすすめします/,
  /してみてください/,
  /意識してみてください/,
  /挙げてみる/,
  /書き出/,
  /分けて/,
  /一つ/,
  /小さな一歩/,
  /手をつけ/,
  /進め/,
];

const REASON_PATTERNS: RegExp[] = [
  /からです/,
  /ためです/,
  /につなが/,
  /生まれやす/,
  /見えやす/,
  /整いやす/,
  /きっかけ/,
  /支え/,
  /材料/,
  /入口/,
];

const SUPPORTIVE_PATTERNS: RegExp[] = [
  /大事/,
  /自然/,
  /少しずつ/,
  /焦らず/,
  /今できる/,
  /見えてき/,
  /整ってい/,
  /動き始め/,
];

function normalizeText(value: unknown): string {
  if (typeof value !== "string") return "";

  return value
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{2,}/g, "\n")
    .trim();
}

function normalizeSentence(value: string): string {
  return value
    .replace(/\n+/g, " ")
    .replace(/[ \t]+/g, " ")
    .trim();
}

function clipSnapshot(value: string, maxChars: number): string {
  const text = normalizeSentence(value);
  if (text.length <= maxChars) return text;

  const clipped = text.slice(0, Math.max(maxChars - 1, 0)).trim();
  return clipped ? `${clipped}…` : "";
}

function hasAnyPattern(text: string, patterns: RegExp[]): boolean {
  return patterns.some((pattern) => pattern.test(text));
}

function isSafeSentence(text: string): boolean {
  const value = normalizeSentence(text);
  if (!value) return false;

  if (URL_PATTERN.test(value)) return false;
  if (EMAIL_PATTERN.test(value)) return false;
  if (PHONE_PATTERN.test(value)) return false;
  if (LONG_NUMBER_PATTERN.test(value)) return false;

  return true;
}

function splitSentences(reply: string): string[] {
  const normalized = normalizeText(reply);
  if (!normalized) return [];

  const sentences: string[] = [];
  let current = "";

  for (const char of normalized) {
    current += char;

    if (char === "。" || char === "！" || char === "？" || char === "!" || char === "?") {
      const sentence = normalizeSentence(current);
      if (sentence) sentences.push(sentence);
      current = "";
    }
  }

  const rest = normalizeSentence(current);
  if (rest) sentences.push(rest);

  return sentences.filter(isSafeSentence);
}

function findFirstIndex(
  sentences: string[],
  patterns: RegExp[],
): number {
  return sentences.findIndex((sentence) => hasAnyPattern(sentence, patterns));
}

function joinCandidate(sentences: string[], maxChars: number): string {
  const joined = normalizeSentence(sentences.join(""));
  return clipSnapshot(joined, maxChars);
}

export function buildFutureChainHandoffSnapshot({
  reply,
  maxChars = DEFAULT_MAX_SNAPSHOT_CHARS,
}: BuildFutureChainHandoffSnapshotParams): FutureChainHandoffSnapshotResult {
  const normalizedReply = normalizeText(reply);

  if (!normalizedReply) {
    return {
      snapshot: null,
      reason: "reply_empty",
    };
  }

  const sentences = splitSentences(normalizedReply);

  if (sentences.length <= 0) {
    return {
      snapshot: null,
      reason: "no_safe_sentence",
    };
  }

  const directionIndex = findFirstIndex(sentences, DIRECTION_PATTERNS);
  const reasonIndex =
    directionIndex >= 0
      ? sentences.findIndex((sentence, index) => {
          return index > directionIndex && hasAnyPattern(sentence, REASON_PATTERNS);
        })
      : findFirstIndex(sentences, REASON_PATTERNS);

  if (directionIndex >= 0 && reasonIndex >= 0) {
    const snapshot = joinCandidate(
      [sentences[directionIndex], sentences[reasonIndex]],
      maxChars,
    );

    return snapshot.length >= MIN_SNAPSHOT_CHARS
      ? {
          snapshot,
          reason: "selected_direction_and_reason",
        }
      : {
          snapshot: null,
          reason: "snapshot_too_short",
        };
  }

  if (directionIndex >= 0) {
    const snapshot = joinCandidate([sentences[directionIndex]], maxChars);

    return snapshot.length >= MIN_SNAPSHOT_CHARS
      ? {
          snapshot,
          reason: "selected_direction",
        }
      : {
          snapshot: null,
          reason: "snapshot_too_short",
        };
  }

  if (reasonIndex >= 0) {
    const snapshot = joinCandidate([sentences[reasonIndex]], maxChars);

    return snapshot.length >= MIN_SNAPSHOT_CHARS
      ? {
          snapshot,
          reason: "selected_reason",
        }
      : {
          snapshot: null,
          reason: "snapshot_too_short",
        };
  }

  const supportiveIndex = findFirstIndex(sentences, SUPPORTIVE_PATTERNS);

  if (supportiveIndex >= 0) {
    const snapshot = joinCandidate([sentences[supportiveIndex]], maxChars);

    return snapshot.length >= MIN_SNAPSHOT_CHARS
      ? {
          snapshot,
          reason: "selected_supportive_sentence",
        }
      : {
          snapshot: null,
          reason: "snapshot_too_short",
        };
  }

  return {
    snapshot: null,
    reason: "no_safe_sentence",
  };
}

/*
【このファイルの正式役割】
HOPY Future Chain v3.1 の handoff_message_snapshot 切り出しだけを担当する。
HOPY回答本文 reply から、未来へ渡せる1〜2文を選び、
handoff_message_snapshot 候補として返す。

このファイルは AI API 呼び出し、HOPY回答再要約、Compass再要約、
ユーザー発話読み取り、DB保存、Future Chain保存判定、state_changed再判定、
state_level再判定、current_phase再判定、Compass表示可否判定、
HOPY回答○判定、recipient_support検索、delivery_event保存、UI表示を担当しない。

【今回このファイルで修正したこと】
- 新規ファイルとして HOPY回答本文から handoff_message_snapshot を切り出す関数を作成しました。
- 方向文を優先し、続く理由文があれば1〜2文として結合する形にしました。
- 方向文がない場合は理由文、それもない場合は支えになりそうな文を候補にする形にしました。
- URL、メール、長い電話番号風文字列、長い数字列を含む文は保存候補から外す最小安全チェックを入れました。
- テンプレート文生成、AI再要約、Compass本文読み取り、ユーザー発話読み取りは入れていません。

/app/api/chat/_lib/hopy/future-chain/futureChainHandoffSnapshot.ts
*/