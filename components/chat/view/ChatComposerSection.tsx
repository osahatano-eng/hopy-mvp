// /components/chat/view/ChatComposerSection.tsx
"use client";

import React, { useMemo } from "react";
import { ChatComposer } from "./ChatComposer";
import type { Lang, Thread } from "../lib/chatTypes";
import type { FailedSend } from "../lib/useChatSend";

type UiDict = {
  title: string;
  login: string;
  placeholder: string;
  sending: string;
  enterHint: string;
  jumpAria: string;
  dayStart: string;
  more: string;
  loginAlert: string;
  emptyReply: string;
  memories: string;
  retry: string;
  failed: string;
  privacy: string;
  stateTitle: string;
  stateUnknownShort: string;
  statePhase0: string;
  statePhase1: string;
  statePhase2: string;
};

type Props = {
  guestMode: boolean;
  workspaceMode: boolean;
  uiLang: Lang;
  ui: UiDict;
  loading: boolean;
  threadBusy: boolean;
  threads: Thread[];
  activeThreadId: string | null;
  input: string;
  setInput: (v: string) => void;
  inputRef: React.RefObject<HTMLTextAreaElement | null>;
  composerRef: React.RefObject<HTMLDivElement | null>;
  composing: boolean;
  canSendNow: boolean;
  canSendGuestNow: boolean;
  lastFailed: FailedSend | null;
  retryLastFailed: () => void;
  guestSoftWarn: string;
  isMobile: boolean;
  sendLabel: string;
  onArmFocusGuard: () => void;
  onRunFocusGuard: () => void;
  onFocusScrollBottom: () => void;
  onTrySend: () => void;
  onTryGuestAction: () => void;
};

const EMPTY_THREADS: Thread[] = [];
const NOOP = () => {};

export const ChatComposerSection = React.memo(function ChatComposerSection(props: Props) {
  const {
    guestMode,
    workspaceMode,
    uiLang,
    ui,
    loading,
    threadBusy,
    threads,
    activeThreadId,
    input,
    setInput,
    inputRef,
    composerRef,
    composing,
    canSendNow,
    canSendGuestNow,
    lastFailed,
    retryLastFailed,
    guestSoftWarn,
    isMobile,
    sendLabel,
    onArmFocusGuard,
    onRunFocusGuard,
    onFocusScrollBottom,
    onTrySend,
    onTryGuestAction,
  } = props;

  void workspaceMode;

  const commonProps = useMemo(
    () => ({
      uiLang,
      ui,
      loading,
      threadBusy,
      input,
      setInput,
      inputRef,
      composerRef,
      composing,
      isMobile,
      sendLabel,
      onArmFocusGuard,
      onRunFocusGuard,
      onFocusScrollBottom,
    }),
    [
      uiLang,
      ui,
      loading,
      threadBusy,
      input,
      setInput,
      inputRef,
      composerRef,
      composing,
      isMobile,
      sendLabel,
      onArmFocusGuard,
      onRunFocusGuard,
      onFocusScrollBottom,
    ],
  );

  if (guestMode) {
    return (
      <ChatComposer
        {...commonProps}
        loggedIn={false}
        threads={EMPTY_THREADS}
        activeThreadId={null}
        canSendNow={canSendGuestNow}
        lastFailed={null}
        retryLastFailed={NOOP}
        softWarn={guestSoftWarn}
        onTrySend={onTryGuestAction}
      />
    );
  }

  return (
    <ChatComposer
      {...commonProps}
      loggedIn={true}
      threads={threads}
      activeThreadId={activeThreadId}
      canSendNow={canSendNow}
      lastFailed={lastFailed}
      retryLastFailed={retryLastFailed}
      softWarn={null}
      onTrySend={onTrySend}
    />
  );
});

export default ChatComposerSection;

/*
このファイルの正式役割:
ChatComposerSection は、親から受け取った値を ChatComposer 向け props に整えて渡すことだけを担当する。
このファイルは、本文採用の正を作る場所でも、状態や Compass を再判定する場所でもない。
guest / logged-in の入口を分けつつ、送信欄に必要な props をそのまま中継するだけを役割とする。
*/

/*
【今回このファイルで修正したこと】
1. 非 guest 分岐で ChatComposer に渡す loggedIn を workspaceMode ではなく true に固定しました。
2. 通常のログイン利用で loggedIn=false になりうる混線を、このファイル内だけで止めました。
3. guest 分岐、送信関数、loading、threadBusy、threads、activeThreadId、本文採用、HOPY唯一の正には触っていません。
*/

/* /components/chat/view/ChatComposerSection.tsx */