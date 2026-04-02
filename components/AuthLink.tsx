"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import type { Lang } from "@/components/LangToggle";

type AuthState = {
  loading: boolean;
  isAuthed: boolean;
  email?: string;
};

function getRedirectTo() {
  if (typeof window === "undefined") return undefined;
  // ローカルも本番も、今いる origin に戻す（Supabase側のRedirect URL許可が必要）
  return window.location.origin;
}

export default function AuthLink({
  lang,
  className = "",
}: {
  lang: Lang;
  className?: string;
}) {
  const [state, setState] = useState<AuthState>({
    loading: true,
    isAuthed: false,
  });

  const label = useMemo(() => {
    if (state.loading) return lang === "ja" ? "…" : "…";
    if (state.isAuthed) return lang === "ja" ? "ログアウト" : "Sign out";
    return lang === "ja" ? "ログイン" : "Sign in";
  }, [lang, state.loading, state.isAuthed]);

  useEffect(() => {
    let mounted = true;

    const init = async () => {
      try {
        const { data } = await supabase.auth.getSession();
        const user = data.session?.user ?? null;
        if (!mounted) return;

        setState({
          loading: false,
          isAuthed: !!user,
          email: user?.email ?? undefined,
        });
      } catch {
        if (!mounted) return;
        setState({ loading: false, isAuthed: false });
      }
    };

    init();

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      const user = session?.user ?? null;
      setState({
        loading: false,
        isAuthed: !!user,
        email: user?.email ?? undefined,
      });
    });

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  async function signInGoogle() {
    // “リンク”として軽く見せるが、動きは確実に
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: getRedirectTo(),
      },
    });
  }

  async function signOut() {
    await supabase.auth.signOut();
  }

  const title =
    state.isAuthed && state.email
      ? state.email
      : lang === "ja"
      ? "Googleでログイン"
      : "Sign in with Google";

  return (
    <button
      type="button"
      className={`auth-link ${className}`}
      onClick={state.isAuthed ? signOut : signInGoogle}
      disabled={state.loading}
      aria-label={title}
      title={title}
    >
      {/* 小さな“G”の気配だけ。主張しない。 */}
      {!state.isAuthed ? (
        <span className="auth-g" aria-hidden>
          G
        </span>
      ) : null}
      <span className="auth-text">{label}</span>
    </button>
  );
}
