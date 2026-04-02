// /components/chat/ui/EmptyState.tsx
"use client";

import React from "react";
import styles from "./EmptyState.module.css";

type Lang = "en" | "ja";
type EmptyStateKind = "workspace" | "guest";

function buildCopy(uiLang: Lang, kind: EmptyStateKind) {
  if (kind === "guest") {
    return uiLang === "en"
      ? {
          title: "Start here.",
          subtitle: "Write one sentence. We’ll clarify it together.",
        }
      : {
          title: "ここから始める。",
          subtitle: "一文でいい。そこから一緒に澄ませていく。",
        };
  }

  return {
    title: "",
    subtitle: "",
  };
}

const EmptyState = ({
  uiLang,
  kind = "workspace",
}: {
  uiLang: Lang;
  kind?: EmptyStateKind;
}) => {
  const copy = buildCopy(uiLang, kind);

  if (!copy.title && !copy.subtitle) {
    return <div className={styles.empty} aria-hidden="true" />;
  }

  return (
    <div className={styles.empty}>
      <div className={styles.emptyT}>{copy.title}</div>
      <div className={styles.emptyS}>{copy.subtitle}</div>
    </div>
  );
};

export default React.memo(EmptyState);