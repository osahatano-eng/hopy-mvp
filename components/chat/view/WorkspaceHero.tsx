// /components/chat/view/WorkspaceHero.tsx
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
          }}
        />
      ))}
    </div>
  );
});

const WorkspaceHero = React.memo(function WorkspaceHero(props: { uiLang: Lang }) {
  return (
    <section className={styles.hero} aria-label="workspace-hero">
      <div className={styles.heroInner}>
        <HeroPhaseDots uiLang={props.uiLang} />
        <div className={styles.heroSub}>
          {props.uiLang === "en"
            ? "A quiet companion for clear thinking"
            : "思考を澄ませる、静かな伴走者"}
        </div>
      </div>
    </section>
  );
});

export default WorkspaceHero;