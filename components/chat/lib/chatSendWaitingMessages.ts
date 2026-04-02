// /components/chat/lib/chatSendWaitingMessages.ts
import type { Lang } from "./chatTypes";

export const WAITING_MESSAGE_INTERVAL_MS = 3000;

const JA_WAITING_MESSAGES = [
  "HOPYがこころを整えています…",
  "HOPYが深呼吸しています…",
  "HOPYが前髪を整えています…",
  "HOPYがトイレに行っています…",
  "HOPYが歯を磨いています…",
  "HOPYが机の上をそっと片づけています…",
  "HOPYが言葉をやさしく並べています…",
  "HOPYがコンパスをくるっと確かめています…",
  "HOPYがちょっと遠くを見ています…",
  "HOPYが「それだ」と言う準備をしています…",
  "HOPYがいい感じの一言を探しています…",
  "HOPYが気まずくない沈黙を保っています…",
];

const EN_WAITING_MESSAGES = [
  "HOPY is centering its thoughts…",
  "HOPY is taking a deep breath…",
  "HOPY is fixing its bangs…",
  "HOPY stepped away for a bathroom break…",
  "HOPY is brushing its teeth…",
  "HOPY is quietly tidying the desk…",
  "HOPY is arranging gentle words…",
  "HOPY is checking the compass one more time…",
  "HOPY is gazing into the distance for a second…",
  "HOPY is preparing a “that’s it” moment…",
  "HOPY is looking for the right line…",
  "HOPY is maintaining a surprisingly graceful silence…",
];

export function getWaitingMessages(lang: Lang): string[] {
  return lang === "en" ? EN_WAITING_MESSAGES : JA_WAITING_MESSAGES;
}

export function resolveWaitingMessage(lang: Lang, elapsedMs: number): string {
  const messages = getWaitingMessages(lang);

  if (!messages.length) {
    return lang === "en" ? "Thinking…" : "考えています…";
  }

  const step = Math.max(0, Math.floor(elapsedMs / WAITING_MESSAGE_INTERVAL_MS));
  return messages[step % messages.length] ?? messages[0];
}

/*
このファイルの正式役割
送信中の待機文言を解決する専用ファイル。
日本語/英語の待機文言定義と、経過時間に応じてどの文言を出すかの決定だけを担当する。

【今回このファイルで修正したこと】
- useChatSend.ts 内にあった待機文言定義をこのファイルへ分離しました。
- 日本語/英語の待機文言配列をこのファイルへ移しました。
- 経過時間から待機文言を決める resolveWaitingMessage をこのファイルへ移しました。
*/