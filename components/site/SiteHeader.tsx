// /components/site/SiteHeader.tsx
"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import styles from "./SiteHeader.module.css";
import { useLang } from "./LangProvider";
import { usePathname } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

/**
 * ✅ ヘッダー責務の分離
 * - marketing/top: ☰
 * - app/*: ···（最小）
 * - chat: 非表示（集中）
 */
function isAppLikePath(pathname: string) {
  return pathname.startsWith("/app") || pathname.startsWith("/chat");
}

type MenuItem =
  | { kind: "link"; href: string; label: string }
  | { kind: "button"; onClick: () => void; label: string; danger?: boolean }
  | { kind: "divider" }
  | { kind: "section"; label: string };

export default function SiteHeader() {
  const { lang, setLang, t } = useLang();
  const pathname = usePathname() || "/";

  // ✅ /chat は “集中” のため SiteHeader を完全に出さない
  // これで呼び元がどこでも二重3ドットを根治できる
  if (pathname.startsWith("/chat")) return null;

  const appMode = useMemo(() => isAppLikePath(pathname), [pathname]);

  const [loggedIn, setLoggedIn] = useState(false);
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement | null>(null);

  // auth sync
  useEffect(() => {
    let mounted = true;

    const sync = async () => {
      const { data } = await supabase.auth.getSession();
      if (!mounted) return;
      setLoggedIn(Boolean(data.session?.user));
    };

    sync();

    const { data: sub } = supabase.auth.onAuthStateChange(() => {
      sync();
    });

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  // close on outside click / escape
  useEffect(() => {
    if (!open) return;

    const onDown = (e: MouseEvent) => {
      const el = panelRef.current;
      if (!el) return;
      const target = e.target as Node | null;
      if (target && el.contains(target)) return;
      setOpen(false);
    };

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };

    window.addEventListener("mousedown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("mousedown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const onLogout = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await supabase.auth.signOut();
      setOpen(false);
      if (location.pathname.startsWith("/app")) location.href = "/";
    } finally {
      setBusy(false);
    }
  };

  const labelCompany = lang === "ja" ? "会社情報" : "Company";
  const labelContact = lang === "ja" ? "問い合わせ（AIチャット）" : "Contact (AI chat)";
  const labelLang = lang === "ja" ? "言語" : "Language";
  const labelSignin = t("nav_signin");
  const labelOpen = t("nav_open");
  const labelLogout = lang === "ja" ? "ログアウト" : "Logout";

  const menuItems: MenuItem[] = useMemo(() => {
    if (appMode) {
      const items: MenuItem[] = [];
      items.push({ kind: "link", href: "/company", label: labelCompany });
      items.push({ kind: "divider" });

      if (loggedIn) {
        items.push({
          kind: "button",
          onClick: onLogout,
          label: labelLogout,
          danger: true,
        });
      } else {
        items.push({ kind: "link", href: "/signin", label: labelSignin });
      }

      return items;
    }

    // marketing/top
    return [
      { kind: "link", href: "/company", label: labelCompany },
      { kind: "link", href: "/company#contact", label: labelContact },
      { kind: "divider" },
      { kind: "link", href: "/signin", label: labelSignin },
      { kind: "link", href: "/chat", label: labelOpen },
      { kind: "divider" },
      { kind: "section", label: labelLang },
    ];
  }, [appMode, loggedIn, labelCompany, labelContact, labelSignin, labelOpen, labelLang, labelLogout]);

  const MenuLang = (
    <div className={styles.menuLang}>
      <select
        className={styles.menuSelect}
        value={lang}
        onChange={(e) => setLang(e.target.value as any)}
        aria-label="Language selector"
      >
        <option value="en">English</option>
        <option value="ja">日本語</option>
        <option value="ko">한국어</option>
        <option value="zh">中文</option>
        <option value="es">Español</option>
      </select>
      <span className={styles.menuChevron} aria-hidden="true">
        ▾
      </span>
    </div>
  );

  const showLangInMenu = !appMode; // app側では言語を出さない（ノイズ削減）

  return (
    <header className={styles.wrap}>
      <div className="container">
        <div className={styles.row}>
          <a className={styles.brand} href="/" aria-label="HOPY">
            <span className={styles.word}>{t("brand")}</span>
          </a>

          <div className={styles.right}>
            <button
              type="button"
              className={styles.menuBtn}
              onClick={() => setOpen((v) => !v)}
              aria-expanded={open}
              aria-haspopup="menu"
              aria-label={appMode ? "More" : "Menu"}
            >
              {appMode ? <span className={styles.kebab}>···</span> : <span className={styles.burger}>☰</span>}
            </button>

            {open && (
              <div ref={panelRef} className={styles.menu} role="menu" aria-label="Site menu">
                {menuItems.map((it, idx) => {
                  if (it.kind === "divider") {
                    return <div key={idx} className={styles.divider} role="separator" />;
                  }
                  if (it.kind === "section") {
                    return (
                      <div key={idx} className={styles.section} aria-hidden="true">
                        {it.label}
                      </div>
                    );
                  }
                  if (it.kind === "link") {
                    return (
                      <a
                        key={idx}
                        className={styles.item}
                        href={it.href}
                        role="menuitem"
                        onClick={() => setOpen(false)}
                      >
                        {it.label}
                      </a>
                    );
                  }
                  return (
                    <button
                      key={idx}
                      type="button"
                      className={`${styles.item} ${styles.itemBtn} ${it.danger ? styles.danger : ""}`}
                      role="menuitem"
                      onClick={it.onClick}
                      disabled={busy}
                      aria-disabled={busy}
                    >
                      {it.label}
                    </button>
                  );
                })}

                {showLangInMenu ? MenuLang : null}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className={styles.hairline} />
    </header>
  );
}