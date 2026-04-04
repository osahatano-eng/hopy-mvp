// /components/chat/lib/chatSendWaitingMessages.ts
import type { Lang } from "./chatTypes";

export const WAITING_MESSAGE_INTERVAL_MS = 5000;

type WaitingCategory =
  | "friendly"
  | "bright"
  | "tired"
  | "anxious"
  | "unsure"
  | "chat"
  | "fallback";

const JA_WAITING_MESSAGE_SETS: Record<WaitingCategory, string[]> = {
  friendly: [
    "HOPYが声をかけてくれて、うれしい気持ちを受け取っています...",
    "HOPYがこのやさしい流れを受け取っています...",
    "HOPYがあなたに返す言葉を整えています...",
  ],
  bright: [
    "HOPYがその明るい流れをうれしく受け取っています...",
    "HOPYがいまの心地よさを静かに見つめています...",
    "HOPYがこの空気に合う言葉を整えています...",
  ],
  tired: [
    "HOPYがその疲れをちゃんと受け取っています...",
    "HOPYがいまの重さを静かに見つめています...",
    "HOPYがやさしく返せる形に整えています...",
  ],
  anxious: [
    "HOPYが揺れる気持ちをちゃんと受け取っています...",
    "HOPYがいまの不安の流れを静かに見つめています...",
    "HOPYが少し進みやすくなる言葉を整えています...",
  ],
  unsure: [
    "HOPYが迷っている気持ちを受け止めています...",
    "HOPYがいまの揺れをゆっくり整理しています...",
    "HOPYが次につながる言葉を整えています...",
  ],
  chat: [
    "HOPYがこうして来てくれたことをうれしく受け取っています...",
    "HOPYがいまの自然な流れを見つめています...",
    "HOPYがあなたに返す言葉を整えています...",
  ],
  fallback: [
    "HOPYがその気持ちをちゃんと受け取っています...",
    "HOPYがいまの流れを静かに見つめています...",
    "HOPYがあなたに合う言葉を整えています...",
  ],
};

const EN_WAITING_MESSAGE_SETS: Record<WaitingCategory, string[]> = {
  friendly: [
    "HOPY is glad you reached out...",
    "HOPY is receiving the warmth in this moment...",
    "HOPY is shaping words to return to you...",
  ],
  bright: [
    "HOPY is warmly receiving this bright flow...",
    "HOPY is quietly noticing the ease in this moment...",
    "HOPY is shaping words that fit this atmosphere...",
  ],
  tired: [
    "HOPY is gently receiving that tiredness...",
    "HOPY is quietly noticing the weight of this moment...",
    "HOPY is shaping a response with softness...",
  ],
  anxious: [
    "HOPY is receiving the uncertainty in your feelings...",
    "HOPY is quietly looking at the flow of that anxiety...",
    "HOPY is shaping words that help you move a little more easily...",
  ],
  unsure: [
    "HOPY is receiving the feeling of not being sure yet...",
    "HOPY is slowly organizing the sway in this moment...",
    "HOPY is shaping words that connect to your next step...",
  ],
  chat: [
    "HOPY is glad you came by like this...",
    "HOPY is quietly noticing the natural flow here...",
    "HOPY is shaping words to return to you...",
  ],
  fallback: [
    "HOPY is receiving your feelings carefully...",
    "HOPY is quietly noticing the flow of this moment...",
    "HOPY is shaping words that fit you...",
  ],
};

function normalizeWaitingInputText(text: string | null | undefined): string {
  return String(text ?? "")
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[！？!?、。,.…]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function includesAny(text: string, patterns: readonly string[]): boolean {
  return patterns.some((pattern) => text.includes(normalizeWaitingInputText(pattern)));
}

const FRIENDLY_PATTERNS = [
  "元気",
  "おはよう",
  "こんばんは",
  "こんにちは",
  "来たよ",
  "きたよ",
  "ねえ",
  "やっほ",
  "話しかけ",
  "hello",
  "hi",
  "hey",
  "good morning",
  "good evening",
] as const;

const BRIGHT_PATTERNS = [
  "調子よさそう",
  "調子がよさそう",
  "いい感じ",
  "元気そう",
  "うれしい",
  "楽しい",
  "最高",
  "よさそう",
  "good",
  "great",
  "nice",
  "happy",
  "excited",
] as const;

const TIRED_PATTERNS = [
  "疲れ",
  "疲れた",
  "つかれ",
  "つかれた",
  "しんど",
  "へとへと",
  "眠い",
  "だるい",
  "tired",
  "exhausted",
  "sleepy",
  "drained",
] as const;

const ANXIOUS_PATTERNS = [
  "不安",
  "心配",
  "大丈夫かな",
  "こわい",
  "怖い",
  "うまくいくかわからない",
  "うまくいくか分からない",
  "anxious",
  "anxiety",
  "worried",
  "scared",
  "afraid",
] as const;

const UNSURE_PATTERNS = [
  "どうしたらいい",
  "わからない",
  "分からない",
  "迷",
  "決められない",
  "どっち",
  "not sure",
  "unsure",
  "can't decide",
  "cannot decide",
  "don’t know",
  "don't know",
] as const;

const CHAT_PATTERNS = [
  "話そ",
  "話そう",
  "なんとなく",
  "きた",
  "来た",
  "今日なにしてた",
  "雑談",
  "chat",
  "talk",
  "just came by",
  "random",
] as const;

function classifyWaitingCategory(inputText: string | null | undefined): WaitingCategory {
  const normalized = normalizeWaitingInputText(inputText);

  if (!normalized) return "fallback";

  if (includesAny(normalized, TIRED_PATTERNS)) {
    return "tired";
  }

  if (includesAny(normalized, ANXIOUS_PATTERNS)) {
    return "anxious";
  }

  if (includesAny(normalized, UNSURE_PATTERNS)) {
    return "unsure";
  }

  if (includesAny(normalized, BRIGHT_PATTERNS)) {
    return "bright";
  }

  if (includesAny(normalized, FRIENDLY_PATTERNS)) {
    return "friendly";
  }

  if (includesAny(normalized, CHAT_PATTERNS)) {
    return "chat";
  }

  if (
    normalized.includes("元気") ||
    normalized.includes("疲れた") ||
    normalized.includes("どうしたらいい") ||
    normalized.includes("わからない")
  ) {
    if (normalized.includes("疲れた")) return "tired";
    if (normalized.includes("どうしたらいい") || normalized.includes("わからない")) {
      return "unsure";
    }
    return "friendly";
  }

  return "fallback";
}

function getWaitingMessageSets(lang: Lang): Record<WaitingCategory, string[]> {
  return lang === "en" ? EN_WAITING_MESSAGE_SETS : JA_WAITING_MESSAGE_SETS;
}

export function getWaitingMessages(lang: Lang, inputText?: string | null): string[] {
  const category = classifyWaitingCategory(inputText);
  const messageSets = getWaitingMessageSets(lang);
  return messageSets[category] ?? messageSets.fallback;
}

export function resolveWaitingMessage(
  lang: Lang,
  elapsedMs: number,
  inputText?: string | null,
): string {
  const messages = getWaitingMessages(lang, inputText);

  if (!messages.length) {
    return lang === "en" ? "HOPY is thinking..." : "HOPYが考えています...";
  }

  const step = Math.max(0, Math.floor(elapsedMs / WAITING_MESSAGE_INTERVAL_MS));
  return messages[step % messages.length] ?? messages[0];
}

/*
このファイルの正式役割
送信中の待機文言を解決する専用ファイル。
日本語/英語の待機文定義、入力文の簡易カテゴリ判定、経過時間に応じてどの文言を出すかの決定だけを担当する。
状態の唯一の正は作らず、待機文表示のための文言決定だけに限定する。
*/

/*
【今回このファイルで修正したこと】
1. すべての待機文に「HOPYが...」「HOPY is ...」の共通形を付けて、通常本文と見分けやすくしました。
2. 末尾を「...」に統一して、待機中の文だと分かる見え方に寄せました。
3. fallback 既定文も同じ待機表現にそろえました。
4. 文言決定責務だけに留めて、状態判定や MessageRow 側の表示構造には触れていません。
*/

/*
/components/chat/lib/chatSendWaitingMessages.ts
*/