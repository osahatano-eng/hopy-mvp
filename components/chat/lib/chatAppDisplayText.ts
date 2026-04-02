// /components/chat/lib/chatAppDisplayText.ts

export type ChatAppLang = "en" | "ja";

export type ChatAppMessage = {
  content: string;
  lang: ChatAppLang;
};

export function getChatAppDisplayText(args: {
  message: ChatAppMessage;
  uiLang: ChatAppLang;
  tmap: Record<string, string>;
}) {
  const { message, uiLang, tmap } = args;

  const s = (message.content ?? "").trim();
  if (message.lang === uiLang) return s;

  const key = `${uiLang}::${s}`;
  const translated = tmap[key];
  return translated && translated.length > 0 ? translated : s;
}