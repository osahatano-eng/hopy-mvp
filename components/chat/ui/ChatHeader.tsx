// /components/chat/ui/ChatHeader.tsx
"use client";

import React from "react";
import { supabase } from "@/lib/supabaseClient";

const LANGS = [
  { key: "ja", label: "日本語" },
  { key: "en", label: "English" },
] as const;

// ✅ Portal配下でも “チャット本体と同じ” に見えるよう、明示的な font stack を用意
function appFontFamily(): string {
  return [
    "var(--font-sans, var(--fontSans, ui-sans-serif))",
    "system-ui",
    "-apple-system",
    "BlinkMacSystemFont",
    '"Segoe UI"',
    '"Hiragino Sans"',
    '"Hiragino Kaku Gothic ProN"',
    '"Noto Sans JP"',
    '"Yu Gothic"',
    "Meiryo",
    "sans-serif",
  ].join(", ");
}

const APP_FONT_FAMILY = appFontFamily();

const BTN_BASE_STYLE: React.CSSProperties = {
  minWidth: 44,
  width: 44,
  height: 44,
  padding: 0,
  border: "0",
  background: "transparent",
  color: "inherit",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  cursor: "pointer",
  touchAction: "manipulation",
  WebkitTapHighlightColor: "transparent",
  lineHeight: 1,
  userSelect: "none",
  borderRadius: 12,
  outline: "none",
  transition: "background 120ms ease, transform 120ms ease, opacity 120ms ease",
  boxSizing: "border-box",
  flex: "0 0 44px",
  opacity: 0.9,
};

const ICON_BASE_STYLE: React.CSSProperties = {
  display: "inline-block",
  width: 24,
  textAlign: "center",
  fontSize: 20,
  fontWeight: 800,
  letterSpacing: "0",
  transform: "translateY(-0.5px)",
  fontFamily: APP_FONT_FAMILY,
  flex: "0 0 auto",
};

const MENU_BOX_STYLE: React.CSSProperties = {
  position: "fixed",
  right: "max(12px, env(safe-area-inset-right))",
  top: "calc(48px + env(safe-area-inset-top) + 8px)",
  width: "min(240px, calc(100dvw - 24px - env(safe-area-inset-right)))",
  maxWidth: "min(240px, calc(100dvw - 24px - env(safe-area-inset-right)))",
  minWidth: 0,
  padding: 10,
  background: "var(--paper)",
  border: "1px solid rgba(0,0,0,0.10)",
  borderRadius: 12,
  zIndex: 1100,
  boxShadow: "none",
  boxSizing: "border-box",
  overflowX: "hidden",
};

const MENU_ITEM_STYLE: React.CSSProperties = {
  width: "100%",
  textAlign: "left",
  padding: "12px 10px",
  border: "0",
  background: "transparent",
  fontSize: 14,
  fontWeight: 650,
  borderRadius: 10,
  cursor: "pointer",
  display: "flex",
  alignItems: "center",
  gap: 10,
  transition: "background 120ms ease, transform 120ms ease",
  touchAction: "manipulation",
  WebkitTapHighlightColor: "transparent",
  lineHeight: 1.1,
  fontFamily: APP_FONT_FAMILY,
  boxSizing: "border-box",
};

const RIGHT_MARK_STYLE: React.CSSProperties = {
  marginLeft: "auto",
  fontSize: 18,
  fontWeight: 800,
  opacity: 0.55,
  lineHeight: 1,
  transform: "translateY(-0.5px)",
  fontFamily: APP_FONT_FAMILY,
};

const SMALL_ICON_STYLE: React.CSSProperties = {
  width: 20,
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  fontSize: 14,
  fontWeight: 900,
  opacity: 0.75,
  lineHeight: 1,
  transform: "translateY(-0.5px)",
  fontFamily: APP_FONT_FAMILY,
};

const HEADER_HEIGHT = "calc(48px + env(safe-area-inset-top))";
const SIDE_SLOT_W = 44;
const LOGOUT_TIMEOUT_MS = 4000;

function isMobileNow() {
  if (typeof window === "undefined") return false;
  try {
    return Boolean(window.matchMedia && window.matchMedia("(max-width: 640px)").matches);
  } catch {
    return false;
  }
}

function safeGoHome() {
  try {
    if (typeof window === "undefined") return;
    const homeUrl = new URL("/", window.location.origin).toString();
    window.location.replace(homeUrl);
  } catch {
    try {
      if (typeof window === "undefined") return;
      window.location.replace("/");
    } catch {}
  }
}

function canUseStorage(kind: "localStorage" | "sessionStorage") {
  try {
    if (typeof window === "undefined") return false;
    const s = (window as any)[kind] as Storage | undefined;
    if (!s) return false;
    const k = "__hopy_storage_test__";
    s.setItem(k, "1");
    s.removeItem(k);
    return true;
  } catch {
    return false;
  }
}

async function clearLocalAuthArtifacts() {
  if (typeof window === "undefined") return;

  const stores: Array<"localStorage" | "sessionStorage"> = ["localStorage", "sessionStorage"];

  for (const kind of stores) {
    try {
      if (!canUseStorage(kind)) continue;
      const storage = window[kind];
      const keys: string[] = [];

      for (let i = 0; i < storage.length; i++) {
        const key = storage.key(i);
        if (!key) continue;

        const lower = key.toLowerCase();

        if (
          lower === "hopy_auth" ||
          lower.startsWith("sb-") ||
          lower.includes("supabase") ||
          lower.includes("auth-token")
        ) {
          keys.push(key);
        }
      }

      for (const key of keys) {
        try {
          storage.removeItem(key);
        } catch {}
      }
    } catch {}
  }
}

async function signOutWithTimeout() {
  const timeoutPromise = new Promise<{ error: Error }>((resolve) => {
    const timer = window.setTimeout(() => {
      resolve({ error: new Error("signout_timeout") });
    }, LOGOUT_TIMEOUT_MS);

    void timer;
  });

  const result = await Promise.race([
    supabase.auth.signOut(),
    timeoutPromise,
  ]);

  return result;
}

function usePressFeedback() {
  const [pressed, setPressed] = React.useState(false);

  const onPointerDown = React.useCallback(() => {
    setPressed(true);
  }, []);

  const onPointerUp = React.useCallback(() => {
    setPressed(false);
  }, []);

  const onPointerCancel = React.useCallback(() => {
    setPressed(false);
  }, []);

  const onPointerLeave = React.useCallback(() => {
    setPressed(false);
  }, []);

  return React.useMemo(
    () => ({
      pressed,
      handlers: {
        onPointerDown,
        onPointerUp,
        onPointerCancel,
        onPointerLeave,
      } as const,
    }),
    [pressed, onPointerCancel, onPointerDown, onPointerLeave, onPointerUp]
  );
}

function pressedStyle(pressed: boolean): React.CSSProperties {
  return pressed
    ? {
        background: "var(--tapActive, rgba(0,0,0,0.05))",
        transform: "translateY(0.5px)",
        opacity: 1,
      }
    : {};
}

export default function ChatHeader(props: {
  uiLang: "ja" | "en";
  railOpen: boolean;
  onToggleRail: () => void;
  email: string;
  onChangeLang?: (next: "ja" | "en") => void;
}) {
  const { uiLang, railOpen, onToggleRail, email, onChangeLang } = props;

  const [open, setOpen] = React.useState(false);
  const [langOpen, setLangOpen] = React.useState(false);
  const wrapRef = React.useRef<HTMLElement | null>(null);

  const isEn = uiLang === "en";
  const labels = React.useMemo(
    () => ({
      hopy: "HOPY",
      login: isEn ? "Sign in" : "ログイン",
      logout: isEn ? "Sign out" : "ログアウト",
      close: isEn ? "Close" : "閉じる",
      googleAccount: isEn ? "Google Account" : "Googleアカウント",
      guest: isEn ? "Guest" : "ゲスト",
      menu: isEn ? "Menu" : "メニュー",
      language: isEn ? "Language" : "言語",
      openMenu: isEn ? "Open menu" : "メニューを開く",
      closeMenu: isEn ? "Close menu" : "メニューを閉じる",
      more: isEn ? "More" : "メニュー",
    }),
    [isEn]
  );

  const [accountName, setAccountName] = React.useState<string>("");
  const [accountAvatarUrl, setAccountAvatarUrl] = React.useState<string>("");
  const [avatarLoadFailed, setAvatarLoadFailed] = React.useState<boolean>(false);
  const [isAuthenticated, setIsAuthenticated] = React.useState<boolean>(false);

  const leftBtn = usePressFeedback();
  const rightBtn = usePressFeedback();
  const logoutBtn = usePressFeedback();
  const closeBtn = usePressFeedback();

  const [isMobile, setIsMobile] = React.useState(false);

  const hasEmailProp = React.useMemo(() => Boolean(String(email ?? "").trim()), [email]);

  React.useEffect(() => {
    let mounted = true;

    function applyGuest() {
      if (!mounted) return;
      setIsAuthenticated(false);
      setAccountName("");
      setAccountAvatarUrl("");
      setAvatarLoadFailed(false);
    }

    function applyAccountFromSession(session: any) {
      if (!mounted) return;

      const user = session?.user;
      const sessionEmail = String(user?.email ?? "").trim();
      const propEmail = String(email ?? "").trim();

      if (!user && !propEmail) {
        applyGuest();
        return;
      }

      try {
        const meta = user?.user_metadata ?? {};
        const fallbackEmail = sessionEmail || propEmail;
        const name =
          String(meta?.full_name ?? meta?.name ?? meta?.user_name ?? meta?.preferred_username ?? "").trim() ||
          fallbackEmail ||
          labels.googleAccount;

        const avatar = String(meta?.avatar_url ?? meta?.picture ?? "").trim();

        setIsAuthenticated(Boolean(user || propEmail));
        setAccountName(name);
        setAccountAvatarUrl(avatar);
        setAvatarLoadFailed(false);
      } catch {
        const fallbackEmail = sessionEmail || propEmail;
        setIsAuthenticated(Boolean(user || propEmail));
        setAccountName(fallbackEmail || labels.googleAccount);
        setAccountAvatarUrl("");
        setAvatarLoadFailed(false);
      }
    }

    (async () => {
      try {
        const { data } = await supabase.auth.getSession();
        if (!mounted) return;

        if (!data?.session?.user?.email && !hasEmailProp) {
          applyGuest();
          return;
        }

        applyAccountFromSession(data?.session);
      } catch {
        if (!hasEmailProp) {
          applyGuest();
          return;
        }
        applyAccountFromSession(null);
      }
    })();

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session?.user?.email && !hasEmailProp) {
        applyGuest();
        return;
      }
      applyAccountFromSession(session);
    });

    return () => {
      mounted = false;
      try {
        sub?.subscription?.unsubscribe();
      } catch {}
    };
  }, [email, hasEmailProp, labels.googleAccount]);

  React.useEffect(() => {
    setAvatarLoadFailed(false);
  }, [accountAvatarUrl]);

  React.useEffect(() => {
    if (typeof window === "undefined") return;

    let mql: MediaQueryList | null = null;

    const apply = () => {
      setIsMobile(isMobileNow());
    };

    const onChange = () => apply();

    try {
      mql = window.matchMedia("(max-width: 640px)");
      apply();

      if (typeof mql.addEventListener === "function") {
        mql.addEventListener("change", onChange);
        return () => {
          try {
            mql?.removeEventListener("change", onChange);
          } catch {}
        };
      }

      // @ts-ignore
      if (typeof mql.addListener === "function") {
        // @ts-ignore
        mql.addListener(onChange);
        return () => {
          try {
            // @ts-ignore
            mql?.removeListener(onChange);
          } catch {}
        };
      }
    } catch {}

    const onResize = () => apply();
    try {
      window.addEventListener("resize", onResize, { passive: true } as any);
      return () => {
        try {
          window.removeEventListener("resize", onResize as any);
        } catch {}
      };
    } catch {}

    return;
  }, []);

  const onDownOutside = React.useCallback((e: any) => {
    const el = wrapRef.current;
    if (!el) return;
    if (el.contains(e.target)) return;
    setOpen(false);
    setLangOpen(false);
  }, []);

  React.useEffect(() => {
    if (!open) return;

    try {
      window.addEventListener("mousedown", onDownOutside, { passive: true, capture: true } as any);
      window.addEventListener("touchstart", onDownOutside, { passive: true, capture: true } as any);
    } catch {}

    return () => {
      try {
        window.removeEventListener("mousedown", onDownOutside as any, true);
      } catch {}
      try {
        window.removeEventListener("touchstart", onDownOutside as any, true);
      } catch {}
    };
  }, [open, onDownOutside]);

  const onFocusInOutside = React.useCallback((e: any) => {
    try {
      const el = wrapRef.current;
      if (!el) return;
      if (el.contains(e.target)) return;
      setOpen(false);
      setLangOpen(false);
    } catch {}
  }, []);

  React.useEffect(() => {
    if (!open) return;

    try {
      window.addEventListener("focusin", onFocusInOutside, true);
    } catch {}

    return () => {
      try {
        window.removeEventListener("focusin", onFocusInOutside as any, true);
      } catch {}
    };
  }, [open, onFocusInOutside]);

  React.useEffect(() => {
    if (railOpen) {
      setOpen(false);
      setLangOpen(false);
    }
  }, [railOpen]);

  React.useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      try {
        if (e.key === "Escape") {
          setOpen(false);
          setLangOpen(false);
        }
      } catch {}
    };
    try {
      window.addEventListener("keydown", onKeyDown, { passive: true } as any);
    } catch {}
    return () => {
      try {
        window.removeEventListener("keydown", onKeyDown as any);
      } catch {}
    };
  }, [open]);

  const loggingOutRef = React.useRef(false);

  const onLogout = React.useCallback(async () => {
    setOpen(false);
    setLangOpen(false);

    if (loggingOutRef.current) return;
    loggingOutRef.current = true;

    try {
      const result = await signOutWithTimeout();

      if (result?.error && String(result.error.message ?? "") !== "signout_timeout") {
        throw result.error;
      }

      try {
        await clearLocalAuthArtifacts();
      } catch {}

      setIsAuthenticated(false);
      setAccountName("");
      setAccountAvatarUrl("");
      setAvatarLoadFailed(false);

      safeGoHome();
    } catch {
      try {
        await clearLocalAuthArtifacts();
      } catch {}

      try {
        setIsAuthenticated(false);
        setAccountName("");
        setAccountAvatarUrl("");
        setAvatarLoadFailed(false);
      } catch {}

      safeGoHome();
    } finally {
      loggingOutRef.current = false;
    }
  }, []);

  const goSignin = React.useCallback(() => {
    setOpen(false);
    setLangOpen(false);
    try {
      if (typeof window === "undefined") return;
      window.location.assign("/signin");
    } catch {}
  }, []);

  const onPickLang = React.useCallback(
    (next: (typeof LANGS)[number]["key"]) => {
      if (next !== "ja" && next !== "en") return;
      try {
        onChangeLang?.(next);
      } catch {}
      setOpen(false);
      setLangOpen(false);
    },
    [onChangeLang]
  );

  const effectiveAuthenticated = isAuthenticated || hasEmailProp;
  const effectiveAccountName = effectiveAuthenticated
    ? String(accountName || email || labels.googleAccount).trim()
    : labels.guest;

  const accountInitial = effectiveAuthenticated ? effectiveAccountName.slice(0, 1).toUpperCase() || "G" : "G";
  const shouldShowAvatarImage =
    effectiveAuthenticated && Boolean(String(accountAvatarUrl).trim()) && !avatarLoadFailed;

  const accountInlinePaddingStyle: React.CSSProperties = React.useMemo(
    () =>
      isMobile
        ? {
            paddingLeft: 14,
            paddingRight: 14,
          }
        : {
            paddingLeft: "var(--gutter, 16px)",
            paddingRight: "calc(var(--gutter, 16px) + var(--pcRailScrollbarGap, 14px))",
          },
    [isMobile]
  );

  const titleStyle: React.CSSProperties = React.useMemo(
    () => ({
      width: "100%",
      textAlign: "center",
      fontSize: 14,
      fontWeight: 720,
      letterSpacing: isMobile ? "0.08em" : "0.1em",
      opacity: 0.94,
      whiteSpace: "nowrap",
      overflow: "hidden",
      textOverflow: "ellipsis",
      lineHeight: 1.1,
      fontFamily: APP_FONT_FAMILY,
      pointerEvents: "none",
      userSelect: "none",
    }),
    [isMobile]
  );

  const headerUI = (
    <header
      ref={wrapRef}
      role="banner"
      data-hopy-chat-header="1"
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        height: HEADER_HEIGHT,
        paddingTop: "env(safe-area-inset-top)",
        background: "var(--paper)",
        color: "var(--text)",
        zIndex: 1000,
        boxShadow: "none",
        transform: "translateY(var(--vvTop, 0px))",
        willChange: "transform",
        fontFamily: APP_FONT_FAMILY,
        boxSizing: "border-box",
        minWidth: 0,
        overflow: "visible",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: "min(100%, var(--container, 900px))",
          margin: "0 auto",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          ...accountInlinePaddingStyle,
          boxSizing: "border-box",
          minWidth: 0,
        }}
      >
        <div
          style={{
            width: SIDE_SLOT_W,
            minWidth: SIDE_SLOT_W,
            flex: `0 0 ${SIDE_SLOT_W}px`,
            display: "flex",
            alignItems: "center",
            justifyContent: "flex-start",
            minHeight: 0,
            boxSizing: "border-box",
          }}
        >
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              setLangOpen(false);
              onToggleRail();
            }}
            aria-label={railOpen ? labels.closeMenu : labels.openMenu}
            aria-expanded={railOpen}
            style={{ ...BTN_BASE_STYLE, ...pressedStyle(leftBtn.pressed), fontFamily: APP_FONT_FAMILY, gap: 0 }}
            {...leftBtn.handlers}
          >
            <span aria-hidden="true" style={ICON_BASE_STYLE}>
              {railOpen ? "×" : "≡"}
            </span>
          </button>
        </div>

        <div
          style={{
            flex: 1,
            minWidth: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            paddingLeft: 8,
            paddingRight: 8,
            overflow: "hidden",
            fontFamily: APP_FONT_FAMILY,
            boxSizing: "border-box",
          }}
        >
          <div style={titleStyle}>{labels.hopy}</div>
        </div>

        <div
          style={{
            position: "relative",
            width: SIDE_SLOT_W,
            minWidth: SIDE_SLOT_W,
            flex: `0 0 ${SIDE_SLOT_W}px`,
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "flex-end",
            minHeight: 0,
            fontFamily: APP_FONT_FAMILY,
            boxSizing: "border-box",
            overflow: "visible",
          }}
        >
          <button
            type="button"
            onClick={() => {
              setOpen((v) => {
                const next = !v;
                if (!next) setLangOpen(false);
                return next;
              });
            }}
            aria-expanded={open}
            aria-label={open ? labels.closeMenu : labels.more}
            style={{ ...BTN_BASE_STYLE, ...pressedStyle(rightBtn.pressed), fontFamily: APP_FONT_FAMILY }}
            {...rightBtn.handlers}
          >
            <span aria-hidden="true" style={{ ...ICON_BASE_STYLE, fontSize: 22, transform: "translateY(-1px)" }}>
              {open ? "×" : "\u22EF"}
            </span>
          </button>

          {open && (
            <div role="menu" aria-label={labels.menu} style={MENU_BOX_STYLE}>
              <div
                style={{
                  fontSize: 12,
                  fontWeight: 600,
                  opacity: 0.82,
                  padding: "8px 10px",
                  borderRadius: 10,
                  background: "rgba(0,0,0,0.03)",
                  marginBottom: 8,
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  minWidth: 0,
                  fontFamily: APP_FONT_FAMILY,
                  boxSizing: "border-box",
                }}
              >
                {shouldShowAvatarImage ? (
                  <img
                    src={accountAvatarUrl}
                    alt=""
                    aria-hidden="true"
                    width={22}
                    height={22}
                    onError={() => setAvatarLoadFailed(true)}
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
                      boxSizing: "border-box",
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
                  {effectiveAccountName}
                </span>
              </div>

              {effectiveAuthenticated ? (
                <>
                  <button
                    type="button"
                    onClick={onLogout}
                    role="menuitem"
                    style={{ ...MENU_ITEM_STYLE, ...pressedStyle(logoutBtn.pressed) }}
                    {...logoutBtn.handlers}
                  >
                    <span aria-hidden="true" style={SMALL_ICON_STYLE}>
                      ⎋
                    </span>
                    <span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {labels.logout}
                    </span>
                    <span aria-hidden="true" style={RIGHT_MARK_STYLE}>
                      {"›"}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setOpen(false)}
                    role="menuitem"
                    style={{ ...MENU_ITEM_STYLE, fontWeight: 650, opacity: 0.9, ...pressedStyle(closeBtn.pressed) }}
                    {...closeBtn.handlers}
                  >
                    <span aria-hidden="true" style={SMALL_ICON_STYLE}>
                      ×
                    </span>
                    <span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {labels.close}
                    </span>
                    <span aria-hidden="true" style={RIGHT_MARK_STYLE}>
                      {"›"}
                    </span>
                  </button>
                </>
              ) : (
                <>
                  <button type="button" onClick={goSignin} role="menuitem" style={MENU_ITEM_STYLE}>
                    <span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {labels.login}
                    </span>
                    <span aria-hidden="true" style={RIGHT_MARK_STYLE}>
                      {"›"}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setLangOpen((v) => !v)}
                    role="menuitem"
                    aria-expanded={langOpen}
                    style={MENU_ITEM_STYLE}
                  >
                    <span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {labels.language}
                    </span>
                    <span aria-hidden="true" style={RIGHT_MARK_STYLE}>
                      {langOpen ? "▴" : "▾"}
                    </span>
                  </button>

                  {langOpen ? (
                    <div
                      role="group"
                      aria-label={labels.language}
                      style={{
                        marginTop: 4,
                        marginBottom: 4,
                        minWidth: 0,
                        boxSizing: "border-box",
                      }}
                    >
                      {LANGS.map((l) => {
                        const active = l.key === uiLang;

                        return (
                          <button
                            key={l.key}
                            type="button"
                            role="menuitemradio"
                            aria-checked={active}
                            onClick={() => onPickLang(l.key)}
                            style={{
                              ...MENU_ITEM_STYLE,
                              paddingLeft: 18,
                            }}
                          >
                            <span
                              style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
                            >
                              {l.label}
                            </span>
                            {active ? (
                              <span aria-hidden="true" style={RIGHT_MARK_STYLE}>
                                {"✓"}
                              </span>
                            ) : null}
                          </button>
                        );
                      })}
                    </div>
                  ) : null}

                  <button
                    type="button"
                    onClick={() => {
                      setOpen(false);
                      setLangOpen(false);
                    }}
                    role="menuitem"
                    style={{ ...MENU_ITEM_STYLE, fontWeight: 650, opacity: 0.9, ...pressedStyle(closeBtn.pressed) }}
                    {...closeBtn.handlers}
                  >
                    <span aria-hidden="true" style={SMALL_ICON_STYLE}>
                      ×
                    </span>
                    <span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {labels.close}
                    </span>
                    <span aria-hidden="true" style={RIGHT_MARK_STYLE}>
                      {"›"}
                    </span>
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </header>
  );

  return headerUI;
}

/*
このファイルの正式役割:
チャット画面上部ヘッダーとして、左カラム開閉、HOPYタイトル表示、右上メニューの開閉、認証状態表示、ログイン/ログアウト、言語切替のUI制御だけを担う。
*/

/*
【今回このファイルで修正したこと】
1. isMobile の初期値を isMobileNow() から false 固定へ変更しました。
2. SSR時とclient初回描画時の header inline style が一致するようにしました。
3. client mount後の useEffect で実際の viewport に応じて isMobile を反映する既存処理は維持しました。
4. hydration mismatch の原因になっていた padding / letterSpacing の初回差分を抑えました。
5. signOut timeout、認証掃除、メニュー表示、言語切替、HOPY唯一の正には触っていません。
*/

/*
/components/chat/ui/ChatHeader.tsx
*/