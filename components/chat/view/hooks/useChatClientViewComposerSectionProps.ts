// /components/chat/view/hooks/useChatClientViewComposerSectionProps.ts
"use client";

import React from "react";

type UseChatClientViewComposerSectionPropsArgs = {
  guestMode: boolean;
  workspaceMode: boolean;
  uiLang: "ja" | "en";
  uiForComposer: any;
  loading: boolean;
  threadBusy: boolean;
  threads: any[];
  activeThreadId: string | null;
  input: string;
  setInput: React.Dispatch<React.SetStateAction<string>>;
  inputRef: React.RefObject<any>;
  composerRef: React.RefObject<any>;
  composing: boolean;
  canSendNow: boolean;
  lastFailed: any;
  retryLastFailed: () => void;
  isMobile: boolean;
  sendLabel: string;
  armFocusGuard: () => void;
  runFocusGuard: () => void;
  onComposerFocusScrollBottom: () => void;
  trySend: () => void;
  tryGuestAction: () => void;
};

export function useChatClientViewComposerSectionProps(
  args: UseChatClientViewComposerSectionPropsArgs,
) {
  const {
    guestMode,
    workspaceMode,
    uiLang,
    uiForComposer,
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
    lastFailed,
    retryLastFailed,
    isMobile,
    sendLabel,
    armFocusGuard,
    runFocusGuard,
    onComposerFocusScrollBottom,
    trySend,
    tryGuestAction,
  } = args;

  const composerSectionProps = React.useMemo(
    () => ({
      guestMode,
      workspaceMode,
      uiLang,
      ui: uiForComposer,
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
      canSendGuestNow: canSendNow,
      lastFailed,
      retryLastFailed,
      guestSoftWarn: "",
      isMobile,
      sendLabel,
      onArmFocusGuard: armFocusGuard,
      onRunFocusGuard: runFocusGuard,
      onFocusScrollBottom: onComposerFocusScrollBottom,
      onTrySend: trySend,
      onTryGuestAction: tryGuestAction,
    }),
    [
      guestMode,
      workspaceMode,
      uiLang,
      uiForComposer,
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
      lastFailed,
      retryLastFailed,
      isMobile,
      sendLabel,
      armFocusGuard,
      runFocusGuard,
      onComposerFocusScrollBottom,
      trySend,
      tryGuestAction,
    ],
  );

  return {
    composerSectionProps,
  };
}

/*
このファイルの正式役割:
ChatClientView の中にあった ChatComposerSection 向け props 組み立て本体を切り出し、
入力欄表示用の受け渡し値を 1 つにまとめて返す責務だけを持つ。
このファイルは、状態や Compass を再判定する場所ではなく、
本文採用の唯一の正を作る場所でもなく、
親から受け取った値をそのまま ChatComposerSection 向け props に整えて返すだけを担当する。
*/

/*
【今回このファイルで修正したこと】
1. ChatClientView.tsx に残っていた ChatComposerSection 向け props 組み立て本体を、この新規ファイルへ切り出しました。
2. composerSectionProps の React.useMemo をこのファイルへ集約しました。
3. canSendGuestNow は既存どおり canSendNow のまま維持しました。
4. guestSoftWarn は既存どおり空文字のまま維持しました。
5. 本文採用、confirmed payload、state_changed、Compass、1..5 の唯一の正には触っていません。
*/