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

  const LOGOUT_REDIRECT_PATH = "/chat";

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
        const ok = Boolean(s?.user?.id) && Boolean(String(s?.access_token ?? "").trim());
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
                  // 以前ログイン済みなら表示は維持
                }
              }

              setAuthReady(true);
              return;
            }

            const uid2 = String(s.user.id ?? "") || null;
            const em2 = String((s.user as any)?.email ?? "");

            signedOutCauseRef.current = false;

            setAuthUserId(uid2);
            setEmail(em2);
            emailRef.current = em2;
            setAuthReady(true);

            const ok = Boolean(uid2) && Boolean(String(s?.access_token ?? "").trim());
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

        const ok = Boolean(uid) && Boolean(String(session?.access_token ?? "").trim());
        setSessionOk(ok);
        if (ok) setLogoutRedirecting(false);
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

      if (event === "SIGNED_OUT" || event === "USER_DELETED") {
        signedOutCauseRef.current = true;
        clearTransientTimer();

        const uid = String(session?.user?.id ?? "") || null;
        const em = String(session?.user?.email ?? "");

        setAuthUserId(uid);
        setEmail(em);
        emailRef.current = em;
        setAuthReady(true);
        setSessionOk(false);
        setLogoutRedirecting(true);

        if (!session) {
          if (didSignOutRedirectRef.current) return;
          didSignOutRedirectRef.current = true;

          microtask(() => {
            try {
              if (typeof window !== "undefined") {
                window.location.replace(LOGOUT_REDIRECT_PATH);
                return;
              }
            } catch {}

            try {
              router.replace(LOGOUT_REDIRECT_PATH);
            } catch {
              try {
                window.location.href = LOGOUT_REDIRECT_PATH;
              } catch {}
            }
          });
        }

        return;
      }

      if (session?.user) {
        clearTransientTimer();

        const uid = String(session.user.id ?? "") || null;
        const em = String((session.user as any)?.email ?? "");

        setAuthUserId(uid);
        setEmail(em);
        emailRef.current = em;
        setAuthReady(true);

        if (didSignOutRedirectRef.current) {
          didSignOutRedirectRef.current = false;
        }

        const tokenOk = Boolean(String((session as any)?.access_token ?? "").trim());
        if (uid && tokenOk) {
          setSessionOk(true);
          setLogoutRedirecting(false);
        } else {
          setSessionOk(false);

          (async () => {
            const ok = await waitForSessionOk(() => alive);
            if (!alive) return;

            if (ok) {
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

  const hasChatIdentity = useMemo(() => {
    return Boolean(String(authUserId ?? "").trim()) || Boolean(String(emailRef.current ?? "").trim());
  }, [authUserId]);

  const displayLoggedIn = useMemo(() => {
    if (!authReady) return false;
    if (loggedIn) return true;
    if (logoutRedirecting && signedOutCauseRef.current) return false;
    return !signedOutCauseRef.current && hasChatIdentity;
  }, [authReady, loggedIn, logoutRedirecting, hasChatIdentity]);

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