// /components/chat/ui/ChatMoreMenu.tsx
"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import styles from "./ChatMoreMenu.module.css";
import type { Lang } from "../lib/chatTypes";

type Props = {
  email: string;
  uiLang: Lang;
  onLogout: () => Promise<void> | void;
};

export default function ChatMoreMenu(props: Props) {
  const { email, uiLang, onLogout } = props;

  const [open, setOpen] = useState(false);

  const wrapRef = useRef<HTMLDivElement | null>(null);
  const btnRef = useRef<HTMLButtonElement | null>(null);

  // ✅ open時に最初にフォーカスする先（成長リンク削除のため logout に）
  const firstItemRef = useRef<HTMLButtonElement | null>(null);

  const returnFocusRef = useRef(false);

  const labels = useMemo(() => {
    return {
      accountTitle: "ACCOUNT",
      signedIn: uiLang === "en" ? "Signed in" : "Googleログイン中",
      logout: uiLang === "en" ? "Logout" : "ログアウト",
      moreAria: uiLang === "en" ? "More" : "メニュー",
      menuAria: uiLang === "en" ? "Chat menu" : "チャットメニュー",
    };
  }, [uiLang]);

  const rid = React.useId();
  const panelId = `hopy-chat-more-menu-${rid}`;

  const close = React.useCallback((opts?: { returnFocus?: boolean }) => {
    returnFocusRef.current = Boolean(opts?.returnFocus);
    setOpen(false);
  }, []);

  // close on outside / escape / scroll / resize（open時のみ購読）
  useEffect(() => {
    if (!open) return;

    const onPointerDown = (e: PointerEvent) => {
      const el = wrapRef.current;
      if (!el) return;
      const target = e.target as Node | null;
      if (target && el.contains(target)) return;
      close({ returnFocus: true });
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") close({ returnFocus: true });
    };

    const onScroll = () => {
      // 視覚ノイズ防止：スクロールしたら閉じる
      close({ returnFocus: false });
    };

    const onResize = () => {
      close({ returnFocus: false });
    };

    window.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onResize);

    return () => {
      window.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("scroll", onScroll as any);
      window.removeEventListener("resize", onResize);
    };
  }, [open, close]);

  // open時：最初の項目へフォーカス移動
  useEffect(() => {
    if (!open) return;
    const id = window.setTimeout(() => {
      firstItemRef.current?.focus();
    }, 0);
    return () => window.clearTimeout(id);
  }, [open]);

  // close時：必要ならトリガーボタンへフォーカス復帰
  useEffect(() => {
    if (open) return;
    if (!returnFocusRef.current) return;
    returnFocusRef.current = false;
    const id = window.setTimeout(() => {
      btnRef.current?.focus();
    }, 0);
    return () => window.clearTimeout(id);
  }, [open]);

  return (
    <div className={styles.wrap} ref={wrapRef}>
      <button
        ref={btnRef}
        type="button"
        className={styles.btn}
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-controls={panelId}
        aria-label={labels.moreAria}
      >
        ···
      </button>

      {open ? (
        <div id={panelId} className={styles.menu} role="menu" aria-label={labels.menuAria}>
          <div className={styles.accountBlock}>
            <div className={styles.section}>{labels.accountTitle}</div>

            <div className={styles.account}>
              <div className={styles.accountLabel}>{labels.signedIn}</div>
              <div className={styles.accountEmail}>{email}</div>
            </div>
          </div>

          {/* ✅ 成長ダッシュボードは LeftRail に移設済み。ここでは表示しない */}

          <div className={styles.secondaryActions}>
            <button
              ref={firstItemRef}
              type="button"
              role="menuitem"
              className={`${styles.item} ${styles.itemBtn} ${styles.danger}`}
              onClick={async () => {
                // ここはリダイレクトが起きるので、closeは実質不要だが一応整合を保つ
                close({ returnFocus: false });
                await onLogout();
              }}
            >
              {labels.logout}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}