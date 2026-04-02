// /components/chat/ui/LeftRailThreadList.tsx
"use client";

import React from "react";
import styles from "./LeftRail.module.css";
import type { Thread } from "../lib/chatTypes";
import { buildDisplayTitle } from "./leftRailThreadMeta";

type Props = {
  threads: Thread[];
  activeThreadId?: string | null;
  untitled: string;
  invalidThreadId: string;
  noThreads: string;
  iconStyle: React.CSSProperties;
  rightMarkStyle?: React.CSSProperties;
  titleCountMap: Map<string, number>;
  onSelectThread: (threadId: string, threadTitle: string) => void;
};

type ThreadRowProps = {
  thread: Thread;
  activeThreadId?: string | null;
  untitled: string;
  invalidThreadId: string;
  iconStyle: React.CSSProperties;
  rightMarkStyle?: React.CSSProperties;
  titleCountMap: Map<string, number>;
  onSelectThread: (threadId: string, threadTitle: string) => void;
};

function LeftRailThreadRow(props: ThreadRowProps) {
  const {
    thread,
    activeThreadId,
    untitled,
    invalidThreadId,
    iconStyle,
    rightMarkStyle,
    titleCountMap,
    onSelectThread,
  } = props;

  const { thId, baseTitle, displayTitle, disabled, key } = React.useMemo(() => {
    return buildDisplayTitle({
      thread,
      untitled,
      activeThreadId,
      titleCountMap,
    });
  }, [thread, untitled, activeThreadId, titleCountMap]);

  const activeId = React.useMemo(() => {
    return String(activeThreadId ?? "").trim();
  }, [activeThreadId]);

  const isActive = React.useMemo(() => {
    return Boolean(thId) && Boolean(activeId) && thId === activeId;
  }, [thId, activeId]);

  const handleClick = React.useCallback(() => {
    if (disabled) return;

    const fixedThreadId = String(thId ?? "").trim();
    const fixedBaseTitle = String(baseTitle ?? "").trim();

    if (!fixedThreadId) return;

    onSelectThread(fixedThreadId, fixedBaseTitle);
  }, [disabled, thId, baseTitle, onSelectThread]);

  return (
    <button
      key={key}
      type="button"
      className={`${styles.item} ${isActive ? styles.itemActive : ""} ${disabled ? styles.itemMuted : ""}`}
      data-threadid={thId}
      onClick={handleClick}
      disabled={disabled}
      aria-current={isActive ? "page" : undefined}
      aria-label={displayTitle}
      title={thId ? baseTitle : invalidThreadId}
      style={{
        marginLeft: 34,
        width: "calc(100% - 34px)",
        maxWidth: "calc(100% - 34px)",
        boxSizing: "border-box",
      }}
    >
      <span
        aria-hidden="true"
        style={{
          ...iconStyle,
          opacity: 0,
          width: 0,
          minWidth: 0,
          flex: "0 0 0px",
          overflow: "hidden",
        }}
      >
        ·
      </span>

      <span
        className={styles.itemText}
        style={{
          flex: "1 1 auto",
          minWidth: 0,
          color: "var(--text, #111111)",
          opacity: 1,
          fontWeight: 400,
          fontSize: 14,
          lineHeight: 1.4,
          letterSpacing: "0.008em",
        }}
      >
        {displayTitle}
      </span>

      <span
        aria-hidden="true"
        style={{
          ...(rightMarkStyle ?? {}),
          opacity: 0,
        }}
      >
        ›
      </span>
    </button>
  );
}

export default function LeftRailThreadList(props: Props) {
  const {
    threads,
    activeThreadId,
    untitled,
    invalidThreadId,
    noThreads,
    iconStyle,
    rightMarkStyle,
    titleCountMap,
    onSelectThread,
  } = props;

  if (!threads.length) {
    return <div style={{ opacity: 0.65, fontSize: 13, padding: "6px 10px" }}>{noThreads}</div>;
  }

  return (
    <div>
      {threads.map((thread) => {
        return (
          <LeftRailThreadRow
            key={String((thread as any)?.id ?? "") || String((thread as any)?.title ?? "")}
            thread={thread}
            activeThreadId={activeThreadId}
            untitled={untitled}
            invalidThreadId={invalidThreadId}
            iconStyle={iconStyle}
            rightMarkStyle={rightMarkStyle}
            titleCountMap={titleCountMap}
            onSelectThread={onSelectThread}
          />
        );
      })}
    </div>
  );
}

/*
このファイルの正式役割
Threads セクション配下のスレッド一覧を表示するファイル。
一覧行のタイトル表示と選択操作だけを担当し、状態の唯一の正は作らず、受け取った一覧情報をそのまま表示するだけに限定する。
*/

/*
【今回このファイルで修正したこと】
1. スレッド一覧カード全体の左開始位置を、現在のチャットと同じように一段内側へそろえました。
2. スレッドタイトルのフォントウェイトを通常ウェイトにしました。
3. スレッドタイトルのフォントサイズ・行高・字間を、現在のチャットタイトルと同じ見た目にそろえました。
4. 他機能には触れず、状態の唯一の正、状態の再判定、state_changed の再計算、0..4 前提への変換は一切追加していません。
*/