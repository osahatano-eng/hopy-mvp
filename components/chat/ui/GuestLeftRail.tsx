// /components/chat/ui/GuestLeftRail.tsx
"use client";

import React from "react";
import styles from "./LeftRail.module.css";

type Lang = "ja" | "en";

type GuestLeftRailCopy = {
  title: string;
  subtitle: string;
  introTitle: string;
  introBody: string;
  loginTitle: string;
  loginBody: string;
};

type Props = {
  uiLang?: Lang;
  className?: string;
};

const COPY: Record<Lang, GuestLeftRailCopy> = {
  ja: {
    title: "HOPY",
    subtitle: "はじめての方へ",

    introTitle: "まずはそのまま話せます",
    introBody:
      "未ログインのまま、HOPYとの会話を始められます。うまくまとまっていなくても、そのままの言葉で大丈夫です。",

    loginTitle: "ログイン後について",
    loginBody:
      "ログイン後は新しいチャットから始まります。未ログイン中の会話は保存されません。",
  },
  en: {
    title: "HOPY",
    subtitle: "For first-time visitors",

    introTitle: "You can start talking right away",
    introBody:
      "You can begin talking with HOPY without logging in. Even if your thoughts are not fully formed, you can speak just as you are.",

    loginTitle: "After logging in",
    loginBody:
      "After logging in, you will start from a new chat. Conversations while logged out are not saved.",
  },
};

function safeLang(value: unknown): Lang {
  return value === "ja" ? "ja" : "en";
}

export default function GuestLeftRail({ uiLang = "ja", className }: Props) {
  const lang = safeLang(uiLang);
  const copy = COPY[lang];

  const sections = [
    { title: copy.introTitle, body: copy.introBody },
    { title: copy.loginTitle, body: copy.loginBody },
  ];

  const rootClassName = [styles.leftRail, className].filter(Boolean).join(" ");

  return (
    <aside
      className={rootClassName}
      aria-label={copy.title}
      data-guest-rail="true"
      style={{ height: "100%", minHeight: 0, overflow: "hidden" }}
    >
      <div className={styles.leftRailInner}>
        <header className={styles.brandBlock}>
          <div className={styles.brandMark} aria-hidden="true">
            H
          </div>
          <div className={styles.brandTexts}>
            <div className={styles.brandTitle}>{copy.title}</div>
            <div className={styles.brandSubtle}>{copy.subtitle}</div>
          </div>
        </header>

        <nav className={styles.menu} aria-label={copy.title}>
          {sections.map((section) => (
            <section className={styles.menuSection} key={section.title}>
              <h2 className={styles.menuLabel}>{section.title}</h2>
              <p className={styles.empty}>{section.body}</p>
            </section>
          ))}
        </nav>
      </div>
    </aside>
  );
}