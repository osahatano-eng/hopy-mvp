// /components/chat/lib/chatAppUi.ts

export type ChatAppLang = "en" | "ja";

export type ChatAppUi = {
  title: string;
  start: string;
  login: string;
  logout: string;
  clearCache: string;
  placeholder: string;
  sending: string;
  loggedInAs: string;
  hint1: string;
  hint2: string;
  enterHint: string;
  jumpAria: string;
  micro: string;
  dayStart: string;
};

export function getChatAppUi(uiLang: ChatAppLang): ChatAppUi {
  const isEn = uiLang === "en";

  return {
    title: "HOPY AI",
    start: isEn ? "Start" : "はじめる",
    login: isEn ? "Continue with Google" : "Googleで続行",
    logout: isEn ? "Logout" : "ログアウト",
    clearCache: isEn ? "Clear cache" : "キャッシュ削除",
    placeholder: isEn ? "Ask HOPY…" : "HOPYに相談する…",
    sending: isEn ? "Thinking" : "考えています",
    loggedInAs: isEn ? "Logged in" : "Logged in",
    hint1: isEn ? "A quiet companion for clear thinking." : "思考を澄ませる、静かな伴走者。",
    hint2: isEn
      ? "Your words stay yours. You control memory."
      : "あなたの言葉はあなたのもの。記憶はあなたが制御する。",
    enterHint: isEn
      ? "Enter to send · Shift+Enter for a new line"
      : "Enterで送信・Shift+Enterで改行",
    jumpAria: isEn ? "Jump to latest" : "最新へ移動",
    micro: isEn ? "No clutter. Just thinking." : "余計なものを置かない。思考だけ。",
    dayStart: isEn ? "New day" : "新しい日",
  };
}