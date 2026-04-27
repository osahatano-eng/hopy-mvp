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
import type { ChatStreamFutureChainPlan } from "./chatStreamFutureChainItem";
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
  futureChainPlan?: ChatStreamFutureChainPlan | null;
  futureChainDisplay?: unknown | null;

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
    futureChainPlan = null,
    futureChainDisplay = null,
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
      futureChainPlan,
      futureChainDisplay,
    });
  }, [rendered, visibleTexts, uiLang, futureChainPlan, futureChainDisplay]);

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
受け取った rendered / visibleTexts / futureChainPlan / futureChainDisplay を表示用 ViewItem 生成へ渡し、
MessageRow / DayDivider / Compass / Future Chain / LoadingRow を描画する。
Future Chain の意味生成や plan 判定は担当せず、受け取った値を下流へ渡すだけを担当する。

【今回このファイルで修正したこと】
futureChainDisplay を props として受け取れるようにした。
受け取った futureChainDisplay を getChatStreamViewItems(...) へ渡す中継を追加した。
このファイルでは state_changed、state_level、Compass、HOPY回答○、DB保存、
recipient_support検索、delivery_event保存、Future Chainページには触れていない。

/components/chat/view/ChatStream.tsx
*/