"use client";

import React from "react";
import styles from "./Rail.module.css";
import LangToggle from "./LangToggle";
import ThreadPicker from "./ThreadPicker";

type Lang = "en" | "ja";

type Thread = {
  id: string;
  title: string;
  updated_at?: string;
};

const Rail = ({
  railHidden,
  loggedIn,
  uiLang,
  setUiLang,
  login,
  logout,

  // 表示文言
  title,
  startLabel,
  logoutLabel,

  // スレッド
  threads,
  activeThreadId,
  onCreateThread,
  onSelectThread,
  busy,
}: {
  railHidden: boolean;
  loggedIn: boolean;
  uiLang: Lang;
  setUiLang: (v: Lang) => void;
  login: () => Promise<void>;
  logout: () => Promise<void>;

  title: string;
  startLabel: string;
  logoutLabel: string;

  threads: Thread[];
  activeThreadId: string | null;
  onCreateThread: () => void;
  onSelectThread: (id: string) => void;
  busy: boolean;
}) => {
  return (
    <div className={`${styles.rail} ${railHidden ? styles.railHide : ""}`}>
      <div className={styles.brand} aria-label="brand">
        <span className={styles.brandDot} aria-hidden="true" />
        {title}
      </div>

      <div className={styles.railRight}>
        {loggedIn ? (
          <ThreadPicker
            threads={threads}
            activeId={activeThreadId}
            onCreate={onCreateThread}
            onSelect={onSelectThread}
            busy={busy}
            uiLang={uiLang}
          />
        ) : null}

        <LangToggle lang={uiLang} setLang={setUiLang} />

        {loggedIn ? (
          <button
            className={styles.railBtn}
            onClick={logout}
            disabled={busy}
            aria-disabled={busy}
          >
            {logoutLabel}
          </button>
        ) : (
          <button className={styles.railBtn} onClick={login}>
            {startLabel}
          </button>
        )}
      </div>
    </div>
  );
};

export default React.memo(Rail);
