// /components/chat/ui/MessageRow.tsx
"use client";

import React, { useMemo } from "react";
import styles from "./MessageRow.module.css";

type Lang = "en" | "ja";

type Props = {
  role: "user" | "assistant";
  text: string;
  uiLang: Lang;

  /**
   * ✅ Scroll / anchor metadata (optional)
   * - These are provided by ChatStream in later step(s).
   * - Optional to keep backward compatibility.
   */
  msgKey?: string;
  dataRole?: string; // e.g. "user" | "assistant"
  isLastUser?: boolean; // strongest anchor for "pin under header"

  /**
   * ✅ assistant行だけ HOPY 横に状態丸を差し込む
   * - 未指定なら何も表示しない
   * - 後方互換維持のため optional
   */
  assistantStateDot?: React.ReactNode;
};

function splitParagraphs(s: string) {
  return String(s ?? "")
    .replace(/\r\n/g, "\n")
    .split(/\n{2,}/g)
    .map((p) => p.trim())
    .filter(Boolean);
}

const TONE_MARKER = {
  calm: "\u200B\u200C\u200D",
  growth: "\u200B\u200D\u200C",
} as const;

type Tone = "calm" | "growth" | "none";

function detectToneByInvisibleMarker(text: string): Tone {
  const t = String(text ?? "");
  if (!t) return "none";
  if (t.startsWith(TONE_MARKER.calm)) return "calm";
  if (t.startsWith(TONE_MARKER.growth)) return "growth";
  return "none";
}

function stripInvisibleToneMarker(text: string) {
  const t = String(text ?? "");
  if (!t) return "";
  if (t.startsWith(TONE_MARKER.calm)) return t.slice(TONE_MARKER.calm.length);
  if (t.startsWith(TONE_MARKER.growth)) return t.slice(TONE_MARKER.growth.length);
  return t;
}

function normalizePendingText(text: string) {
  return String(text ?? "")
    .replace(/\u2026/g, "...")
    .replace(/…/g, "...")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

/**
 * ✅ pending判定（UX専用）
 * - assistantのみ対象
 * - toneとは完全分離
 * - HOPY専用の待機文言の揺れを吸収する
 */
function isPendingMessage(role: "user" | "assistant", text: string, uiLang: Lang) {
  if (role !== "assistant") return false;

  const t = normalizePendingText(text);
  if (!t) return false;

  if (uiLang === "en") {
    return (
      t === "thinking" ||
      t === "thinking..." ||
      t === "organizing thoughts" ||
      t === "organizing thoughts..." ||
      t === "centering" ||
      t === "centering..." ||
      t.startsWith("thinking ") ||
      t.startsWith("organizing thoughts ") ||
      t.startsWith("centering ")
    );
  }

  return (
    t === "考えています" ||
    t === "考えています..." ||
    t === "思考を整理しています" ||
    t === "思考を整理しています..." ||
    t === "心を整えています" ||
    t === "心を整えています..." ||
    t.startsWith("考えています ") ||
    t.startsWith("思考を整理しています ") ||
    t.startsWith("心を整えています ")
  );
}

function hasRenderableAssistantStateDot(node: React.ReactNode) {
  return node !== undefined && node !== null && node !== false;
}

function getAssistantStateDotRenderKey(node: React.ReactNode): string {
  if (!hasRenderableAssistantStateDot(node)) return "none";

  if (typeof node === "string") return `text:${node}`;
  if (typeof node === "number") return `num:${node}`;

  if (Array.isArray(node)) {
    return `arr:${node.length}:${node.map((x) => getAssistantStateDotRenderKey(x)).join("|")}`;
  }

  if (React.isValidElement(node)) {
    const el = node as React.ReactElement<any>;
    const typeName =
      typeof el.type === "string"
        ? el.type
        : typeof el.type === "function"
        ? (() => {
            const namedType = el.type as React.JSXElementConstructor<any> & {
              displayName?: string;
              name?: string;
            };
            return namedType.displayName || namedType.name || "fn";
          })()
        : "other";

    const keyPart = el.key == null ? "nokey" : String(el.key);
    const classNamePart =
      typeof el.props?.className === "string" && el.props.className.trim()
        ? el.props.className.trim()
        : "";
    const ariaLabelPart =
      typeof el.props?.["aria-label"] === "string" && el.props["aria-label"].trim()
        ? el.props["aria-label"].trim()
        : "";
    const titlePart =
      typeof el.props?.title === "string" && el.props.title.trim() ? el.props.title.trim() : "";
    const dataStatePart =
      typeof el.props?.["data-state"] === "string" && el.props["data-state"].trim()
        ? el.props["data-state"].trim()
        : "";
    const dataTonePart =
      typeof el.props?.["data-tone"] === "string" && el.props["data-tone"].trim()
        ? el.props["data-tone"].trim()
        : "";
    const stylePart = (() => {
      try {
        const style = el.props?.style;
        if (!style || typeof style !== "object") return "";
        return Object.keys(style)
          .sort()
          .map((k) => `${k}:${String(style[k])}`)
          .join(";");
      } catch {
        return "";
      }
    })();

    return [
      "el",
      typeName,
      keyPart,
      classNamePart,
      ariaLabelPart,
      titlePart,
      dataStatePart,
      dataTonePart,
      stylePart,
    ].join(":");
  }

  return `other:${String(node)}`;
}

function MessageRowBase({
  role,
  text,
  uiLang,
  msgKey,
  dataRole,
  isLastUser,
  assistantStateDot,
}: Props) {
  const isUser = role === "user";
  const cap = isUser ? "YOU" : "HOPY";
  const assistantStateDotKey = useMemo(
    () => getAssistantStateDotRenderKey(assistantStateDot),
    [assistantStateDot]
  );
  const showAssistantStateDot = !isUser && assistantStateDotKey !== "none";

  const derived = useMemo(() => {
    const raw = String(text ?? "");

    if (role === "user") {
      const hasMultiPara = raw.includes("\n\n") || raw.includes("\r\n\r\n");
      return {
        toneClass: "",
        displayText: raw,
        paragraphs: hasMultiPara ? splitParagraphs(raw) : null,
        pending: false,
        tone: "none" as Tone,
      };
    }

    const tone = detectToneByInvisibleMarker(raw);
    const displayText = stripInvisibleToneMarker(raw);
    const hasMultiPara = displayText.includes("\n\n") || displayText.includes("\r\n\r\n");

    return {
      toneClass: tone === "calm" ? styles.asstCalm : tone === "growth" ? styles.asstGrowth : "",
      displayText,
      paragraphs: hasMultiPara ? splitParagraphs(displayText) : null,
      pending: isPendingMessage(role, displayText, uiLang),
      tone,
    };
  }, [role, text, uiLang]);

  const rowClass =
    styles.row +
    " " +
    (isUser ? styles.user : styles.asst) +
    (derived.pending ? " " + styles.pending : "");

  const txtClass = derived.toneClass ? styles.txt + " " + derived.toneClass : styles.txt;

  return (
    <div
      className={rowClass}
      data-msg-row="1"
      data-msg-role={role}
      data-role={dataRole ?? role}
      data-msgkey={msgKey ?? ""}
      data-hopy-last-user={isLastUser ? "1" : "0"}
      data-pending={derived.pending ? "1" : "0"}
      data-tone={derived.tone}
      aria-busy={derived.pending ? true : undefined}
    >
      <div className={styles.block}>
        <div className={styles.cap} aria-hidden="true">
          <span>{cap}</span>
          {showAssistantStateDot ? (
            <span
              data-hopy-state-dot="1"
              data-hopy-state-dot-key={assistantStateDotKey}
              style={{
                display: "inline-flex",
                alignItems: "center",
                marginLeft: 8,
                verticalAlign: "middle",
                flex: "0 0 auto",
              }}
            >
              {assistantStateDot}
            </span>
          ) : null}
        </div>

        <div className={txtClass} lang={uiLang}>
          {derived.paragraphs ? (
            derived.paragraphs.map((p, i) => <p key={i}>{p}</p>)
          ) : (
            <p>{derived.displayText}</p>
          )}
        </div>
      </div>
    </div>
  );
}

const MessageRow = React.memo(
  MessageRowBase,
  (prev, next) =>
    prev.role === next.role &&
    prev.text === next.text &&
    prev.uiLang === next.uiLang &&
    prev.msgKey === next.msgKey &&
    prev.dataRole === next.dataRole &&
    prev.isLastUser === next.isLastUser &&
    getAssistantStateDotRenderKey(prev.assistantStateDot) ===
      getAssistantStateDotRenderKey(next.assistantStateDot)
);

export default MessageRow;

/*
このファイルの正式役割
メッセージ1行分の表示責務だけを持ち、user / assistant の本文表示、段落分割、pending表示、assistant横の状態丸表示を描画するファイル。
状態の唯一の正は作らず、受け取った props をそのまま表示するだけに限定する。
*/

/*
【今回このファイルで修正したこと】
1. el.type.displayName を直接参照せず、displayName?: string / name?: string を持つ関数型として明示してから参照するようにしました。
2. JSXElementConstructor<any> に displayName が無いという TypeScript の型エラーを、このファイル内だけで解消しました。
3. MessageRow の表示構造、pending判定、assistantStateDot の描画仕様には触れていません。
*/