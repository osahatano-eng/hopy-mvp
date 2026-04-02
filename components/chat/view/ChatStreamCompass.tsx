// /components/chat/view/ChatStreamCompass.tsx
"use client";

import React from "react";
import styles from "../ChatClient.module.css";
import type { ViewItem } from "./chatStreamViewItems";

type CompassSection = {
  title: string;
  lines: string[];
};

type LabeledLine = {
  label: string;
  body: string;
};

type StructuredCompass = {
  currentState: string[];
  academicInterpretation: string[];
  divinatoryInterpretation: string[];
  toYou: string[];
  founderToYou: string[];
};

const SECTION_ORDER = [
  "いまの状態",
  "学問的解釈",
  "占い的解釈",
  "あなたへ",
  "創業者より、あなたへ",
] as const;

function parseCompassSections(compassText: string): CompassSection[] {
  const normalized = compassText.replace(/\r\n/g, "\n").trim();
  if (!normalized) return [];

  const lines = normalized.split("\n");
  const sections: CompassSection[] = [];
  let current: CompassSection | null = null;

  for (const rawLine of lines) {
    const line = rawLine.trim();

    if (!line) {
      if (current && current.lines[current.lines.length - 1] !== "") {
        current.lines.push("");
      }
      continue;
    }

    const headingMatch = line.match(/^【(.+?)】$/);
    if (headingMatch) {
      if (current) sections.push(current);
      current = {
        title: headingMatch[1].trim(),
        lines: [],
      };
      continue;
    }

    if (!current) {
      current = {
        title: "",
        lines: [],
      };
    }

    current.lines.push(line);
  }

  if (current) sections.push(current);

  return sections.filter((section) => {
    if (section.title) return true;
    return section.lines.some((line) => line.trim().length > 0);
  });
}

function isStructuredCompass(sections: CompassSection[]): boolean {
  return sections.some((section) =>
    SECTION_ORDER.includes(section.title as (typeof SECTION_ORDER)[number]),
  );
}

function toStructuredCompass(sections: CompassSection[]): StructuredCompass {
  const structured: StructuredCompass = {
    currentState: [],
    academicInterpretation: [],
    divinatoryInterpretation: [],
    toYou: [],
    founderToYou: [],
  };

  for (const section of sections) {
    const visibleLines = section.lines.filter((line) => line.trim().length > 0);
    if (visibleLines.length === 0) continue;

    switch (section.title) {
      case "いまの状態":
        structured.currentState.push(...visibleLines);
        break;
      case "学問的解釈":
        structured.academicInterpretation.push(...visibleLines);
        break;
      case "占い的解釈":
        structured.divinatoryInterpretation.push(...visibleLines);
        break;
      case "あなたへ":
        structured.toYou.push(...visibleLines);
        break;
      case "創業者より、あなたへ":
        structured.founderToYou.push(...visibleLines);
        break;
      default:
        break;
    }
  }

  return structured;
}

function parseLabeledLines(lines: string[]): LabeledLine[] {
  const items: LabeledLine[] = [];

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;

    const match = line.match(/^([^：:]+[：:])\s*(.*)$/);
    if (match) {
      items.push({
        label: match[1].trim(),
        body: match[2].trim(),
      });
      continue;
    }

    items.push({
      label: "",
      body: line,
    });
  }

  return items;
}

function renderLines(lines: string[]) {
  return lines.map((line, index) => (
    <p key={`${line}-${index}`} className={styles.compassText} style={{ margin: 0 }}>
      {line}
    </p>
  ));
}

function renderLabeledLines(lines: string[]) {
  const items = parseLabeledLines(lines);

  return items.map((item, index) => (
    <div
      key={`${item.label}-${item.body}-${index}`}
      style={{
        display: "grid",
        gap: "4px",
        width: "100%",
        maxWidth: "100%",
        minWidth: 0,
        boxSizing: "border-box",
      }}
    >
      {item.label ? (
        <div
          style={{
            margin: 0,
            padding: 0,
            fontSize: "12px",
            lineHeight: 1.35,
            fontWeight: 700,
            letterSpacing: "0.02em",
            opacity: 0.84,
          }}
        >
          {item.label}
        </div>
      ) : null}

      {item.body ? (
        <p className={styles.compassText} style={{ margin: 0 }}>
          {item.body}
        </p>
      ) : null}
    </div>
  ));
}

function renderStructuredSection(
  title: string,
  lines: string[],
  variant: "plain" | "labeled" = "plain",
) {
  if (lines.length === 0) return null;

  return (
    <section
      key={title}
      style={{
        width: "100%",
        maxWidth: "100%",
        minWidth: 0,
        boxSizing: "border-box",
      }}
    >
      <div
        style={{
          margin: 0,
          padding: 0,
          fontSize: "12px",
          lineHeight: 1.35,
          fontWeight: 700,
          letterSpacing: "0.02em",
          opacity: 0.84,
        }}
      >
        {title}
      </div>

      <div
        style={{
          display: "grid",
          gap: "8px",
          marginTop: "8px",
        }}
      >
        {variant === "labeled" ? renderLabeledLines(lines) : renderLines(lines)}
      </div>
    </section>
  );
}

type Props = {
  item: ViewItem;
};

function ChatStreamCompassInner({ item }: Props) {
  if (item.kind !== "compass") return null;

  const compassText = item.text.trim();
  if (!compassText) return null;

  const sections = parseCompassSections(compassText);
  const structured = isStructuredCompass(sections);
  const structuredCompass = structured ? toStructuredCompass(sections) : null;

  return (
    <section
      className={styles.compassCard}
      data-compass=""
      aria-label="Compass"
    >
      <div className={styles.compassHeader}>
        <div className={styles.compassTitleRow}>
          <span className={styles.compassIcon} aria-hidden="true">
            ✦
          </span>
          <span className={styles.compassTitle}>Compass</span>
        </div>
      </div>

      <div className={styles.compassBody}>
        {!structured || !structuredCompass ? (
          <p className={styles.compassText}>{compassText}</p>
        ) : (
          <div
            style={{
              display: "grid",
              gap: "14px",
              width: "100%",
              maxWidth: "100%",
              minWidth: 0,
              boxSizing: "border-box",
            }}
          >
            {renderStructuredSection("いまの状態", structuredCompass.currentState)}
            {renderStructuredSection(
              "学問的解釈",
              structuredCompass.academicInterpretation,
              "labeled",
            )}
            {renderStructuredSection(
              "占い的解釈",
              structuredCompass.divinatoryInterpretation,
              "labeled",
            )}
            {renderStructuredSection("あなたへ", structuredCompass.toYou)}
            {renderStructuredSection("創業者より、あなたへ", structuredCompass.founderToYou)}
          </div>
        )}
      </div>
    </section>
  );
}

const ChatStreamCompass = React.memo(ChatStreamCompassInner);

export default ChatStreamCompass;

/*
このファイルの正式役割
Compass 表示専用の描画ファイル。
ViewItem から Compass 用 item を受け取り、
Compass カードとして表示する。

このファイルが受け取るもの
item: ViewItem

このファイルが渡すもの
React の Compass 表示 UI
- Compass カード
- 見出し
- 本文
- 構造化済み Compass の各セクション表示

Compass 観点でこのファイルの意味
このファイルは Compass の表示専用層。
Compass を生成しない。
Compass の表示可否を plan で判定しない。
API payload を直接読まない。
item.kind === "compass" かつ item.text が空でないときだけ描画する。

このファイルで確認できた大事なこと
1. item.kind !== "compass" の場合は return null。
2. item.text.trim() が空なら return null。
3. このファイルは payload.compass や hopy_confirmed_payload を直接参照していない。
4. このファイルは ViewItem 化された後の結果だけを表示する。
5. structured Compass のときは見出しごとに整形表示し、そうでなければ本文をそのまま表示する。
6. よって、このファイルで Compass が出ない原因の核心は、ViewItem を作る前段にある。
*/