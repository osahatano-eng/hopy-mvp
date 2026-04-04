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
    "声をかけてくれて、うれしいです。",
    "このやさしい流れを受け取っています。",
    "あなたに返す言葉を整えています。",
  ],
  bright: [
    "その明るい流れをうれしく受け取っています。",
    "いまの心地よさを静かに見つめています。",
    "この空気に合う言葉を整えています。",
  ],
  tired: [
    "その疲れ、ちゃんと受け取っています。",
    "いまの重さを静かに見つめています。",
    "やさしく返せる形に整えています。",
  ],
  anxious: [
    "揺れる気持ちを、ちゃんと受け取っています。",
    "いまの不安の流れを静かに見つめています。",
    "少し進みやすくなる言葉を整えています。",
  ],
  unsure: [
    "迷っている気持ちを受け止めています。",
    "いまの揺れをゆっくり整理しています。",
    "次につながる言葉を整えています。",
  ],
  chat: [
    "こうして来てくれたことを、うれしく受け取っています。",
    "いまの自然な流れを見つめています。",
    "あなたに返す言葉を整えています。",
  ],
  fallback: [
    "その気持ちを、ちゃんと受け取っています。",
    "いまの流れを静かに見つめています。",
    "あなたに合う言葉を整えています。",
  ],
};

const EN_WAITING_MESSAGE_SETS: Record<WaitingCategory, string[]> = {
  friendly: [
    "I’m glad you reached out.",
    "I’m receiving the warmth in this moment.",
    "I’m shaping words to return to you.",
  ],
  bright: [
    "I’m warmly receiving this bright flow.",
    "I’m quietly noticing the ease in this moment.",
    "I’m shaping words that fit this atmosphere.",
  ],
  tired: [
    "I’m gently receiving that tiredness.",
    "I’m quietly noticing the weight of this moment.",
    "I’m shaping a response with softness.",
  ],
  anxious: [
    "I’m receiving the uncertainty in your feelings.",
    "I’m quietly looking at the flow of that anxiety.",
    "I’m shaping words that help you move a little more easily.",
  ],
  unsure: [
    "I’m receiving the feeling of not being sure yet.",
    "I’m slowly organizing the sway in this moment.",
    "I’m shaping words that connect to your next step.",
  ],
  chat: [
    "I’m glad you came by like this.",
    "I’m quietly noticing the natural flow here.",
    "I’m shaping words to return to you.",
  ],
  fallback: [
    "I’m receiving your feelings carefully.",
    "I’m quietly noticing the flow of this moment.",
    "I’m shaping words that fit you.",
  ],
};

function normalizeWaitingInputText(text: string | null | undefined): string {
  return String(text ?? "").trim().toLowerCase();
}

function includesAny(text: string, patterns: string[]): boolean {
  return patterns.some((pattern) => text.includes(pattern));
}

function classifyWaitingCategory(inputText: string | null | undefined): WaitingCategory {
  const normalized = normalizeWaitingInputText(inputText);

  if (!normalized) return "fallback";

  if (
    includesAny(normalized, [
      "元気",
      "おはよう",
      "こんばんは",
      "こんにちは",
      "来たよ",
      "ねえ",
      "やっほ",
      "hello",
      "hi",
      "hey",
      "good morning",
      "good evening",
    ])
  ) {
    return "friendly";
  }

  if (
    includesAny(normalized, [
      "調子よさそう",
      "いい感じ",
      "元気そう",
      "うれしい",
      "楽しい",
      "最高",
      "good",
      "great",
      "nice",
      "happy",
      "excited",
    ])
  ) {
    return "bright";
  }

  if (
    includesAny(normalized, [
      "疲れ",
      "つかれ",
      "しんど",
      "へとへと",
      "眠い",
      "だるい",
      "tired",
      "exhausted",
      "sleepy",
      "drained",
    ])
  ) {
    return "tired";
  }

  if (
    includesAny(normalized, [
      "不安",
      "心配",
      "大丈夫かな",
      "こわい",
      "怖い",
      "うまくいくかわからない",
      "anxious",
      "anxiety",
      "worried",
      "scared",
      "afraid",
    ])
  ) {
    return "anxious";
  }

  if (
    includesAny(normalized, [
      "どうしたらいい",
      "わからない",
      "分からない",
      "迷",
      "決められない",
      "どっち",
      "which",
      "not sure",
      "unsure",
      "can't decide",
      "cannot decide",
      "don’t know",
      "don't know",
    ])
  ) {
    return "unsure";
  }

  if (
    includesAny(normalized, [
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
    ])
  ) {
    return "chat";
  }

  return "fallback";
}

function getWaitingMessageSets(lang: Lang): Record<WaitingCategory, string[]> {
  return lang === "en" ? EN_WAITING_MESSAGE_SETS : JA_WAITING_MESSAGE_SETS;
}

export function getWaitingMessages(
  lang: Lang,
  inputText?: string | null,
): string[] {
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
    return lang === "en" ? "Thinking…" : "考えています…";
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
1. 待機文の切替間隔を 3000ms から 5000ms に変更しました。
2. 「前髪」「トイレ」など HOPYらしくない待機文を削除し、受容→整理→返答準備の3文へ置き換えました。
3. 入力文に応じて friendly / bright / tired / anxious / unsure / chat / fallback に振り分ける簡易判定を追加しました。
4. 既存呼び出しを壊しにくいように、inputText は optional のまま追加しました。
5. まだ呼び出し側が inputText を渡していない場合でも、fallback の待機文で安全に動くようにしています。
*/