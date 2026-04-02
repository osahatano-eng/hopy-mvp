"use client";

import React from "react";
import styles from "./LangToggle.module.css";

type Lang = "en" | "ja";

const LangToggle = ({ lang, setLang }: { lang: Lang; setLang: (v: Lang) => void }) => {
  return (
    <div className={styles.wrap} aria-label="Language toggle">
      <button
        type="button"
        onClick={() => setLang("en")}
        className={`${styles.btn} ${lang === "en" ? styles.on : ""}`}
        aria-pressed={lang === "en"}
      >
        EN
      </button>

      <div className={styles.sep} aria-hidden="true" />

      <button
        type="button"
        onClick={() => setLang("ja")}
        className={`${styles.btn} ${lang === "ja" ? styles.on : ""}`}
        aria-pressed={lang === "ja"}
      >
        JP
      </button>
    </div>
  );
};

export default React.memo(LangToggle);
