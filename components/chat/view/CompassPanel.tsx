// /components/chat/view/CompassPanel.tsx
"use client";

import React from "react";

export type CompassPanelPlan = "free" | "plus" | "pro";

export type CompassPanelInsight = {
  label: string;
  body: string;
};

type CompassPanelProps = {
  stateLabel?: string | null;
  title?: string | null;
  summary?: string | null;
  promptLine?: string | null;
  insights?: CompassPanelInsight[] | null;
  actionText?: string | null;
  spiritualNote?: string | null;
  upgradeText?: string | null;
  plan?: CompassPanelPlan;
  className?: string;
};

function normalizeText(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeInsights(
  value: CompassPanelProps["insights"],
): CompassPanelInsight[] {
  if (!Array.isArray(value)) return [];

  return value
    .map((item) => {
      const label = normalizeText(item?.label);
      const body = normalizeText(item?.body);

      if (!label || !body) return null;

      return { label, body };
    })
    .filter((item): item is CompassPanelInsight => item !== null);
}

function CompassSimpleIcon() {
  return (
    <span
      aria-hidden="true"
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width: 18,
        height: 18,
        borderRadius: "9999px",
        border: "1px solid rgba(255,255,255,0.18)",
        fontSize: 10,
        lineHeight: 1,
        opacity: 0.86,
        flexShrink: 0,
      }}
    >
      ✦
    </span>
  );
}

function resolveDefaultTitle(plan: CompassPanelPlan): string {
  if (plan === "free") return "Compass";
  if (plan === "plus") return "Compass";
  return "Compass";
}

function resolveDefaultSummary(plan: CompassPanelPlan): string {
  if (plan === "free") {
    return "HOPY回答で○が付いた根拠を、少しだけ深く見るための場所です。";
  }

  if (plan === "plus") {
    return "HOPY回答で○が付いた根拠を、ひとつの視点から具体的に見ていく場所です。";
  }

  return "HOPY回答で○が付いた根拠を、多角的な視点から深く見ていく場所です。";
}

function resolveWhyLabel(stateLabel: string): string {
  if (stateLabel) {
    return `なぜ「${stateLabel}」なのか`;
  }

  return "なぜこの○が付いたのか";
}

export default function CompassPanel({
  stateLabel,
  title,
  summary,
  promptLine,
  insights,
  actionText,
  spiritualNote,
  upgradeText,
  plan = "plus",
  className,
}: CompassPanelProps) {
  const safeTitle = normalizeText(title) || resolveDefaultTitle(plan);
  const safeStateLabel = normalizeText(stateLabel);
  const safeSummary = normalizeText(summary) || resolveDefaultSummary(plan);
  const safePromptLine = normalizeText(promptLine);
  const safeInsights = normalizeInsights(insights);
  const safeActionText = normalizeText(actionText);
  const safeSpiritualNote = normalizeText(spiritualNote);
  const safeUpgradeText = normalizeText(upgradeText);

  const hasStateLine = !!safeStateLabel;
  const hasPromptLine = !!safePromptLine;
  const hasInsights = safeInsights.length > 0;
  const hasActionText = !!safeActionText;
  const hasSpiritualNote = !!safeSpiritualNote;
  const hasUpgradeText = !!safeUpgradeText;

  return (
    <section
      className={className}
      aria-label="Compass"
      style={{
        marginTop: 10,
        borderRadius: 16,
        border: "1px solid rgba(255,255,255,0.07)",
        background: "rgba(255,255,255,0.025)",
        padding: "13px 14px 12px",
        backdropFilter: "blur(6px)",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          marginBottom: 9,
        }}
      >
        <CompassSimpleIcon />
        <div
          style={{
            fontSize: 13,
            fontWeight: 600,
            letterSpacing: "0.01em",
            opacity: 0.9,
          }}
        >
          {safeTitle}
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gap: 10,
        }}
      >
        {hasStateLine ? (
          <p
            style={{
              margin: 0,
              fontSize: 14,
              lineHeight: 1.75,
              opacity: 0.94,
            }}
          >
            いまの状態は、「{safeStateLabel}」です。
          </p>
        ) : null}

        <p
          style={{
            margin: 0,
            fontSize: 13,
            lineHeight: 1.8,
            opacity: 0.76,
          }}
        >
          {safeSummary}
        </p>

        {hasPromptLine ? (
          <div
            style={{
              display: "grid",
              gap: 6,
            }}
          >
            <p
              style={{
                margin: 0,
                fontSize: 12,
                fontWeight: 600,
                lineHeight: 1.7,
                opacity: 0.72,
              }}
            >
              {resolveWhyLabel(safeStateLabel)}
            </p>
            <p
              style={{
                margin: 0,
                fontSize: 13,
                lineHeight: 1.8,
                opacity: 0.86,
                whiteSpace: "pre-wrap",
              }}
            >
              {safePromptLine}
            </p>
          </div>
        ) : null}

        {hasInsights ? (
          <div
            style={{
              display: "grid",
              gap: 10,
            }}
          >
            {safeInsights.map((item) => (
              <section
                key={`${item.label}:${item.body}`}
                style={{
                  display: "grid",
                  gap: 4,
                }}
              >
                <p
                  style={{
                    margin: 0,
                    fontSize: 12,
                    fontWeight: 600,
                    lineHeight: 1.65,
                    opacity: 0.74,
                  }}
                >
                  {item.label}
                </p>
                <p
                  style={{
                    margin: 0,
                    fontSize: 13,
                    lineHeight: 1.8,
                    opacity: 0.88,
                    whiteSpace: "pre-wrap",
                  }}
                >
                  {item.body}
                </p>
              </section>
            ))}
          </div>
        ) : null}

        {hasActionText ? (
          <div
            style={{
              paddingTop: 2,
            }}
          >
            <p
              style={{
                margin: 0,
                fontSize: 12,
                fontWeight: 600,
                lineHeight: 1.65,
                opacity: 0.72,
              }}
            >
              だから次は
            </p>
            <p
              style={{
                margin: 0,
                fontSize: 13,
                lineHeight: 1.8,
                opacity: 0.9,
                whiteSpace: "pre-wrap",
              }}
            >
              {safeActionText}
            </p>
          </div>
        ) : null}

        {hasSpiritualNote ? (
          <div
            style={{
              borderTop: "1px solid rgba(255,255,255,0.08)",
              paddingTop: 10,
            }}
          >
            <p
              style={{
                margin: 0,
                fontSize: 11,
                lineHeight: 1.7,
                opacity: 0.6,
              }}
            >
              ※最後に、軽い意味づけの視点ではこう見ることもできます。
            </p>
            <p
              style={{
                margin: "4px 0 0",
                fontSize: 12,
                lineHeight: 1.8,
                opacity: 0.72,
                whiteSpace: "pre-wrap",
              }}
            >
              {safeSpiritualNote}
            </p>
          </div>
        ) : null}

        {hasUpgradeText ? (
          <p
            style={{
              margin: 0,
              paddingTop: 2,
              fontSize: 11,
              lineHeight: 1.7,
              opacity: 0.56,
            }}
          >
            {safeUpgradeText}
          </p>
        ) : null}
      </div>
    </section>
  );
}