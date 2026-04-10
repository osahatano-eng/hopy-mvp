// /components/chat/lib/useChatAuth.ts
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { SupabaseClient } from "@supabase/supabase-js";
import { microtask } from "./debugTools";

type Params = {
  supabase: SupabaseClient;
  setEmail: (v: string) => void;
};

export function useChatAuth({ supabase, setEmail }: Params) {
  const router = useRouter();

  const LOGOUT_REDIRECT_PATH = "/";
  const LOGOUT_REDIRECT_MARKER_KEY = "hopy_logout_redirect_pending_at";
  const LOGOUT_REDIRECT_MARKER_TTL_MS = 10_000;

  const didSignOutRedirectRef = useRef(false);
  const lastAuthEventRef = useRef<string>("");
  const signedOutCauseRef = useRef(false);

  const transientNullTimerRef = useRef<number | null>(null);
  const transientNullInFlightRef = useRef(false);

  const [authReady, setAuthReady] = useState(false);
  const [authUserId, setAuthUserId] = useState<string | null>(null);

  const authUserIdRef = useRef<string | null>(null);
  useEffect(() => {
    authUserIdRef.current = authUserId;
  }, [authUserId]);

  const emailRef = useRef<string>("");

  const [sessionOk, setSessionOk] = useState(false);
  const sessionOkRef = useRef(false);
  useEffect(() => {
    sessionOkRef.current = sessionOk;
  }, [sessionOk]);

  const [logoutRedirecting, setLogoutRedirecting] = useState(false);

  const markLogoutRedirectPending = () => {
    if (typeof window === "undefined") return;
    try {
      window.sessionStorage.setItem(
        LOGOUT_REDIRECT_MARKER_KEY,
        String(Date.now()),
      );
    } catch {}
  };

  const clearLogoutRedirectPending = () => {
    if (typeof window === "undefined") return;
    try {
      window.sessionStorage.removeItem(LOGOUT_REDIRECT_MARKER_KEY);
    } catch {}
  };

  const hasFreshLogoutRedirectPending = () => {
    if (typeof window === "undefined") return false;

    try {
      const raw = window.sessionStorage.getItem(LOGOUT_REDIRECT_MARKER_KEY);
      const at = Number(raw ?? "");
      if (!Number.isFinite(at) || at <= 0) {
        window.sessionStorage.removeItem(LOGOUT_REDIRECT_MARKER_KEY);
        return false;
      }

      const age = Date.now() - at;
      if (age < 0 || age > LOGOUT_REDIRECT_MARKER_TTL_MS) {
        window.sessionStorage.removeItem(LOGOUT_REDIRECT_MARKER_KEY);
        return false;
      }

      return true;
    } catch {
      return false;
    }
  };

  const redirectToLogoutPath = () => {
    if (didSignOutRedirectRef.current) return;
    didSignOutRedirectRef.current = true;

    microtask(() => {
      try {
        if (typeof window !== "undefined") {
          if (window.location.pathname !== LOGOUT_REDIRECT_PATH) {
            window.location.replace(LOGOUT_REDIRECT_PATH);
            return;
          }
        }
      } catch {}

      try {
        router.replace(LOGOUT_REDIRECT_PATH);
      } catch {
        try {
          if (typeof window !== "undefined") {
            window.location.href = LOGOUT_REDIRECT_PATH;
          }
        } catch {}
      }
    });
  };

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      if ("scrollRestoration" in history) {
        history.scrollRestoration = "manual";
      }
    } catch {}
  }, []);

  const waitForSessionOk = async (alive: () => boolean) => {
    const waits = [0, 60, 120, 200, 320, 480, 700, 1000];

    for (let i = 0; i < waits.length; i++) {
      if (!alive()) return false;

      if (waits[i] > 0) {
        try {
          await new Promise((r) => setTimeout(r, waits[i]));
        } catch {}
      }

      if (!alive()) return false;

      try {
        const { data } = await supabase.auth.getSession();
        const s = data?.session ?? null;
        const ok =
          Boolean(s?.user?.id) &&
          Boolean(String(s?.access_token ?? "").trim());
        if (ok) return true;
      } catch {}
    }

    return false;
  };

  useEffect(() => {
    let alive = true;

    (async () => {
      try {
        if (!authReady) return;
        if (!authUserId) return;
        if (sessionOkRef.current) return;

        const ok = await waitForSessionOk(() => alive);
        if (!alive) return;

        if (ok) {
          clearLogoutRedirectPending();
          setSessionOk(true);
          setLogoutRedirecting(false);
        }
      } catch {}
    })();

    return () => {
      alive = false;
    };
  }, [authReady, authUserId, supabase]);

  useEffect(() => {
    let alive = true;

    const clearTransientTimer = () => {
      try {
        const t = transientNullTimerRef.current;
        if (t != null) window.clearTimeout(t);
      } catch {}
      transientNullTimerRef.current = null;
      transientNullInFlightRef.current = false;
    };

    const scheduleConfirmNoSession = () => {
      if (!alive) return;
      if (transientNullTimerRef.current != null) return;

      try {
        transientNullTimerRef.current = window.setTimeout(async () => {
          transientNullTimerRef.current = null;
          if (!alive) return;

          if (transientNullInFlightRef.current) return;
          transientNullInFlightRef.current = true;

          try {
            const { data } = await supabase.auth.getSession();
            if (!alive) return;

            const s = data?.session ?? null;

            if (!s?.user) {
              const shouldContinueLogoutRedirect =
                hasFreshLogoutRedirectPending();

              if (signedOutCauseRef.current) {
                setAuthUserId(null);
                setEmail("");
                emailRef.current = "";
                setSessionOk(false);
              } else {
                const had = Boolean(String(authUserIdRef.current ?? "").trim());
                if (!had) {
                  setAuthUserId(null);
                  setEmail("");
                  emailRef.current = "";
                  setSessionOk(false);
                } else {
                  // 以前ログイン済みなら authUserId は一時維持
                }
              }

              setAuthReady(true);

              if (shouldContinueLogoutRedirect) {
                setLogoutRedirecting(true);
                redirectToLogoutPath();
              }

              return;
            }

            const uid2 = String(s.user.id ?? "") || null;
            const em2 = String((s.user as any)?.email ?? "");

            signedOutCauseRef.current = false;
            clearLogoutRedirectPending();

            setAuthUserId(uid2);
            setEmail(em2);
            emailRef.current = em2;
            setAuthReady(true);

            const ok =
              Boolean(uid2) &&
              Boolean(String(s?.access_token ?? "").trim());
            setSessionOk(ok);
            if (ok) setLogoutRedirecting(false);
          } catch {
          } finally {
            transientNullInFlightRef.current = false;
          }
        }, 320);
      } catch {
        transientNullTimerRef.current = null;
      }
    };

    (async () => {
      try {
        const { data } = await supabase.auth.getSession();
        if (!alive) return;

        const session = data?.session ?? null;
        const uid = String(session?.user?.id ?? "") || null;
        const em = String(session?.user?.email ?? "");

        setAuthUserId(uid);
        setEmail(em);
        emailRef.current = em;

        const ok =
          Boolean(uid) && Boolean(String(session?.access_token ?? "").trim());
        setSessionOk(ok);

        if (ok) {
          clearLogoutRedirectPending();
          setLogoutRedirecting(false);
        } else if (hasFreshLogoutRedirectPending()) {
          setLogoutRedirecting(true);
          redirectToLogoutPath();
        }
      } catch {
      } finally {
        if (alive) setAuthReady(true);
      }
    })();

    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (!alive) return;

      lastAuthEventRef.current = String(event ?? "");

      if (session?.user) {
        signedOutCauseRef.current = false;
      }

      if (event === "SIGNED_OUT") {
        signedOutCauseRef.current = true;
        markLogoutRedirectPending();
        clearTransientTimer();

        setAuthUserId(null);
        setEmail("");
        emailRef.current = "";
        setAuthReady(true);
        setSessionOk(false);
        setLogoutRedirecting(true);

        redirectToLogoutPath();
        return;
      }

      if (session?.user) {
        clearTransientTimer();

        const uid = String(session.user.id ?? "") || null;
        const em = String((session.user as any)?.email ?? "");

        signedOutCauseRef.current = false;
        clearLogoutRedirectPending();

        setAuthUserId(uid);
        setEmail(em);
        emailRef.current = em;
        setAuthReady(true);

        if (didSignOutRedirectRef.current) {
          didSignOutRedirectRef.current = false;
        }

        const tokenOk = Boolean(
          String((session as any)?.access_token ?? "").trim(),
        );
        if (uid && tokenOk) {
          setSessionOk(true);
          setLogoutRedirecting(false);
        } else {
          setSessionOk(false);

          (async () => {
            const ok = await waitForSessionOk(() => alive);
            if (!alive) return;

            if (ok) {
              clearLogoutRedirectPending();
              setSessionOk(true);
              setLogoutRedirecting(false);
            }
          })();
        }

        return;
      }

      setAuthReady(true);
      scheduleConfirmNoSession();
    });

    return () => {
      alive = false;

      try {
        const t = transientNullTimerRef.current;
        if (t != null) window.clearTimeout(t);
      } catch {}

      transientNullTimerRef.current = null;
      transientNullInFlightRef.current = false;

      try {
        sub.subscription.unsubscribe();
      } catch {}
    };
  }, [router, setEmail, supabase]);

  const loggedIn = authReady && Boolean(authUserId) && Boolean(sessionOk);

  const displayLoggedIn = useMemo(() => {
    if (!authReady) return false;
    return loggedIn;
  }, [authReady, loggedIn]);

  const loggedInRef = useRef(false);
  useEffect(() => {
    loggedInRef.current = displayLoggedIn;
  }, [displayLoggedIn]);

  return {
    authReady,
    authUserId,
    sessionOk,
    logoutRedirecting,
    signedOutCauseRef,
    lastAuthEventRef,
    loggedIn,
    displayLoggedIn,
    loggedInRef,
  };
}

/*
このファイルの正式役割
チャット画面の認証状態を監視し、session・logout遷移・表示用ログイン状態を安定して返すためのhook。
*/

/*
【今回このファイルで修正したこと】
1. SIGNED_OUT 時だけに依存せず、「直前に logout 済み」であることを sessionStorage に短時間だけ保持するようにしました。
2. getSession() / 再評価で session なしが確定した場合でも、logout 直後の印が残っていれば / へ再収束するように固定しました。
3. session 復帰成功時は logout 用の印を必ず消し、通常のログイン導線を壊さないようにしました。
4. HOPY回答○ / Compass / state_changed / DB / 左カラム / MEMORIES には触っていません。
*/

/* /components/chat/lib/useChatAuth.ts */