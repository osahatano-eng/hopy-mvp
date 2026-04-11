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
import { getChatStreamFallbackCopy } from "./chatStreamFallbackCopy";
import ChatStreamCompass from "./ChatStreamCompass";
import ChatStreamLoadingRow from "./chatStreamLoadingRow";
import {
  getChatStreamViewItems,
  type RenderItem,
  type ViewItem,
} from "./chatStreamViewItems";

function getRawMessageRole(msg: unknown): "user" | "assistant" | null {
  const raw = String(
    (msg as any)?.role ??
      (msg as any)?.sender ??
      (msg as any)?.author ??
      "",
  )
    .trim()
    .toLowerCase();

  if (raw === "user" || raw === "assistant") return raw;
  return null;
}

function getRawMessageText(msg: unknown): string {
  const candidates = [
    (msg as any)?.text,
    (msg as any)?.content,
    (msg as any)?.body,
    (msg as any)?.message,
    (msg as any)?.reply,
    (msg as any)?.prompt,
  ];

  for (const value of candidates) {
    if (typeof value === "string") {
      const trimmed = value.trim();
      if (trimmed) return value;
    }
  }

  return "";
}

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

  const viewMessageRowCount = useMemo(() => {
    return viewItems.reduce((count, it) => {
      return it.kind === "msg" ? count + 1 : count;
    }, 0);
  }, [viewItems]);

  const rawRenderedMessageNodes = rendered
    .map((it, index) => {
      if (it.kind === "divider") {
        return <DayDivider key={it.key} label={it.label} />;
      }

      const role = getRawMessageRole((it as any)?.msg);
      const text = getRawMessageText((it as any)?.msg);

      if (!role) return null;
      if (!text) return null;

      return (
        <MessageRow
          key={it.key}
          role={role as any}
          text={text}
          uiLang={uiLang}
          msgKey={it.msgKey}
          dataRole={role === "user" ? "user" : "assistant"}
          isLastUser={false}
          assistantStateDot={undefined}
        />
      );
    })
    .filter(Boolean);

  const hasViewMessageRows = viewMessageRowCount > 0;
  const hasRawRenderedMessageRows = rawRenderedMessageNodes.length > 0;
  const shouldPreferRawRenderedMessages =
    hasRawRenderedMessageRows && !hasViewMessageRows;

  const hasRenderableRows = hasViewMessageRows || hasRawRenderedMessageRows;

  const shouldShowWorkspaceFallback =
    !hasRenderableRows && visibleTexts.size === 0 && !loading;

  const hasTrailingAssistantMessage = (() => {
    for (let i = viewItems.length - 1; i >= 0; i--) {
      const it = viewItems[i];
      if (it.kind !== "msg") continue;
      return it.role === "assistant";
    }

    for (let i = rendered.length - 1; i >= 0; i--) {
      const it = rendered[i];
      if (it.kind !== "msg") continue;
      return getRawMessageRole((it as any)?.msg) === "assistant";
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

  const messageListNode = shouldPreferRawRenderedMessages
    ? rawRenderedMessageNodes
    : viewItems.map((it) => {
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
1. viewItems.length ではなく、viewItems 内に実際の msg 行があるかどうかを viewMessageRowCount で判定するように修正しました。
2. viewItems に divider や compass しかない間は、rawRenderedMessageNodes に user / assistant の本文があればそちらを優先描画するように修正しました。
3. fallback 表示は「viewItems の msg 行も rawRendered の本文行もない」ときだけ出すように修正しました。
4. HOPY唯一の正である state_changed / HOPY回答○ / Compass判定 / DB保存 / DB復元の意味判定には触れていません。
*/

/* /components/chat/view/ChatStream.tsx */