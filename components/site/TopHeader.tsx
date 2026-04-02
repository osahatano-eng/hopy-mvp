// /components/site/TopHeader.tsx
"use client";

import React from "react";
import styles from "./TopHeader.module.css";
import { supabase } from "@/lib/supabaseClient";
import { LANGS, useLang } from "@/components/site/LangProvider";
import { usePathname, useRouter } from "next/navigation";

export default function TopHeader() {
  const router = useRouter();
  const pathname = usePathname();
  const { lang, setLang, uiLang2, enabledLangs } = useLang();

  const [loggedIn, setLoggedIn] = React.useState(false);
  const [busy, setBusy] = React.useState(false);

  // 右メニュー
  const [rightOpen, setRightOpen] = React.useState(false);

  // 右メニュー内：言語の折りたたみ
  const [langOpen, setLangOpen] = React.useState(false);

  // ✅ アカウント表示（メールは使わず、name優先）
  const [accountName, setAccountName] = React.useState<string>("");
  const [accountAvatarUrl, setAccountAvatarUrl] = React.useState<string>("");

  // ✅ restore 中の “一瞬 session=null” で loggedIn=false に落とさないためのフラグ
  const sessionSettlingRef = React.useRef(false);

  const isLegal = pathname === "/legal";
  const showCompanyLink = !isLegal;

  // ✅ session を段階的に確定させる（cookie / restore 遅延吸収）
  async function waitForSessionSettled(): Promise<boolean> {
    const delays = [0, 60, 120, 240, 360, 520, 760, 1000];
    for (const d of delays) {
      if (d > 0) await new Promise((r) => setTimeout(r, d));
      try {
        const { data } = await supabase.auth.getSession();
        const ok = Boolean(data?.session?.user?.id) && Boolean(String(data?.session?.access_token ?? "").trim());
        if (ok) return true;
      } catch {
        // 例外は握りつぶし、次の試行へ
      }
    }
    return false;
  }

  // ✅ “今この瞬間” のセッション判定（即時）
  function isSessionOkNow(session: any): boolean {
    return Boolean(session?.user?.id) && Boolean(String(session?.access_token ?? "").trim());
  }

  function applyAccountFromSession(session: any) {
    try {
      const meta = session?.user?.user_metadata ?? {};
      const name =
        String(meta?.full_name ?? meta?.name ?? meta?.user_name ?? meta?.preferred_username ?? "").trim() ||
        "Google Account";

      const avatar = String(meta?.avatar_url ?? meta?.picture ?? "").trim();

      setAccountName(name);
      setAccountAvatarUrl(avatar);
    } catch {
      setAccountName("Google Account");
      setAccountAvatarUrl("");
    }
  }

  const copy = React.useMemo(() => {
    const ja = uiLang2 === "ja";
    return {
      brandAria: "HOPY",

      // triggers
      kebabAria: ja ? "メニュー" : "Menu",

      // right menu
      login: ja ? "ログイン" : "Sign in",
      logout: ja ? "ログアウト" : "Sign out",
      language: ja ? "言語" : "Language",
      languageSoon: ja ? "（準備中）" : "(soon)",
      company: ja ? "会社情報" : "Company",
      googleAccount: ja ? "Googleアカウント" : "Google Account",

      // aria
      rightMenuAria: ja ? "HOPY メニュー" : "HOPY menu",
    };
  }, [uiLang2]);

  // ===== Refs for outside click =====
  const rightWrapRef = React.useRef<HTMLDivElement | null>(null);
  const rightBtnRef = React.useRef<HTMLButtonElement | null>(null);

  // focus first item
  const rightFirstRef = React.useRef<HTMLElement | null>(null);

  const rightPanelId = "hopy-topheader-rightmenu";

  // ===== auth sync =====
  React.useEffect(() => {
    let mounted = true;

    (async () => {
      sessionSettlingRef.current = true;

      try {
        // 1) 即時
        try {
          const { data } = await supabase.auth.getSession();
          if (!mounted) return;

          const okNow = isSessionOkNow(data?.session);
          if (okNow) {
            setLoggedIn(true);
            applyAccountFromSession(data?.session);
            return;
          }
        } catch {
          // 続行
        }

        // 2) 段階待ち（restore 遅延吸収）
        const ok = await waitForSessionSettled();
        if (!mounted) return;
        setLoggedIn(ok);

        if (ok) {
          try {
            const { data } = await supabase.auth.getSession();
            if (!mounted) return;
            applyAccountFromSession(data?.session);
          } catch {}
        } else {
          setAccountName("");
          setAccountAvatarUrl("");
        }
      } finally {
        if (mounted) sessionSettlingRef.current = false;
      }
    })();

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!mounted) return;

      const ok = isSessionOkNow(session);

      if (ok) {
        // ✅ 確定してログインになったら即反映
        setLoggedIn(true);
        applyAccountFromSession(session);
        return;
      }

      // ✅ session=null / token無し が来ても「即ログアウト扱い」にしない（restore 揺れ対策）
      if (sessionSettlingRef.current) return;

      // ✅ settling 外で ok でないなら、最後に一度だけ待って確定
      (async () => {
        sessionSettlingRef.current = true;
        try {
          const ok2 = await waitForSessionSettled();
          if (!mounted) return;
          setLoggedIn(ok2);

          if (ok2) {
            try {
              const { data } = await supabase.auth.getSession();
              if (!mounted) return;
              applyAccountFromSession(data?.session);
            } catch {}
          } else {
            setAccountName("");
            setAccountAvatarUrl("");
          }
        } finally {
          if (mounted) sessionSettlingRef.current = false;
        }
      })();
    });

    return () => {
      mounted = false;
      sub?.subscription?.unsubscribe();
    };
  }, []);

  // ===== helpers =====
  const closeAll = React.useCallback(() => {
    setRightOpen(false);
    setLangOpen(false);
    window.setTimeout(() => rightBtnRef.current?.focus(), 0);
  }, []);

  // outside click / escape
  React.useEffect(() => {
    if (!rightOpen) return;

    function onDown(e: MouseEvent) {
      const t = e.target as Node | null;
      const inRight = rightWrapRef.current && t && rightWrapRef.current.contains(t);
      if (inRight) return;
      closeAll();
    }

    function onKey(e: KeyboardEvent) {
      if (e.key !== "Escape") return;
      closeAll();
    }

    window.addEventListener("mousedown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("mousedown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [rightOpen, closeAll]);

  // focus first item when open
  React.useEffect(() => {
    if (rightOpen) window.setTimeout(() => rightFirstRef.current?.focus?.(), 0);
  }, [rightOpen]);

  // ===== actions =====
  const onToggleRight = () => {
    setRightOpen((v) => {
      const next = !v;
      if (!next) setLangOpen(false);
      return next;
    });
  };

  const onPickLang = (next: (typeof LANGS)[number]["key"]) => {
    if (!enabledLangs[next]) return;
    setLang(next);
    closeAll();
  };

  const goSign = React.useCallback(() => {
    closeAll();
    try {
      router.push("/signin");
    } catch {
      try {
        location.href = "/signin";
      } catch {}
    }
  }, [router, closeAll]);

  const onBrandClick: React.MouseEventHandler<HTMLAnchorElement> = (e) => {
    e.preventDefault();
    closeAll();
    try {
      router.push("/");
    } catch {
      try {
        location.href = "/";
      } catch {}
    }
  };

  // ✅ ログアウト後の遷移先は常に "/" に固定
  const onLogout = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await supabase.auth.signOut();
      try {
        router.replace("/");
      } catch {
        location.href = "/";
      }
    } finally {
      closeAll();
      setBusy(false);
    }
  };

  const onItemClick = () => {
    closeAll();
  };

  const accountInitial = React.useMemo(() => {
    const s = String(accountName || copy.googleAccount).trim();
    return s ? s.slice(0, 1).toUpperCase() : "G";
  }, [accountName, copy.googleAccount]);

  const accountDisplayName = React.useMemo(() => {
    return String(accountName || copy.googleAccount).trim() || copy.googleAccount;
  }, [accountName, copy.googleAccount]);

  return (
    <header className={styles.header} role="banner">
      <div className={styles.innerGrid}>
        {/* Left */}
        <div className={styles.leftSlot}>
          <a className={styles.brand} href="/" aria-label={copy.brandAria} onClick={onBrandClick} style={{ justifySelf: "start" }}>
            HOPY
          </a>
        </div>

        {/* Center */}
        <div aria-hidden="true" />

        {/* Right: ・・・ */}
        <div className={styles.rightSlot} ref={rightWrapRef}>
          <button
            ref={rightBtnRef}
            type="button"
            className={styles.iconBtn}
            aria-label={copy.kebabAria}
            aria-haspopup="menu"
            aria-expanded={rightOpen}
            aria-controls={rightPanelId}
            onClick={onToggleRight}
          >
            <span className={styles.dots} aria-hidden="true">
              <span className={styles.dot} />
              <span className={styles.dot} />
              <span className={styles.dot} />
            </span>
          </button>

          {rightOpen && (
            <div id={rightPanelId} className={styles.panelRight} role="menu" aria-label={copy.rightMenuAria}>
              {!loggedIn ? (
                <button
                  ref={(el) => {
                    if (el) rightFirstRef.current = el as unknown as HTMLElement;
                  }}
                  type="button"
                  className={styles.item}
                  role="menuitem"
                  onClick={goSign}
                >
                  {copy.login}
                </button>
              ) : (
                <>
                  <div
                    ref={(el) => {
                      if (el) rightFirstRef.current = el;
                    }}
                    className={`${styles.item} ${styles.itemMuted} ${styles.itemDisabled}`}
                    role="menuitem"
                    aria-disabled="true"
                    tabIndex={0}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                    }}
                  >
                    {accountAvatarUrl ? (
                      <img
                        src={accountAvatarUrl}
                        alt=""
                        aria-hidden="true"
                        width={22}
                        height={22}
                        style={{
                          width: 22,
                          height: 22,
                          borderRadius: "999px",
                          objectFit: "cover",
                          flex: "0 0 auto",
                        }}
                      />
                    ) : (
                      <span
                        aria-hidden="true"
                        style={{
                          width: 22,
                          height: 22,
                          borderRadius: "999px",
                          display: "inline-flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontSize: 11,
                          lineHeight: 1,
                          border: "1px solid currentColor",
                          flex: "0 0 auto",
                        }}
                      >
                        {accountInitial}
                      </span>
                    )}
                    <span
                      style={{
                        minWidth: 0,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {accountDisplayName}
                    </span>
                  </div>

                  <button
                    type="button"
                    className={styles.item}
                    role="menuitem"
                    onClick={onLogout}
                    disabled={busy}
                    aria-disabled={busy}
                  >
                    {copy.logout}
                  </button>
                </>
              )}

              <button
                type="button"
                className={styles.item}
                role="menuitem"
                aria-expanded={langOpen}
                onClick={() => setLangOpen((v) => !v)}
              >
                <span className={styles.itemRow}>
                  <span>{copy.language}</span>
                  <span className={styles.chev2} aria-hidden="true">
                    {langOpen ? "▴" : "▾"}
                  </span>
                </span>
              </button>

              {langOpen ? (
                <div className={styles.langList} role="group" aria-label={copy.language}>
                  {LANGS.map((l) => {
                    const active = l.key === lang;
                    const enabled = Boolean(enabledLangs[l.key]);
                    const label = enabled ? l.label : `${l.label} ${copy.languageSoon}`;

                    return (
                      <button
                        key={l.key}
                        type="button"
                        className={`${styles.item} ${styles.itemSub} ${!enabled ? styles.itemMuted : ""}`}
                        role="menuitemradio"
                        aria-checked={active}
                        disabled={!enabled}
                        onClick={() => onPickLang(l.key)}
                        title={!enabled ? label : undefined}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>
              ) : null}

              {showCompanyLink ? (
                <a className={styles.item} href="/legal" role="menuitem" onClick={onItemClick}>
                  {copy.company}
                </a>
              ) : null}
            </div>
          )}
        </div>
      </div>
    </header>
  );
}