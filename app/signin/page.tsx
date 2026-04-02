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
      lead: en ? "Continue with Google to open your workspace." : "Googleで続行して、HOPYワークスペースを開きます。",
      btn: en ? "Continue with Google" : "Googleで続行",
      btnBusy: en ? "Continuing…" : "続行中…",
      note: en ? "You'll be redirected back to the app." : "ログイン後、自動的にアプリへ戻ります。",
      debugPrefix: en ? "status:" : "状態:",
      redirecting: en ? "Redirecting…" : "移動中…",
    };
  }, [uiLang]);

  const login = async () => {
    if (busy) return;
    setBusy(true);
    try {
      // ✅ 再ログイン前にクライアント側の古い認証断片を除去
      // - 初回成功後に stale refresh token が残って2回目以降を壊す症状を防ぐ
      await resetLocalSessionArtifacts("before-login");

      await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          // ✅ 重要：まず /signin に戻して “session確定” をここで吸収してから /chat へ送る
          redirectTo: `${location.origin}/signin`,
        },
      });

      // signInWithOAuth は基本的にここで別画面遷移が始まる想定。
      // 連打抑止のため busy は戻さない（戻すと連打で複数タブ/遷移が起きる）
    } catch (e) {
      const message = errText(e);
      if (isInvalidRefreshTokenErrorMessage(message)) {
        try {
          await resetLocalSessionArtifacts("login-invalid-refresh");
        } catch {}
      }
      // 例外時のみ戻す（ユーザーがやり直せるように）
      setBusy(false);
    }
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
      <main
        aria-label="signin-redirect"
        onKeyDown={onKeyDown}
        style={{
          minHeight: "100dvh",
          width: "100%",
          background: "var(--paper, #ffffff)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: 24,
        }}
      >
        <div style={{ fontSize: 13, opacity: 0.55 }}>{copy.redirecting}</div>
      </main>
    );
  }

  return (
    <main className={styles.main} onKeyDown={onKeyDown}>
      <div className={styles.card} aria-busy={busy}>
        <div className={styles.badge}>HOPY</div>
        <h1 className={styles.h1}>{copy.title}</h1>
        <p className={styles.p}>{copy.lead}</p>

        <button className={styles.btn} onClick={login} disabled={busy} aria-disabled={busy} aria-live="polite">
          {busy ? copy.btnBusy : copy.btn}
        </button>

        <div className={styles.note}>{copy.note}</div>

        {debugLine ? (
          <div className={styles.note} style={{ marginTop: 10, opacity: 0.72 }}>
            {copy.debugPrefix} {debugLine}
          </div>
        ) : null}
      </div>
    </main>
  );
}