// /components/chat/view/PreparingHero.tsx
"use client";

import React from "react";
import styles from "../ChatClient.module.css";
import type { Lang } from "../lib/chatTypes";

const HERO_PHASE_COLORS = [
  "#6B7280", // 混線
  "#3B82F6", // 模索
  "#14B8A6", // 整理
  "#8B5CF6", // 収束
  "#F59E0B", // 決定
] as const;

const PREPARING_ROTATE_MS = 1700;

const PREPARING_TEXTS: Record<Lang, readonly string[]> = {
  ja: [
    "考えています。。。",
    "流れを整えています。。。",
    "ことばを選んでいます。。。",
    "静かに整理しています。。。",
    "答えを結んでいます。。。",
  ],
  en: [
    "Thinking...",
    "Aligning the flow...",
    "Choosing the words...",
    "Quietly organizing...",
    "Bringing the answer together...",
  ],
} as const;

function normalizePreparingText(value: string) {
  return value
    .trim()
    .replace(/[。\.…]+$/g, "")
    .replace(/\s+/g, " ")
    .toLowerCase();
}

function isGenericFallbackLabel(value: string, uiLang: Lang) {
  const normalized = normalizePreparingText(value);

  if (!normalized) return true;

  if (uiLang === "en") {
    return normalized === "thinking" || normalized === "preparing response";
  }

  return (
    normalized === "考えます" ||
    normalized === "考えています" ||
    normalized === "回答を準備中" ||
    normalized === "準備中"
  );
}

const HeroPhaseDots = React.memo(function HeroPhaseDots(props: { uiLang: Lang }) {
  const ariaLabel =
    props.uiLang === "en"
      ? "Five HOPY state colors: tangled, exploring, organizing, converging, deciding"
      : "HOPYの5段階状態色：混線、模索、整理、収束、決定";

  return (
    <div
      className={styles.heroTitle}
      aria-label={ariaLabel}
      role="img"
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        gap: "0.26em",
      }}
    >
      {HERO_PHASE_COLORS.map((color, index) => (
        <span
          key={index}
          aria-hidden="true"
          style={{
            display: "inline-block",
            width: "0.42em",
            height: "0.42em",
            borderRadius: "9999px",
            backgroundColor: color,
            boxShadow: "0 0 0 1px rgba(255,255,255,0.06) inset",
            animation: `hopyPreparingDotPulse 1800ms ease-in-out ${index * 90}ms infinite`,
            willChange: "transform, opacity",
          }}
        />
      ))}
    </div>
  );
});

const PreparingHero = React.memo(function PreparingHero(props: {
  uiLang: Lang;
  fallbackLabel: string;
}) {
  const messages = React.useMemo(() => {
    const base = [...(PREPARING_TEXTS[props.uiLang] ?? PREPARING_TEXTS.ja)];
    const fallback = props.fallbackLabel.trim();

    if (!fallback || isGenericFallbackLabel(fallback, props.uiLang)) {
      return base;
    }

    const fallbackNormalized = normalizePreparingText(fallback);
    const dedupedBase = base.filter(
      (text) => normalizePreparingText(text) !== fallbackNormalized
    );

    return [fallback, ...dedupedBase];
  }, [props.fallbackLabel, props.uiLang]);

  const [index, setIndex] = React.useState(0);

  React.useEffect(() => {
    setIndex((current) => {
      if (messages.length <= 0) return 0;
      return current % messages.length;
    });
  }, [messages.length]);

  React.useEffect(() => {
    if (messages.length <= 1) {
      return;
    }

    const timer = window.setInterval(() => {
      setIndex((current) => (current + 1) % messages.length);
    }, PREPARING_ROTATE_MS);

    return () => {
      window.clearInterval(timer);
    };
  }, [messages.length]);

  return (
    <section
      className={styles.hero}
      aria-label={props.uiLang === "en" ? "preparing-response" : "回答準備中"}
    >
      <div className={styles.heroInner}>
        <style jsx>{`
          @keyframes hopyPreparingTextIn {
            0% {
              opacity: 0;
              transform: translateY(6px);
            }
            100% {
              opacity: 1;
              transform: translateY(0);
            }
          }

          @keyframes hopyPreparingDotPulse {
            0%,
            100% {
              opacity: 0.72;
              transform: translateY(0) scale(1);
            }
            50% {
              opacity: 1;
              transform: translateY(-1px) scale(1.08);
            }
          }
        `}</style>

        <HeroPhaseDots uiLang={props.uiLang} />

        <div
          key={`${props.uiLang}-${index}-${messages[index] ?? ""}`}
          className={styles.heroSub}
          aria-live="polite"
          style={{
            minHeight: "1.6em",
            animation: "hopyPreparingTextIn 280ms ease",
            willChange: "transform, opacity",
          }}
        >
          {messages[index] ?? props.fallbackLabel}
        </div>
      </div>
    </section>
  );
});

export default PreparingHero;