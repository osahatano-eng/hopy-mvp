// /components/chat/view/ChatStream.tsx
"use client";

import React, { useMemo } from "react";
import styles from "../ChatClient.module.css";

import DayDivider from "../ui/DayDivider";
import MessageRow from "../ui/MessageRow";

import type { Lang } from "../lib/chatTypes";
import {
  AssistantStateDot,
  type AssistantDotMeta,
} from "./chatStreamAssistantState";
import ChatStreamCompass from "./ChatStreamCompass";
import ChatStreamFutureChain from "./ChatStreamFutureChain";
import ChatStreamLoadingRow from "./chatStreamLoadingRow";
import {
  getChatStreamViewItems,
  type RenderItem,
  type ViewItem,
} from "./chatStreamViewItems";

function ChatStreamInner(props: {
  uiLang: Lang;
  ui: {
    more: string;
    sending: string;
  };
  canShowMore: boolean;
  onShowMore: () => void;

  rendered: RenderItem[];
  visibleTexts: Map<string, string>;

  shouldShowPreparing: boolean;
  preparingLabel: string;

  shouldShowRecover: boolean;
  recoverTitle: string;
  userStateErr: string | null;
  reloadLabel: string;
  resetLabel: string;
  onReload: () => void;
  onResetAndReload: () => void;

  shouldShowStuck: boolean;
  stuckLabel: string;

  loading: boolean;

  bottomRef: React.RefObject<HTMLDivElement | null>;
  scrollerRef: React.RefObject<HTMLDivElement | null>;

  topInset?: string;
}) {
  const {
    uiLang,
    ui,
    canShowMore,
    onShowMore,
    rendered,
    visibleTexts,
    shouldShowPreparing,
    preparingLabel,
    shouldShowRecover,
    recoverTitle,
    userStateErr,
    reloadLabel,
    resetLabel,
    onReload,
    onResetAndReload,
    shouldShowStuck,
    stuckLabel,
    loading,
    bottomRef,
    scrollerRef,
    topInset,
  } = props;

  void shouldShowPreparing;
  void preparingLabel;
  void shouldShowRecover;
  void recoverTitle;
  void userStateErr;
  void reloadLabel;
  void resetLabel;
  void onReload;
  void onResetAndReload;
  void shouldShowStuck;
  void stuckLabel;

  const inset = typeof topInset === "string" ? topInset : "0px";

  const streamWrapStyle: React.CSSProperties = useMemo(() => {
    return { paddingTop: inset };
  }, [inset]);

  const viewItems: ViewItem[] = useMemo(() => {
    return getChatStreamViewItems({
      rendered,
      visibleTexts,
      uiLang,
    });
  }, [rendered, visibleTexts, uiLang]);

  const viewMessageRowCount = useMemo(() => {
    return viewItems.reduce((count, it) => {
      return it.kind === "msg" ? count + 1 : count;
    }, 0);
  }, [viewItems]);

  const hasAnyRenderedMessageRows = viewMessageRowCount > 0;

  const hasTrailingAssistantMessage = useMemo(() => {
    for (let i = viewItems.length - 1; i >= 0; i--) {
      const it = viewItems[i];
      if (it.kind !== "msg") continue;
      return it.role === "assistant";
    }
    return false;
  }, [viewItems]);

  const shouldRenderLoadingRow = loading && hasAnyRenderedMessageRows;

  const bottomSpacerStyle: React.CSSProperties = useMemo(() => {
    return {
      height: hasAnyRenderedMessageRows
        ? "calc(72px + env(safe-area-inset-bottom))"
        : "0px",
      flex: "0 0 auto",
    };
  }, [hasAnyRenderedMessageRows]);

  const messageListNode = viewItems.map((it) => {
    if (it.kind === "divider") {
      return <DayDivider key={it.key} label={it.label} />;
    }

    if (it.kind === "compass") {
      return <ChatStreamCompass key={it.key} item={it} />;
    }

    if (it.kind === "future_chain") {
      return <ChatStreamFutureChain key={it.key} item={it} />;
    }

    const role = it.role;

    return (
      <MessageRow
        key={it.key}
        role={role as any}
        text={it.text}
        uiLang={uiLang}
        msgKey={it.msgKey}
        dataRole={role === "user" ? "user" : "assistant"}
        isLastUser={it.isLastUser}
        assistantStateDot={
          role === "assistant" && it.assistantDot?.show ? (
            <AssistantStateDot meta={it.assistantDot as AssistantDotMeta} />
          ) : undefined
        }
      />
    );
  });

  return (
    <div className={styles.streamWrap} ref={scrollerRef} style={streamWrapStyle}>
      <div className={styles.streamInner} role="log" aria-live="polite">
        {canShowMore ? (
          <div className={styles.moreWrap}>
            <button className={styles.moreBtn} onClick={onShowMore}>
              {ui.more}
            </button>
          </div>
        ) : null}

        <>
          {messageListNode}
          <ChatStreamLoadingRow
            loading={shouldRenderLoadingRow}
            hasTrailingAssistantMessage={hasTrailingAssistantMessage}
            sendingText={ui.sending}
            uiLang={uiLang}
          />
        </>

        <div aria-hidden="true" data-bottom-spacer="" style={bottomSpacerStyle} />
        <div ref={bottomRef} aria-hidden="true" data-bottom-anchor="" />
      </div>
    </div>
  );
}

export const ChatStream = ChatStreamInner;

export default ChatStream;

/*
【このファイルの正式役割】
チャット本文の描画ファイル。
受け取った rendered / visibleTexts を、そのまま表示用 viewItems に変換し、
MessageRow / DayDivider / Compass / Future Chain / LoadingRow を描画する。
このファイルは本文採用や thread 判定を持たず、表示だけを担当する。
*/

/*
【今回このファイルで修正したこと】
- ChatStreamFutureChain を import しました。
- kind: "future_chain" の分岐を return null から ChatStreamFutureChain 表示へ接続しました。
- Future Chain 本表示UIは ChatStreamFutureChain.tsx に分離し、このファイルには直書きしていません。
- 本文採用、thread 判定、送信処理、jumpボタン判定、confirmed payload、state_changed、HOPY回答○、Compass、DB保存/復元、1..5 の唯一の正には触っていません。
*/

/* /components/chat/view/ChatStream.tsx */