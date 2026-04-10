// /components/chat/lib/useChatClientLanguage.ts
"use client";

import { useCallback, useEffect, useState } from "react";
import { readInitialUiLang } from "./chatClientUi";

export type ChatClientUiLang = "ja" | "en";

type UseChatClientLanguageReturn = {
  uiLang: ChatClientUiLang;
  onChangeLang: (next: ChatClientUiLang) => void;
};

export function useChatClientLanguage(): UseChatClientLanguageReturn {
  const [uiLang, setUiLang] = useState<ChatClientUiLang>(() => readInitialUiLang());

  useEffect(() => {
    try {
      const saved = String(localStorage.getItem("hopy_lang") || "").toLowerCase();
      const next: ChatClientUiLang = saved === "en" ? "en" : "ja";
      setUiLang((prev) => (prev === next ? prev : next));
    } catch {}
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem("hopy_lang", uiLang);
    } catch {}
  }, [uiLang]);

  const onChangeLang = useCallback((next: ChatClientUiLang) => {
    const safeNext: ChatClientUiLang = next === "en" ? "en" : "ja";
    setUiLang((prev) => (prev === safeNext ? prev : safeNext));

    try {
      window.dispatchEvent(
        new CustomEvent("hopy:lang-change", {
          detail: { lang: safeNext },
        }),
      );
    } catch {}
  }, []);

  return {
    uiLang,
    onChangeLang,
  };
}

/*
このファイルの正式役割
ChatClient の中に残っていた、
UI言語の初期化・localStorage読込保存・言語変更イベント発火の責務だけを受け持つ。
親ファイルはこの hook を呼び、uiLang と onChangeLang を受け取るだけに寄せる。
*/

/*
【今回このファイルで修正したこと】
1. ChatClient.tsx 内にあった UI言語 state 初期化を、この hook へ切り出しました。
2. localStorage からの言語読込、localStorage への保存、hopy:lang-change イベント発火をこのファイルへ集約しました。
3. HOPY回答○、Compass、confirmed payload、DB保存・復元の唯一の正には触っていません。
*/