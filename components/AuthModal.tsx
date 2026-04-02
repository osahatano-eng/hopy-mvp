"use client";

import { useEffect, useMemo, useRef } from "react";
import type { Lang } from "@/components/LangToggle";

export default function AuthModal({
  open,
  onClose,
  lang,
  isAuthed,
  email,
  onSignIn,
  onSignOut,
}: {
  open: boolean;
  onClose: () => void;
  lang: Lang;
  isAuthed: boolean;
  email?: string;
  onSignIn: () => void;
  onSignOut: () => void;
}) {
  const panelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);

    // 軽くフォーカスを入れる（過剰なトラップはしない）
    setTimeout(() => panelRef.current?.focus(), 0);

    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const copy = useMemo(() => {
    if (lang === "ja") {
      return {
        title: "思考は、続きがあっていい。",
        sub: "この先も、同じ場所から続きを始められます。",
        cta: "Googleで続ける",
        note: "あなたのペースで大丈夫です。",
        signedIn: "ログイン中",
        signOut: "ログアウト",
        close: "閉じる",
      };
    }
    return {
      title: "Your thinking deserves continuity.",
      sub: "Continue from the same place—across devices.",
      cta: "Continue with Google",
      note: "Go at your pace.",
      signedIn: "Signed in",
      signOut: "Sign out",
      close: "Close",
    };
  }, [lang]);

  if (!open) return null;

  return (
    <div className="auth-modal" role="dialog" aria-modal="true">
      <button
        type="button"
        className="auth-backdrop"
        aria-label={copy.close}
        onClick={onClose}
      />

      <div
        className="auth-panel"
        ref={panelRef}
        tabIndex={-1}
        aria-label="Authentication"
      >
        <div className="auth-top">
          <div className="auth-kicker" aria-hidden>
            HOPY
          </div>
          <button
            type="button"
            className="auth-x"
            aria-label={copy.close}
            onClick={onClose}
          >
            ×
          </button>
        </div>

        <div className="auth-title">{copy.title}</div>
        <div className="auth-sub">{copy.sub}</div>

        {isAuthed ? (
          <div className="auth-signed">
            <div className="auth-signed-row">
              <span className="auth-pill">{copy.signedIn}</span>
              <span className="auth-email">{email || ""}</span>
            </div>

            <button type="button" className="auth-ghost" onClick={onSignOut}>
              {copy.signOut}
            </button>
          </div>
        ) : (
          <button type="button" className="auth-cta" onClick={onSignIn}>
            <span className="auth-cta-g" aria-hidden>
              G
            </span>
            <span>{copy.cta}</span>
          </button>
        )}

        <div className="auth-note">{copy.note}</div>
      </div>
    </div>
  );
}
