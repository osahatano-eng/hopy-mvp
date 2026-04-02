// /components/chat/view/GuestIntroMotion.tsx
"use client";

import React from "react";

type Lang = "ja" | "en";

type Props = {
  uiLang?: Lang;
  finalText?: string;
  className?: string;
};

const FINAL_DOT_COLORS = [
  "#6B7280",
  "#3B82F6",
  "#14B8A6",
  "#8B5CF6",
  "#F59E0B",
] as const;

function getFinalText() {
  return "あなたの流れに、静かに寄り添う";
}

function FinalDots(props: { uiLang: Lang; finalText: string }) {
  const ariaLabel =
    props.uiLang === "en"
      ? "Five HOPY states have settled"
      : "HOPYの5段階状態が静かに整いました";

  return (
    <div
      style={{
        display: "flex",
        minHeight: "min(78vw, 420px)",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <div
        role="img"
        aria-label={ariaLabel}
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 24,
        }}
      >
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 14,
            opacity: 1,
          }}
        >
          {FINAL_DOT_COLORS.map((color, index) => (
            <span
              key={index}
              aria-hidden="true"
              style={{
                display: "inline-block",
                width: 22,
                height: 22,
                borderRadius: 9999,
                backgroundColor: color,
              }}
            />
          ))}
        </div>

        <div
          style={{
            fontSize: "clamp(15px, 1.7vw, 17px)",
            lineHeight: 1.9,
            letterSpacing: "0.02em",
            color: "currentColor",
            textAlign: "center",
            opacity: 1,
            textWrap: "balance",
            paddingInline: 16,
          }}
        >
          {props.finalText}
        </div>
      </div>
    </div>
  );
}

export const GuestIntroMotion = React.memo(function GuestIntroMotion(props: Props) {
  const uiLang = props.uiLang === "en" ? "en" : "ja";
  const finalText = props.finalText?.trim() || getFinalText();

  return (
    <div
      className={props.className}
      aria-live="off"
      style={{
        width: "100%",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 12,
        paddingInline: 16,
        paddingBlock: 18,
        userSelect: "none",
        WebkitUserSelect: "none",
        pointerEvents: "none",
        color: "inherit",
      }}
    >
      <FinalDots uiLang={uiLang} finalText={finalText} />
    </div>
  );
});

export default GuestIntroMotion;