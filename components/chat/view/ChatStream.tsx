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
import { getChatStreamFallbackCopy } from "./chatStreamFallbackCopy";
import ChatStreamCompass from "./ChatStreamCompass";
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
    shouldShowRecover,
    userStateErr,
    shouldShowStuck,
    loading,
    bottomRef,
    scrollerRef,
    topInset,
  } = props;

  const inset = typeof topInset === "string" ? topInset : "0px";

  const streamWrapStyle: React.CSSProperties = useMemo(() => {
    return { paddingTop: inset };
  }, [inset]);

  const viewItems: ViewItem[] = getChatStreamViewItems({
    rendered,
    visibleTexts,
    uiLang,
  });

  const shouldShowWorkspaceFallback =
    rendered.length === 0 && visibleTexts.size === 0 && viewItems.length === 0 && !loading;

  const hasTrailingAssistantMessage = (() => {
    for (let i = viewItems.length - 1; i >= 0; i--) {
      const it = viewItems[i];
      if (it.kind !== "msg") continue;
      return it.role === "assistant";
    }
    return false;
  })();

  const fallbackCopy = useMemo(() => {
    return getChatStreamFallbackCopy({
      uiLang,
      shouldShowPreparing,
      shouldShowRecover,
      shouldShowStuck,
      userStateErr,
    });
  }, [uiLang, shouldShowPreparing, shouldShowRecover, shouldShowStuck, userStateErr]);

  const messageListNode = viewItems.map((it) => {
    if (it.kind === "divider") {
      return <DayDivider key={it.key} label={it.label} />;
    }

    if (it.kind === "compass") {
      return <ChatStreamCompass key={it.key} item={it} />;
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

        {shouldShowWorkspaceFallback ? (
          <div className={styles.hero} aria-label="workspace-fallback">
            <div className={styles.heroInner}>
              <div className={styles.heroTitle}>{fallbackCopy.title}</div>

              <div className={styles.heroSub}>{fallbackCopy.lead}</div>

              <div className={styles.hintTiny} style={{ marginTop: 10 }}>
                {fallbackCopy.mini}
              </div>

              {fallbackCopy.reason ? (
                <div className={styles.hintTiny} style={{ marginTop: 12, opacity: 0.72 }}>
                  {fallbackCopy.reason}
                </div>
              ) : null}
            </div>
          </div>
        ) : (
          <>
            {messageListNode}
            <ChatStreamLoadingRow
              loading={loading}
              hasTrailingAssistantMessage={hasTrailingAssistantMessage}
              sendingText={ui.sending}
              uiLang={uiLang}
            />
          </>
        )}

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
MessageRow / DayDivider / Compass / LoadingRow を描画する。
このファイルは本文採用や thread 判定を持たず、表示だけを担当する。
*/

/*
【今回このファイルで修正したこと】
1. rendered / visibleTexts を参照同一性前提で握り続ける useMemo を外し、毎回その時点の描画入力から viewItems を作るようにしました。
2. messageListNode も useMemo から外し、旧描画キャッシュを残さないようにしました。
3. export の React.memo を外し、親の再描画時に ChatStream 側が古い本文を保持し続けない形へ戻しました。
4. HOPY唯一の正である state_changed / HOPY回答○ / Compass判定 / DB保存 / DB復元の意味判定には触れていません。
*/

/* /components/chat/view/ChatStream.tsx */