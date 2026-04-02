// /app/api/chat/_lib/route/promptLanguageUtils.ts
import type { Lang } from "../router/simpleRouter";

const SHORT_LOW_SIGNAL_ENGLISH = new Set([
  "yes",
  "yeah",
  "yep",
  "ok",
  "okay",
  "sure",
  "no",
  "nope",
  "thanks",
  "thank you",
  "got it",
  "cool",
  "fine",
  "maybe",
  "hi",
  "hello",
]);

function normalizeInputText(text: string): string {
  return String(text ?? "").trim().toLowerCase();
}

export function detectExplicitReplyLanguageRequest(text: string): Lang | null {
  const s = normalizeInputText(text);
  if (!s) return null;

  const wantsEnglish =
    /\b(in english|english please|reply in english|answer in english|speak english)\b/i.test(
      s,
    ) || /英語で(答えて|お願い|話して|返して)/.test(s);

  const wantsJapanese =
    /\b(in japanese|japanese please|reply in japanese|answer in japanese|speak japanese)\b/i.test(
      s,
    ) || /日本語で(答えて|お願い|話して|返して)/.test(s);

  if (wantsEnglish) return "en";
  if (wantsJapanese) return "ja";
  return null;
}

export function isShortLowSignalEnglish(text: string): boolean {
  const s = normalizeInputText(text);
  if (!s) return false;
  if (s.length > 24) return false;

  return SHORT_LOW_SIGNAL_ENGLISH.has(s);
}

export function decideReplyLanguage(args: {
  uiLang: Lang;
  userText: string;
  routedLang?: Lang | null;
}): Lang {
  const explicit = detectExplicitReplyLanguageRequest(args.userText);
  if (explicit) return explicit;
  return args.uiLang;
}