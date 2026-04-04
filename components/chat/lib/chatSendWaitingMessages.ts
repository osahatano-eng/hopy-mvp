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
    "HOPYが受け取っています...",
    "HOPYが整えています...",
  ],
  bright: [
    "HOPYが見つめています...",
    "HOPYが整えています...",
  ],
  tired: [
    "HOPYが受け止めています...",
    "HOPYが整えています...",
  ],
  anxious: [
    "HOPYが見つめています...",
    "HOPYが整理しています...",
  ],
  unsure: [
    "HOPYが整理しています...",
    "HOPYが整えています...",
  ],
  chat: [
    "HOPYが受け取っています...",
    "HOPYが整えています...",
  ],
  fallback: [
    "HOPYが考えています...",
    "HOPYが整えています...",
  ],
};

const EN_WAITING_MESSAGE_SETS: Record<WaitingCategory, string[]> = {
  friendly: [
    "HOPY is receiving...",
    "HOPY is shaping...",
  ],
  bright: [
    "HOPY is noticing...",
    "HOPY is shaping...",
  ],
  tired: [
    "HOPY is holding this gently...",
    "HOPY is shaping...",
  ],
  anxious: [
    "HOPY is noticing...",
    "HOPY is organizing...",
  ],
  unsure: [
    "HOPY is organizing...",
    "HOPY is shaping...",
  ],
  chat: [
    "HOPY is receiving...",
    "HOPY is shaping...",
  ],
  fallback: [
    "HOPY is thinking...",
    "HOPY is shaping...",
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
1. 日本語・英語の待機文を全体的に短文化し、読む負荷を下げました。
2. 各カテゴリの文言数を 3 個から 2 個へ減らし、○アニメーションを主役にしやすくしました。
3. 意味は残しつつ、「受け取る・見つめる・整理する・整える・考える」の短い動詞中心にそろえました。
4. 分類ロジック、切替間隔、fallback の構造には触れていません。
*/

/*
/components/chat/lib/chatSendWaitingMessages.ts
*/