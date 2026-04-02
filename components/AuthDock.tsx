"use client";

import {
  useEffect,
  useMemo,
  useState,
  forwardRef,
  useImperativeHandle,
} from "react";
import { supabase } from "@/lib/supabaseClient";
import type { Lang } from "@/components/LangToggle";
import AuthModal from "@/components/AuthModal";

export type AuthDockHandle = {
  open: () => void;
};

type AuthState = {
  loading: boolean;
  isAuthed: boolean;
  email?: string;
};

function getRedirectTo() {
  if (typeof window === "undefined") return undefined;
  return window.location.origin;
}

function initialFromEmail(email?: string) {
  const e = String(email ?? "").trim();
  if (!e) return "";
  const head = e.split("@")[0] ?? "";
  const ch = head.trim().charAt(0);
  return ch ? ch.toUpperCase() : "";
}

const AuthDock = forwardRef<AuthDockHandle, { lang: Lang }>(
  function AuthDock({ lang }, ref) {
    const [open, setOpen] = useState(false);
    const [state, setState] = useState<AuthState>({
      loading: true,
      isAuthed: false,
      email: undefined,
    });

    useImperativeHandle(ref, () => ({
      open: () => setOpen(true),
    }));

    useEffect(() => {
      let mounted = true;

      const init = async () => {
        const { data } = await supabase.auth.getSession();
        const user = data.session?.user ?? null;
        if (!mounted) return;
        setState({
          loading: false,
          isAuthed: !!user,
          email: user?.email ?? undefined,
        });
      };

      init();

      const { data: sub } = supabase.auth.onAuthStateChange(
        (_evt, session) => {
          const user = session?.user ?? null;
          setState({
            loading: false,
            isAuthed: !!user,
            email: user?.email ?? undefined,
          });
        }
      );

      return () => {
        mounted = false;
        sub.subscription.unsubscribe();
      };
    }, []);

    async function signInGoogle() {
      await supabase.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: getRedirectTo() },
      });
    }

    async function signOut() {
      await supabase.auth.signOut();
      setOpen(false);
    }

    const badge = useMemo(
      () => initialFromEmail(state.email),
      [state.email]
    );

    return (
      <>
        <button
          type="button"
          className="auth-orb"
          onClick={() => setOpen(true)}
          disabled={state.loading}
        >
          <span className="auth-orb-inner">
            {state.isAuthed ? (
              <span className="auth-orb-badge">
                {badge || "●"}
              </span>
            ) : (
              <span className="auth-orb-empty" />
            )}
          </span>
        </button>

        <AuthModal
          open={open}
          onClose={() => setOpen(false)}
          lang={lang}
          isAuthed={state.isAuthed}
          email={state.email}
          onSignIn={signInGoogle}
          onSignOut={signOut}
        />
      </>
    );
  }
);

export default AuthDock;
