// /components/home/GuestHeroCompass.tsx
"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useLang } from "@/components/site/LangProvider";
import styles from "./GuestHeroCompass.module.css";
import { useRealCompass } from "./useRealCompass";

function normalizeHeading(value: number): number {
  if (!Number.isFinite(value)) return 0;
  const normalized = value % 360;
  return normalized < 0 ? normalized + 360 : normalized;
}

function getShortestAngleDelta(from: number, to: number): number {
  const start = normalizeHeading(from);
  const end = normalizeHeading(to);
  const delta = end - start;

  if (delta > 180) return delta - 360;
  if (delta < -180) return delta + 360;
  return delta;
}

export default function GuestHeroCompass() {
  const { t, uiLang2 } = useLang();
  const { status, smoothedHeading, degreeText, activateCompass } =
    useRealCompass();

  const isBusy = status === "requesting";
  const compassLabel =
    status === "active" && degreeText ? degreeText : "COMPASS";

  const [displayHeading, setDisplayHeading] = useState<number>(0);
  const [isSignedIn, setIsSignedIn] = useState<boolean>(false);
  const lastHeadingRef = useRef<number>(0);

  useEffect(() => {
    const nextHeading = normalizeHeading(smoothedHeading);
    const delta = getShortestAngleDelta(lastHeadingRef.current, nextHeading);

    lastHeadingRef.current = normalizeHeading(nextHeading);
    setDisplayHeading((prev) => prev + delta);
  }, [smoothedHeading]);

  useEffect(() => {
    let mounted = true;

    function applySignedOut() {
      if (!mounted) return;
      setIsSignedIn(false);
    }

    function applySession(session: any) {
      if (!mounted) return;
      const hasUser = Boolean(session?.user?.email || session?.user?.id);
      setIsSignedIn(hasUser);
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

  const ctaHref = isSignedIn ? "/chat" : "/signin";
  const ctaLabel =
    uiLang2 === "ja"
      ? isSignedIn
        ? "チャットへ進む"
        : "サインイン"
      : isSignedIn
        ? "Go to Chat"
        : "Sign in";

  return (
    <main className={styles.page}>
      <section className={styles.hero} aria-label="HOPY hero">
        <div className={styles.inner}>
          <div
            aria-label="Beta notice"
            style={{
              width: "100%",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: 2,
              marginBottom: 18,
              lineHeight: 1.4,
              fontSize: 12,
              color: "rgba(15, 23, 42, 0.62)",
              textAlign: "center",
            }}
          >
            <span>HOPY is currently in beta.</span>
            <span>HOPYは現在β版です。改善を続けています。</span>
          </div>

          <div className={styles.compassWrap}>
            <div className={styles.glow} />

            <button
              type="button"
              className={styles.compass}
              data-compass-status={status}
              aria-label="Compass hero"
              aria-busy={isBusy}
              onClick={activateCompass}
              disabled={isBusy}
            >
              <div className={styles.ringOuter} />
              <div className={styles.ringInner} />

              <div className={styles.crossX} />
              <div className={styles.crossY} />

              <div className={styles.north}>N</div>

              <div
                className={styles.needleWrap}
                style={{ transform: `rotate(${displayHeading}deg)` }}
              >
                <div className={styles.needleTop} />
                <div className={styles.needleBottom} />
                <div className={styles.centerDot} />
              </div>

              <div className={styles.compassLabel}>{compassLabel}</div>
            </button>
          </div>

          <div className={styles.copy}>
            <h1 className={styles.title}>
              {uiLang2 === "ja" ? (
                <>
                  あなたの流れに、
                  <span style={{ display: "inline-block" }}>静かに寄り添う</span>
                </>
              ) : (
                <>
                  {t("hero_title")}
                  <span style={{ display: "inline-block" }}>
                    {t("hero_sub")}
                  </span>
                </>
              )}
            </h1>

            <p className={styles.description}>
              {uiLang2 === "ja" ? (
                <>
                  考えを整え、気づきを深め、
                  <br />
                  次の方向を見つけていくためのCompass。
                </>
              ) : (
                t("sec1_body")
              )}
            </p>

            <Link
              href={ctaHref}
              aria-label={ctaLabel}
              className={styles.signInButton}
            >
              {ctaLabel}
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}

/*
このファイルの正式役割:
未ログイントップページの主役UIとして、リアルCompassヒーロー、コピー、説明文、サインイン導線を描画するファイル。
*/

/*
【今回このファイルで修正したこと】
Compassの上にβ版表記
「HOPY is currently in beta. / HOPYは現在β版です。改善を続けています。」
を追加しました。
ヘッダー側には戻さず、このヒーロー内だけで静かに表示する形へ移しました。
*/