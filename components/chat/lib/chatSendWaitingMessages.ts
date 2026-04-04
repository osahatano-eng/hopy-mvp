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
1. 入力文の正規化を強化し、NFKC正規化・句読点除去・空白圧縮を追加しました。
2. 判定語彙を増やし、「ねえねえ、ホピー元気？」「ちょっと疲れた」「どうしたらいいかわからない」のような実入力を拾いやすくしました。
3. 判定順を tired / anxious / unsure / bright / friendly / chat に整理し、より意味の強いカテゴリを先に返すようにしました。
4. 末尾に最小限の救済判定を追加し、代表例が fallback に落ちにくいようにしました。
*/