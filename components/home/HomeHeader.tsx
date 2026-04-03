// /components/home/HomeHeader.tsx
"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useLang } from "@/components/site/LangProvider";
import styles from "./HomeHeader.module.css";

type HomeHeaderProps = {
  authHref?: string;
  chatHref?: string;
  isSignedIn?: boolean;
};

export default function HomeHeader({
  authHref = "/signin",
  chatHref = "/chat",
  isSignedIn = false,
}: HomeHeaderProps) {
  const { uiLang2, setLang } = useLang();
  const isJa = uiLang2 === "ja";

  const [signedIn, setSignedIn] = useState<boolean>(isSignedIn);

  useEffect(() => {
    let mounted = true;

    function applySignedOut() {
      if (!mounted) return;
      setSignedIn(false);
    }

    function applySession(session: any) {
      if (!mounted) return;
      const hasUser = Boolean(session?.user?.email || session?.user?.id);
      setSignedIn(hasUser);
    }

    (async () => {
      try {
        const { data } = await supabase.auth.getSession();
        if (!mounted) return;

        if (!data?.session) {
          applySignedOut();
          return;
        }

        applySession(data.session);
      } catch {
        applySignedOut();
      }
    })();

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) {
        applySignedOut();
        return;
      }
      applySession(session);
    });

    return () => {
      mounted = false;
      try {
        sub?.subscription?.unsubscribe();
      } catch {}
    };
  }, []);

  const actionHref = useMemo(() => {
    return signedIn ? chatHref : authHref;
  }, [signedIn, chatHref, authHref]);

  const actionLabel = signedIn ? "Go to Chat" : "Sign in";

  return (
    <header className={styles.header}>
      <div className={styles.inner}>
        <Link href="/" aria-label="HOPY Home" className={styles.brand}>
          <Image
            src="/brand/hopy-icon-master.svg"
            alt=""
            className={styles.brandIcon}
            width={20}
            height={20}
            aria-hidden="true"
            priority
          />
          <span className={styles.brandText}>HOPY</span>
        </Link>

        <div className={styles.actions}>
          <div className={styles.language} aria-label="Language">
            <button
              type="button"
              className={`${styles.langButton} ${isJa ? styles.langActive : ""}`}
              aria-pressed={isJa}
              onClick={() => setLang("ja")}
            >
              ja
            </button>
            <span className={styles.langSeparator} aria-hidden="true">
              /
            </span>
            <button
              type="button"
              className={`${styles.langButton} ${!isJa ? styles.langActive : ""}`}
              aria-pressed={!isJa}
              onClick={() => setLang("en")}
            >
              en
            </button>
          </div>

          <Link href={actionHref} className={styles.signIn}>
            {actionLabel}
          </Link>
        </div>
      </div>
    </header>
  );
}

/*
このファイルの正式役割:
トップページヘッダーのブランド表示、言語切替、サインイン導線を表示するファイル。

【今回このファイルで修正したこと】
ヘッダー左側ロゴを HopyCompassIcon 固定表示から外し、
public/brand/hopy-icon-master.svg を直接表示するように変更しました。
*/