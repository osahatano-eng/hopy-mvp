// /app/signin/page.tsx
"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import styles from "./page.module.css";

type Lang = "en" | "ja";

function safeLang(x: any): Lang {
  return x === "ja" ? "ja" : "en";
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

async function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function errText(e: unknown): string {
  try {
    if (typeof e === "string") return e;
    if (e && typeof e === "object" && "message" in e) {
      return String((e as any).message ?? "");
    }
    return String(e ?? "");
  } catch {
    return "";
  }
}

function isInvalidRefreshTokenErrorMessage(message: string): boolean {
  const s = String(message ?? "").toLowerCase();
  return (
    s.includes("invalid refresh token") ||
    s.includes("refresh token not found") ||
    s.includes("refresh_token_not_found") ||
    s.includes("invalid_grant")
  );
}

function GoogleIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      width="18"
      height="18"
      style={{ display: "block", flex: "0 0 auto" }}
    >
      <path
        fill="#EA4335"
        d="M12 10.2v3.9h5.4c-.24 1.26-.96 2.32-2.04 3.03l3.3 2.56c1.92-1.77 3.03-4.38 3.03-7.5 0-.72-.06-1.41-.18-2.07H12Z"
      />
      <path
        fill="#34A853"
        d="M12 22c2.7 0 4.97-.9 6.63-2.44l-3.3-2.56c-.92.62-2.1.99-3.33.99-2.56 0-4.72-1.73-5.49-4.05l-3.41 2.63A9.99 9.99 0 0 0 12 22Z"
      />
      <path
        fill="#4A90E2"
        d="M6.51 13.94A5.99 5.99 0 0 1 6.2 12c0-.67.11-1.32.31-1.94L3.1 7.43A9.98 9.98 0 0 0 2 12c0 1.61.39 3.13 1.1 4.57l3.41-2.63Z"
      />
      <path
        fill="#FBBC05"
        d="M12 6.01c1.47 0 2.8.51 3.84 1.5l2.88-2.88C16.96 2.99 14.69 2 12 2 8.09 2 4.73 4.24 3.1 7.43l3.41 2.63C7.28 7.74 9.44 6.01 12 6.01Z"
      />
    </svg>
  );
}

export default function SignInPage() {
  const [busy, setBusy] = useState(false);
  const [uiLang, setUiLang] = useState<Lang>("en");

  // ✅ PhaseA: 可観測性（スマホだけログイン後に戻れない/セッションが残らない原因を一撃で特定する）
  const [debugLine, setDebugLine] = useState<string>("");

  // ✅ 二重遷移の抑止（/signin で session 確定後に一度だけ /chat へ）
  const redirectingRef = useRef(false);

  // ✅ OAuth復帰（?code/?error）中は “中継ページ” として扱い、UIを見せない
  const [hasOauthParams, setHasOauthParams] = useState(false);

  // ✅ OAuth中継が長引いた時に“閉じ込め”を解除するためのタイムアウト管理
  const oauthStartedAtRef = useRef<number>(0);
  const oauthTimeoutTimerRef = useRef<number | null>(null);

  // ✅ 無効な refresh token を何度も踏まないように、同一マウント中の掃除連打を抑止
  const localSessionResettingRef = useRef(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem("hopy_lang") || "";
      setUiLang(safeLang(String(saved).toLowerCase()));
    } catch {}
  }, []);

  // ✅ session のOK判定（user.id + access_token で収束）
  function isSessionOkNow(session: any): boolean {
    return Boolean(session?.user?.id) && Boolean(String(session?.access_token ?? "").trim());
  }

  const pushDebug = (piece: string) => {
    if (!piece) return;
    setDebugLine((prev) => {
      const base = String(prev ?? "").trim();
      if (!base) return piece;
      if (base.includes(piece)) return base;
      return `${base} · ${piece}`;
    });
  };

  // ✅ Supabaseのローカル認証断片を掃除
  // - 2回目ログイン以降に Invalid Refresh Token を踏み続ける症状をここで止める
  const resetLocalSessionArtifacts = async (reason: string) => {
    if (localSessionResettingRef.current) return;
    localSessionResettingRef.current = true;

    try {
      pushDebug(`reset:${reason}`);

      try {
        await supabase.auth.signOut({ scope: "local" });
      } catch {}

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

            // ✅ Supabase標準キー/カスタムキーの取りこぼしを減らす
            if (
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
    } finally {
      localSessionResettingRef.current = false;
    }
  };

  // ✅ URLに code があるのに session がまだ取れない時の “確定待ち”
  // ※「累積待ち」にならないよう、短い間隔でポーリングする
  const waitForSessionSettled = async (alive: () => boolean) => {
    const waits = [0, 80, 160, 260, 420, 650, 900, 1200, 1600, 2100, 2750, 3400];
    for (let i = 0; i < waits.length; i++) {
      if (!alive()) return null;
      if (waits[i] > 0) await sleep(waits[i]);
      if (!alive()) return null;

      try {
        const { data, error } = await supabase.auth.getSession();

        if (error) {
          const message = errText(error);
          if (isInvalidRefreshTokenErrorMessage(message)) {
            await resetLocalSessionArtifacts("poll-invalid-refresh");
            return null;
          }
        }

        const s = data.session ?? null;
        if (isSessionOkNow(s)) return s;
      } catch (e) {
        const message = errText(e);
        if (isInvalidRefreshTokenErrorMessage(message)) {
          await resetLocalSessionArtifacts("poll-throw-invalid-refresh");
          return null;
        }
      }
    }
    return null;
  };

  // ✅ code を見たら処理後にURLから消す（戻る/再読み込みでループしない）
  // ※ 重要：掃除したら hasOauthParams も false に戻して “白画面固定” を防ぐ
  const clearOauthParamsFromUrl = () => {
    try {
      const url = new URL(location.href);
      const sp = url.searchParams;

      const had = sp.has("code") || sp.has("error") || sp.has("error_description") || sp.has("state");
      if (!had) return false;

      sp.delete("code");
      sp.delete("error");
      sp.delete("error_description");
      sp.delete("state");

      const next = `${url.pathname}${sp.toString() ? `?${sp.toString()}` : ""}${url.hash || ""}`;
      history.replaceState(null, "", next);

      // ✅ UIを戻せるように state も戻す
      try {
        setHasOauthParams(false);
      } catch {}

      return true;
    } catch {
      return false;
    }
  };

  const goChatOnce = () => {
    if (redirectingRef.current) return;
    redirectingRef.current = true;
    try {
      location.replace("/chat");
    } catch {
      redirectingRef.current = false;
    }
  };

  // ✅ すでにログイン済み / OAuth復帰直後 / 遅延セッション確定 をすべて /chat へ寄せる
  useEffect(() => {
    let alive = true;
    const isAlive = () => alive;

    const sp = new URLSearchParams(typeof location !== "undefined" ? location.search : "");
    const hasCode = sp.has("code");
    const hasError = sp.has("error") || sp.has("error_description");

    setHasOauthParams(Boolean(hasCode || hasError));

    // ✅ OAuth復帰が長引いた場合の“閉じ込め解除”
    try {
      if (Boolean(hasCode || hasError)) {
        oauthStartedAtRef.current = Date.now();
        if (oauthTimeoutTimerRef.current != null) {
          window.clearTimeout(oauthTimeoutTimerRef.current);
          oauthTimeoutTimerRef.current = null;
        }
        oauthTimeoutTimerRef.current = window.setTimeout(() => {
          if (!alive) return;

          // URL掃除（できるだけ）→ UI復帰
          try {
            clearOauthParamsFromUrl();
          } catch {}

          try {
            setHasOauthParams(false);
          } catch {}

          try {
            setBusy(false);
          } catch {}

          try {
            setDebugLine((prev) => {
              const base = String(prev ?? "").trim();
              const piece = "oauth:timeout";
              if (!base) return piece;
              if (base.includes(piece)) return base;
              return `${base} · ${piece}`;
            });
          } catch {}
        }, 6000);
      } else {
        oauthStartedAtRef.current = 0;
        if (oauthTimeoutTimerRef.current != null) {
          window.clearTimeout(oauthTimeoutTimerRef.current);
          oauthTimeoutTimerRef.current = null;
        }
      }
    } catch {}

    const lsOk = canUseStorage("localStorage");
    const ssOk = canUseStorage("sessionStorage");

    const setDebug = (parts: string[]) => {
      try {
        setDebugLine(parts.filter(Boolean).join(" · "));
      } catch {}
    };

    const updateBaseDebug = (uid: string) => {
      setDebug([
        `ls:${lsOk ? "ok" : "ng"}`,
        `ss:${ssOk ? "ok" : "ng"}`,
        `code:${hasCode ? "yes" : "no"}`,
        `err:${hasError ? "yes" : "no"}`,
        `sess:${uid ? "yes" : "no"}`,
      ]);
    };

    updateBaseDebug("");

    const tryGoChatFromSession = async (reason: string) => {
      try {
        const { data, error } = await supabase.auth.getSession();
        if (!isAlive()) return false;

        if (error) {
          const message = errText(error);
          if (isInvalidRefreshTokenErrorMessage(message)) {
            pushDebug("gs:invalid-refresh");
            await resetLocalSessionArtifacts("mount-invalid-refresh");
            updateBaseDebug("");
            return false;
          }
          pushDebug("gs:err");
        }

        const s = data.session ?? null;
        const uid = String(s?.user?.id ?? "");
        const ok = isSessionOkNow(s);

        updateBaseDebug(ok ? uid : "");

        if (ok) {
          pushDebug(`go:${reason}`);
          clearOauthParamsFromUrl();
          goChatOnce();
          return true;
        }

        return false;
      } catch (e) {
        const message = errText(e);
        if (isInvalidRefreshTokenErrorMessage(message)) {
          pushDebug("gs:throw-invalid-refresh");
          await resetLocalSessionArtifacts("mount-throw-invalid-refresh");
          updateBaseDebug("");
          return false;
        }
        pushDebug("gs:throw");
        return false;
      }
    };

    (async () => {
      try {
        const firstHit = await tryGoChatFromSession("mount");
        if (!isAlive() || firstHit) return;

        // ✅ code があるのに session が無い場合：
        // - detectSessionInUrl に任せる（手動exchangeは二重化し得るため行わない）
        // - ここでは session の確定待ちだけ行う
        if (hasCode) {
          const settled = await waitForSessionSettled(isAlive);
          if (!isAlive()) return;

          const uid = String(settled?.user?.id ?? "");
          const ok = isSessionOkNow(settled);

          updateBaseDebug(ok ? uid : "");

          // ✅ 判定後は必ずURL掃除（UI固定化防止）
          clearOauthParamsFromUrl();

          if (ok) {
            pushDebug("go:poll");
            goChatOnce();
            return;
          }

          // ✅ session が取れなかった場合：
          // - stale token の残留を止めた上で signin UI に戻す
          pushDebug("poll:miss");
          try {
            await resetLocalSessionArtifacts("poll-miss");
          } catch {}
          try {
            setHasOauthParams(false);
          } catch {}
          try {
            setBusy(false);
          } catch {}
          return;
        }

        // code / error が付いて戻ってきたが session が無い場合も、URLだけは掃除しておく（UI固定化を防ぐ）
        if (hasCode || hasError) {
          clearOauthParamsFromUrl();
          pushDebug("cb:clean");
          try {
            setHasOauthParams(false);
          } catch {}
          try {
            setBusy(false);
          } catch {}
        }
      } catch (e) {
        const message = errText(e);
        if (isInvalidRefreshTokenErrorMessage(message)) {
          pushDebug("mount:invalid-refresh");
          try {
            await resetLocalSessionArtifacts("mount-catch-invalid-refresh");
          } catch {}
        } else {
          pushDebug("mount:throw");
        }
        try {
          setHasOauthParams(false);
        } catch {}
        try {
          setBusy(false);
        } catch {}
      }
    })();

    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (!isAlive()) return;

      const uid = String(session?.user?.id ?? "");
      const ok = isSessionOkNow(session);

      updateBaseDebug(ok ? uid : "");
      pushDebug(`ev:${String(event ?? "").toLowerCase() || "unknown"}`);

      // ✅ mount 時点では無かった session が後から来ても必ず /chat
      if (ok) {
        clearOauthParamsFromUrl();
        goChatOnce();
      }
    });

    return () => {
      alive = false;

      try {
        if (oauthTimeoutTimerRef.current != null) {
          window.clearTimeout(oauthTimeoutTimerRef.current);
          oauthTimeoutTimerRef.current = null;
        }
      } catch {}

      try {
        sub.subscription.unsubscribe();
      } catch {}
    };
  }, []);

  const copy = useMemo(() => {
    const en = uiLang === "en";
    return {
      title: en ? "Sign in" : "ログイン",
      eyebrow: en ? "Welcome to HOPY" : "HOPYへようこそ",
      lead: en
        ? "Continue with Google to open your quiet workspace."
        : "Googleで続行して、静かなHOPYワークスペースを開きます。",
      btn: en ? "Continue with Google" : "Googleで続行",
      btnBusy: en ? "Continuing…" : "続行中…",
      note: en
        ? "After sign in, you'll be redirected back to the app automatically."
        : "ログイン後、自動的にアプリへ戻ります。",
      subNote: en
        ? "A calm place to organize your thoughts and find your next step."
        : "考えを整理し、次の一歩を見つけるための静かな場所です。",
      debugPrefix: en ? "status:" : "状態:",
      redirecting: en ? "Redirecting…" : "移動中…",
    };
  }, [uiLang]);

  const shellStyle: React.CSSProperties = {
    minHeight: "100dvh",
    width: "100%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "32px 20px",
    background:
      "radial-gradient(circle at top, rgba(17,24,39,0.04), transparent 32%), linear-gradient(180deg, #ffffff 0%, #fbfbf9 100%)",
  };

  const cardStyle: React.CSSProperties = {
    width: "100%",
    maxWidth: 520,
    borderRadius: 28,
    padding: "32px 24px",
    background: "rgba(255,255,255,0.92)",
    border: "1px solid rgba(17,24,39,0.08)",
    boxShadow: "0 20px 60px rgba(17,24,39,0.06)",
    backdropFilter: "blur(10px)",
  };

  const badgeStyle: React.CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
    padding: "8px 12px",
    borderRadius: 999,
    border: "1px solid rgba(17,24,39,0.08)",
    background: "rgba(255,255,255,0.9)",
    fontSize: 12,
    lineHeight: 1,
    letterSpacing: "0.08em",
    textTransform: "uppercase",
    color: "rgba(17,24,39,0.72)",
  };

  const titleStyle: React.CSSProperties = {
    margin: "18px 0 10px",
    fontSize: "clamp(28px, 4vw, 38px)",
    lineHeight: 1.12,
    letterSpacing: "-0.04em",
    color: "#111827",
    fontWeight: 600,
  };

  const leadStyle: React.CSSProperties = {
    margin: 0,
    fontSize: 15,
    lineHeight: 1.8,
    color: "rgba(17,24,39,0.72)",
  };

  const buttonStyle: React.CSSProperties = {
    width: "100%",
    minHeight: 56,
    marginTop: 24,
    padding: "0 18px",
    borderRadius: 18,
    border: "1px solid rgba(17,24,39,0.10)",
    background: "#ffffff",
    color: "#111827",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    fontSize: 15,
    fontWeight: 600,
    letterSpacing: "-0.01em",
    boxShadow: "0 10px 30px rgba(17,24,39,0.05)",
    cursor: busy ? "default" : "pointer",
    opacity: busy ? 0.72 : 1,
    transition: "transform 160ms ease, box-shadow 160ms ease, opacity 160ms ease",
  };

  const noteStyle: React.CSSProperties = {
    marginTop: 16,
    fontSize: 13,
    lineHeight: 1.7,
    color: "rgba(17,24,39,0.56)",
  };

  const subNoteStyle: React.CSSProperties = {
    marginTop: 20,
    paddingTop: 18,
    borderTop: "1px solid rgba(17,24,39,0.06)",
    fontSize: 13,
    lineHeight: 1.8,
    color: "rgba(17,24,39,0.60)",
  };

  const debugStyle: React.CSSProperties = {
    marginTop: 12,
    paddingTop: 12,
    borderTop: "1px dashed rgba(17,24,39,0.08)",
    fontSize: 12,
    lineHeight: 1.7,
    color: "rgba(17,24,39,0.52)",
    wordBreak: "break-word",
  };

  const redirectWrapStyle: React.CSSProperties = {
    minHeight: "100dvh",
    width: "100%",
    background: "linear-gradient(180deg, #ffffff 0%, #fbfbf9 100%)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  };

  const redirectCardStyle: React.CSSProperties = {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 14,
    padding: "24px 28px",
    borderRadius: 24,
    background: "rgba(255,255,255,0.92)",
    border: "1px solid rgba(17,24,39,0.06)",
    boxShadow: "0 16px 40px rgba(17,24,39,0.05)",
  };

  const redirectDotRowStyle: React.CSSProperties = {
    display: "flex",
    gap: 8,
    alignItems: "center",
    justifyContent: "center",
  };

  const redirectDotStyle: React.CSSProperties = {
    width: 8,
    height: 8,
    borderRadius: 999,
    background: "rgba(17,24,39,0.26)",
  };

  const onKeyDown: React.KeyboardEventHandler<HTMLElement> = (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      login();
    }
  };

  // ✅ OAuth復帰や自動遷移の最中は “見せない”
  // - ここが「一瞬ダサい画面」の主因になりやすいので無地化する
  // - ただし OAuth パラメータを掃除した後は hasOauthParams=false に戻るので “白固定” しない
  const shouldHideUi = Boolean(hasOauthParams || redirectingRef.current);

  if (shouldHideUi) {
    return (
      <main aria-label="signin-redirect" onKeyDown={onKeyDown} style={redirectWrapStyle}>
        <div style={redirectCardStyle}>
          <div style={redirectDotRowStyle} aria-hidden="true">
            <span style={redirectDotStyle} />
            <span style={redirectDotStyle} />
            <span style={redirectDotStyle} />
            <span style={redirectDotStyle} />
            <span style={redirectDotStyle} />
          </div>
          <div style={{ fontSize: 13, letterSpacing: "0.04em", opacity: 0.6 }}>HOPY</div>
          <div style={{ fontSize: 14, color: "rgba(17,24,39,0.72)" }}>{copy.redirecting}</div>
        </div>
      </main>
    );
  }

  const showDebug = Boolean(debugLine);

  return (
    <main className={styles.main} onKeyDown={onKeyDown} style={shellStyle}>
      <div className={styles.card} aria-busy={busy} style={cardStyle}>
        <div style={badgeStyle}>
          <span
            aria-hidden="true"
            style={{
              width: 8,
              height: 8,
              borderRadius: 999,
              background: "rgba(17,24,39,0.32)",
              display: "inline-block",
            }}
          />
          <span>{copy.eyebrow}</span>
        </div>

        <h1 className={styles.h1} style={titleStyle}>
          {copy.title}
        </h1>

        <p className={styles.p} style={leadStyle}>
          {copy.lead}
        </p>

        <button
          className={styles.btn}
          onClick={login}
          disabled={busy}
          aria-disabled={busy}
          aria-live="polite"
          style={buttonStyle}
        >
          <GoogleIcon />
          <span>{busy ? copy.btnBusy : copy.btn}</span>
        </button>

        <div className={styles.note} style={noteStyle}>
          {copy.note}
        </div>

        <div style={subNoteStyle}>{copy.subNote}</div>

        {showDebug ? (
          <div className={styles.note} style={debugStyle}>
            {copy.debugPrefix} {debugLine}
          </div>
        ) : null}
      </div>
    </main>
  );
}

/*
このファイルの正式役割:
Google OAuth の開始・復帰・セッション確定・/chat への遷移を担う /signin ページ本体です。
同時に、サインイン画面の主表示UIを持つファイルです。
*/

/*
【今回このファイルで修正したこと】
/signin の見た目を最小実装のカード表示から、HOPYらしい静かさと上品さを持つ表示へ整えました。
Googleボタンにアイコンを追加し、カードの余白・角丸・背景・補助文言・遷移中UIを整えつつ、
認証ロジックと遷移ロジックには触れていません。
*/