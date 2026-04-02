"use client";

export type Lang = "en" | "ja";

export default function LangToggle({
  lang,
  onChange,
}: {
  lang: Lang;
  onChange: (lang: Lang) => void;
}) {
  return (
    <div className="lang-toggle" role="group" aria-label="Language">
      <button
        className={lang === "en" ? "lang-btn is-active" : "lang-btn"}
        type="button"
        onClick={() => onChange("en")}
        aria-pressed={lang === "en"}
      >
        EN
      </button>
      <span className="lang-sep" aria-hidden>
        /
      </span>
      <button
        className={lang === "ja" ? "lang-btn is-active" : "lang-btn"}
        type="button"
        onClick={() => onChange("ja")}
        aria-pressed={lang === "ja"}
      >
        JP
      </button>
    </div>
  );
}
