// /components/chat/ui/ChatMenu.tsx
"use client";

import React from "react";
import styles from "./ChatMenu.module.css";

type MenuItem =
  | { kind: "button"; key: string; label: string; onClick: () => void; danger?: boolean }
  | { kind: "divider"; key: string };

function getInitial(email: string) {
  const s = String(email ?? "").trim();
  if (!s) return "U";
  return s[0].toUpperCase();
}

export default function ChatMenu(props: {
  open: boolean;
  onClose: () => void;

  email: string;
  avatarUrl: string | null;

  items: MenuItem[];
  uiLang: "ja" | "en";
}) {
  const { open, onClose, email, avatarUrl, items, uiLang } = props;

  const wrapRef = React.useRef<HTMLDivElement | null>(null);
  const firstBtnRef = React.useRef<HTMLButtonElement | null>(null);

  // ✅ Escape だけで閉じる（outsideは親＝ChatHeaderが世界仕様で担当）
  React.useEffect(() => {
    if (!open) return;

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };

    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  // ✅ focus first action
  React.useEffect(() => {
    if (!open) return;
    const id = window.setTimeout(() => firstBtnRef.current?.focus(), 0);
    return () => window.clearTimeout(id);
  }, [open]);

  if (!open) return null;

  return (
    <div
      className={styles.wrap}
      ref={wrapRef}
      role="menu"
      aria-label={uiLang === "en" ? "Menu" : "メニュー"}
    >
      <div className={styles.profile} aria-label={uiLang === "en" ? "Account" : "アカウント"}>
        {avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img className={styles.avatar} src={avatarUrl} alt="" />
        ) : (
          <div className={styles.avatarFallback} aria-hidden="true">
            {getInitial(email)}
          </div>
        )}

        <div className={styles.profileText}>
          <div className={styles.profileLabel}>{uiLang === "en" ? "Google ID" : "Google ID"}</div>
          <div className={styles.profileEmail} title={email}>
            {email || (uiLang === "en" ? "Unknown" : "不明")}
          </div>
        </div>
      </div>

      <div className={styles.items}>
        {items.map((it, idx) => {
          if (it.kind === "divider")
            return <div key={it.key} className={styles.divider} aria-hidden="true" />;

          return (
            <button
              key={it.key}
              ref={idx === 0 ? firstBtnRef : undefined}
              type="button"
              className={`${styles.itemBtn} ${it.danger ? styles.danger : ""}`}
              role="menuitem"
              onClick={() => {
                try {
                  it.onClick();
                } finally {
                  onClose();
                }
              }}
            >
              {it.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}