// /components/chat/lib/useChatClientSignedOutFlow.ts
"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import type React from "react";
import type { ChatMsg, Thread } from "./chatTypes";
import type { FailedSend } from "./useChatSend";
import type { HopyState } from "./stateBadge";

import { clearActiveThreadId } from "./threadStore";
import { isTemporaryGuestThreadId } from "./chatThreadIdentity";

type UseChatClientSignedOutFlowArgs = {
  authReady: boolean;
  displayLoggedIn: boolean;
  loggedIn: boolean;
  logoutRedirecting: boolean;
  signedOutCauseRef: React.MutableRefObject<unknown>;
  activeThreadId: string | null;

  activeThreadIdRef: React.MutableRefObject<string | null>;

  clearThreadViewRefs?: () => void;
  resetRailState: () => void;

  setEmail: React.Dispatch<React.SetStateAction<string>>;
  setMessages: React.Dispatch<React.SetStateAction<ChatMsg[]>>;
  setLoading: React.Dispatch<React.SetStateAction<boolean>>;
  setVisibleCount: React.Dispatch<React.SetStateAction<number>>;
  setThreads: React.Dispatch<React.SetStateAction<Thread[]>>;
  setActiveThreadId: React.Dispatch<React.SetStateAction<string | null>>;
  setThreadBusy: React.Dispatch<React.SetStateAction<boolean>>;
  setLastFailed: React.Dispatch<React.SetStateAction<FailedSend | null>>;
  setUserState: React.Dispatch<React.SetStateAction<HopyState | null>>;
  setUserStateErr: React.Dispatch<React.SetStateAction<string | null>>;
};

export function useChatClientSignedOutFlow({
  authReady,
  displayLoggedIn,
  loggedIn,
  logoutRedirecting,
  signedOutCauseRef,
  activeThreadId,
  activeThreadIdRef,
  clearThreadViewRefs,
  resetRailState,
  setEmail,
  setMessages,
  setLoading,
  setVisibleCount,
  setThreads,
  setActiveThreadId,
  setThreadBusy,
  setLastFailed,
  setUserState,
  setUserStateErr,
}: UseChatClientSignedOutFlowArgs) {
  const prevDisplayLoggedInRef = useRef(false);
  const [signedOutFromLoggedIn, setSignedOutFromLoggedIn] = useState(false);

  const hasRealSignedOutSignal = Boolean(
    logoutRedirecting || signedOutCauseRef.current,
  );

  const justSignedOut =
    authReady &&
    prevDisplayLoggedInRef.current &&
    !displayLoggedIn &&
    hasRealSignedOutSignal;

  useEffect(() => {
    if (!authReady) return;

    if (displayLoggedIn) {
      setSignedOutFromLoggedIn(false);
      prevDisplayLoggedInRef.current = true;
      return;
    }

    if (prevDisplayLoggedInRef.current && hasRealSignedOutSignal) {
      setSignedOutFromLoggedIn(true);
    } else {
      setSignedOutFromLoggedIn(false);
    }

    prevDisplayLoggedInRef.current = false;
  }, [authReady, displayLoggedIn, hasRealSignedOutSignal]);

  const shouldHoldSignedOutScreen =
    authReady &&
    !displayLoggedIn &&
    hasRealSignedOutSignal &&
    Boolean(
      logoutRedirecting ||
        signedOutCauseRef.current ||
        signedOutFromLoggedIn ||
        justSignedOut,
    );

  useEffect(() => {
    if (!shouldHoldSignedOutScreen) return;

    try {
      if (window.location.pathname !== "/") {
        window.location.replace("/");
      }
    } catch {}
  }, [shouldHoldSignedOutScreen]);

  const clearSelectedThreadState = useCallback(
    ({
      clearMessages,
      clearActiveThreadRef,
    }: {
      clearMessages: boolean;
      clearActiveThreadRef: boolean;
    }) => {
      try {
        clearActiveThreadId();
      } catch {}

      try {
        setActiveThreadId(null);
      } catch {}

      if (clearMessages) {
        try {
          setMessages([]);
        } catch {}

        try {
          setVisibleCount(200);
        } catch {}
      }

      if (clearActiveThreadRef) {
        try {
          activeThreadIdRef.current = null;
        } catch {}
      }

      try {
        clearThreadViewRefs?.();
      } catch {}
    },
    [
      activeThreadIdRef,
      clearThreadViewRefs,
      setActiveThreadId,
      setMessages,
      setVisibleCount,
    ],
  );

  const resetLoggedOutState = useCallback(
    ({
      clearMessages,
      clearLoading,
      clearActiveThreadRef,
    }: {
      clearMessages: boolean;
      clearLoading: boolean;
      clearActiveThreadRef: boolean;
    }) => {
      clearSelectedThreadState({
        clearMessages,
        clearActiveThreadRef,
      });

      try {
        setThreads([]);
      } catch {}

      try {
        setUserState(null);
      } catch {}

      try {
        setUserStateErr(null);
      } catch {}

      try {
        setLastFailed(null);
      } catch {}

      try {
        setThreadBusy(false);
      } catch {}

      if (clearLoading) {
        try {
          setLoading(false);
        } catch {}
      }

      try {
        resetRailState();
      } catch {}
    },
    [
      clearSelectedThreadState,
      resetRailState,
      setLastFailed,
      setLoading,
      setThreads,
      setThreadBusy,
      setUserState,
      setUserStateErr,
    ],
  );

  const clearTemporaryGuestSelection = useCallback(() => {
    clearSelectedThreadState({
      clearMessages: true,
      clearActiveThreadRef: true,
    });
  }, [clearSelectedThreadState]);

  useEffect(() => {
    if (!authReady) return;

    if (!displayLoggedIn && hasRealSignedOutSignal) {
      try {
        setEmail("");
      } catch {}
    }

    if (!loggedIn) {
      if (!hasRealSignedOutSignal) {
        return;
      }

      if (!signedOutCauseRef.current) {
        resetLoggedOutState({
          clearMessages: false,
          clearLoading: false,
          clearActiveThreadRef: false,
        });
        return;
      }

      resetLoggedOutState({
        clearMessages: true,
        clearLoading: true,
        clearActiveThreadRef: true,
      });
      return;
    }
  }, [
    authReady,
    displayLoggedIn,
    hasRealSignedOutSignal,
    loggedIn,
    resetLoggedOutState,
    setEmail,
    signedOutCauseRef,
  ]);

  useEffect(() => {
    if (!authReady) return;
    if (!displayLoggedIn) return;

    const tid = String(activeThreadId ?? "").trim();
    if (!tid) return;
    if (!isTemporaryGuestThreadId(tid)) return;

    clearTemporaryGuestSelection();
  }, [
    activeThreadId,
    authReady,
    clearTemporaryGuestSelection,
    displayLoggedIn,
  ]);

  return {
    shouldHoldSignedOutScreen,
  };
}

/*
このファイルの正式役割
ChatClient の中に混在していた、
サインアウト後の画面保持・状態リセット・一時ゲスト選択解除の責務だけを受け持つ。
親ファイルはこの hook を呼び、戻り値と副作用結果を受け取るだけに寄せる。
*/

/*
【今回このファイルで修正したこと】
1. logoutRedirecting または signedOutCauseRef.current があるときだけ「本当のサインアウト信号」として扱う hasRealSignedOutSignal を追加しました。
2. displayLoggedIn が落ちただけでは signedOutFromLoggedIn / justSignedOut / shouldHoldSignedOutScreen が立たないようにし、一時的な auth 揺れで / へ退避しない形へ戻しました。
3. !loggedIn 時の resetLoggedOutState も、本当のサインアウト信号があるときだけ動くようにし、一時的な auth 揺れで threads / activeThreadId / userState などを消さないようにしました。
4. hook 内ロジックの意味、HOPY回答○、Compass、confirmed payload、DB保存・復元の唯一の正には触っていません。
*/

/* /components/chat/lib/useChatClientSignedOutFlow.ts */