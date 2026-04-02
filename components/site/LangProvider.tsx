// /components/site/LangProvider.tsx
"use client";

import React, { createContext, useContext, useEffect, useMemo, useState } from "react";

/**
 * ✅ 追加したい言語はここに足すだけでOK
 * - key: ルーティングや保存に使う短いコード
 * - label: UI表示（世界基準はネイティブ表記 + 英語補助が良い）
 */
export const LANGS = [
  { key: "en", label: "English" },
  { key: "ja", label: "日本語" },
  { key: "ko", label: "한국어" },
  { key: "zh", label: "中文" },
  { key: "es", label: "Español" },
] as const;

export type Lang = (typeof LANGS)[number]["key"];

/**
 * UI上の最小2言語（翻訳キー追加を避けつつ、将来言語が増えても破綻しない）
 * - EN-first: ja 以外は en として扱う
 */
export type UiLang2 = "en" | "ja";

type Ctx = {
  lang: Lang;
  uiLang2: UiLang2;

  /**
   * ✅ 翻訳が存在する言語のみ true
   * - 「選べるのに中身が英語」問題を防ぎ、判断を増やさない
   */
  enabledLangs: Record<Lang, boolean>;

  setLang: (l: Lang) => void;
  t: (key: string) => string;
};

const LangContext = createContext<Ctx | null>(null);

const DICT: Record<Lang, Record<string, string>> = {
  en: {
    brand: "HOPY",
    hero_title: "The infrastructure for thinking.",
    // ✅ Hero: mobileで割れにくい“2拍”へ（意味は維持）
    hero_sub: "Organize thought. Stabilize decisions.",
    cta_primary: "Start",
    cta_secondary: "See Demo",
    sec1_title: "What it is",
    sec1_body: "A private space to think, decide, and grow. Minimal UI, high signal—across PC, tablet, and mobile.",
    sec2_title: "For individuals",
    sec2_a: "Reflection & journaling",
    sec2_b: "Decision support",
    sec2_c: "Emotional stability",
    sec3_title: "Global-ready",
    sec3_a: "EN-first, JP supported",
    sec3_b: "Fast, responsive UI",
    sec3_c: "Designed for trust",
    footer_note: "© HOPY. All rights reserved.",
    nav_product: "Product",
    nav_pricing: "Pricing",
    nav_signin: "Sign in",
    nav_open: "Open app",
    lang_en: "EN",
    lang_ja: "JP",
  },

  ja: {
    brand: "HOPY",
    hero_title: "思考のインフラである。",
    // ✅ Hero: 句読点で“意味のまとまり”を固定（短く、読みやすく）
    hero_sub: "思考を整え、意思決定の安定性を高める。",
    cta_primary: "はじめる",
    cta_secondary: "デモを見る",
    sec1_title: "これは何？",
    sec1_body: "考える・決める・進むためのプライベート空間。ミニマルUIで高密度、PC/タブレット/スマホ対応。",
    sec2_title: "個人のために",
    sec2_a: "自己理解・記録",
    sec2_b: "意思決定の補助",
    sec2_c: "心の安定",
    sec3_title: "グローバル対応",
    sec3_a: "英語メイン＋日本語",
    sec3_b: "高速レスポンシブUI",
    sec3_c: "信頼される設計",
    footer_note: "© HOPY. All rights reserved.",
    nav_product: "プロダクト",
    nav_pricing: "料金",
    nav_signin: "ログイン",
    nav_open: "アプリを開く",
    lang_en: "EN",
    lang_ja: "JP",
  },

  ko: {},
  zh: {},
  es: {},
};

const DEFAULT_LANG: Lang = "en";

function isLang(x: any): x is Lang {
  return typeof x === "string" && (LANGS as readonly any[]).some((l) => l.key === x);
}

function safeLang(x: any): Lang {
  return isLang(x) ? x : DEFAULT_LANG;
}

function readSavedLangFromLocalStorage(): Lang | null {
  try {
    if (typeof window === "undefined") return null;
    const saved = window.localStorage.getItem("hopy_lang");
    return saved ? safeLang(saved) : null;
  } catch {
    return null;
  }
}

function toUiLang2(lang: Lang): UiLang2 {
  return lang === "ja" ? "ja" : "en";
}

function hasAnyTranslationTable(lang: Lang): boolean {
  const table = DICT[lang] ?? {};
  return Object.keys(table).length > 0;
}

export function LangProvider({ children }: { children: React.ReactNode }) {
  /**
   * ✅ SSR/CSR の初回レンダリングを必ず一致させる（Hydration事故回避）
   * - 初期値は DEFAULT_LANG に固定
   * - 保存言語は mount 後に反映
   */
  const [lang, setLangState] = useState<Lang>(DEFAULT_LANG);

  useEffect(() => {
    const saved = readSavedLangFromLocalStorage();
    if (saved && saved !== lang) setLangState(saved);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const enabledLangs = useMemo<Record<Lang, boolean>>(() => {
    // en は常に true。ja は現在 true。ko/zh/es は辞書が空なら false。
    const out = {} as Record<Lang, boolean>;
    for (const l of LANGS) {
      out[l.key] = l.key === "en" ? true : hasAnyTranslationTable(l.key);
    }
    return out;
  }, []);

  const setLang = (l: Lang) => {
    const nextRaw = safeLang(l);
    const next = enabledLangs[nextRaw] ? nextRaw : DEFAULT_LANG;

    setLangState(next);
    try {
      window.localStorage.setItem("hopy_lang", next);
    } catch {}
  };

  const value = useMemo<Ctx>(() => {
    const uiLang2 = toUiLang2(lang);

    // ✅ 辞書が空の言語は、明示的に en を使う（フォールバックを最短に）
    const table = enabledLangs[lang] ? (DICT[lang] ?? {}) : (DICT.en ?? {});
    const en = DICT.en ?? {};

    return {
      lang,
      uiLang2,
      enabledLangs,
      setLang,
      t: (key: string) => {
        return table[key] ?? en[key] ?? key;
      },
    };
  }, [lang, enabledLangs]);

  return <LangContext.Provider value={value}>{children}</LangContext.Provider>;
}

export function useLang() {
  const ctx = useContext(LangContext);
  if (!ctx) throw new Error("useLang must be used within LangProvider");
  return ctx;
}