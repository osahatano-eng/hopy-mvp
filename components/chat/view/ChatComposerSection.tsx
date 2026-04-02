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
    ]
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
      loggedIn={workspaceMode}
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