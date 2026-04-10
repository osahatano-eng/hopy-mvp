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

  clearThreadViewRefs: () => void;
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

  const justSignedOut =
    authReady &&
    prevDisplayLoggedInRef.current &&
    !displayLoggedIn;

  useEffect(() => {
    if (!authReady) return;

    if (displayLoggedIn) {
      setSignedOutFromLoggedIn(false);
      prevDisplayLoggedInRef.current = true;
      return;
    }

    if (prevDisplayLoggedInRef.current) {
      setSignedOutFromLoggedIn(true);
    }

    prevDisplayLoggedInRef.current = false;
  }, [authReady, displayLoggedIn]);

  const shouldHoldSignedOutScreen =
    authReady &&
    !displayLoggedIn &&
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

  const resetLoggedOutState = useCallback(
    ({
      clearMessages,
      clearLoading,
      clearActiveThreadRef,
      clearLastThreadDecision,
    }: {
      clearMessages: boolean;
      clearLoading: boolean;
      clearActiveThreadRef: boolean;
      clearLastThreadDecision: boolean;
    }) => {
      void clearLastThreadDecision;

      try {
        clearActiveThreadId();
      } catch {}

      try {
        setThreads([]);
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

      if (clearActiveThreadRef) {
        try {
          activeThreadIdRef.current = null;
        } catch {}
      }

      try {
        clearThreadViewRefs();
      } catch {}
    },
    [
      activeThreadIdRef,
      clearThreadViewRefs,
      resetRailState,
      setActiveThreadId,
      setLastFailed,
      setLoading,
      setMessages,
      setThreads,
      setThreadBusy,
      setUserState,
      setUserStateErr,
      setVisibleCount,
    ],
  );

  const clearTemporaryGuestSelection = useCallback(() => {
    try {
      clearActiveThreadId();
    } catch {}

    try {
      setActiveThreadId(null);
    } catch {}

    try {
      setMessages([]);
    } catch {}

    try {
      setVisibleCount(200);
    } catch {}

    try {
      activeThreadIdRef.current = null;
    } catch {}

    try {
      clearThreadViewRefs();
    } catch {}
  }, [
    activeThreadIdRef,
    clearThreadViewRefs,
    setActiveThreadId,
    setMessages,
    setVisibleCount,
  ]);

  useEffect(() => {
    if (!authReady) return;

    if (!displayLoggedIn) {
      try {
        setEmail("");
      } catch {}
    }

    if (!loggedIn) {
      if (!signedOutCauseRef.current) {
        resetLoggedOutState({
          clearMessages: false,
          clearLoading: false,
          clearActiveThreadRef: false,
          clearLastThreadDecision: false,
        });
        return;
      }

      resetLoggedOutState({
        clearMessages: true,
        clearLoading: true,
        clearActiveThreadRef: true,
        clearLastThreadDecision: true,
      });
      return;
    }
  }, [
    authReady,
    displayLoggedIn,
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
1. lib 配下の新規ファイルなのに ../ になっていた相対 import を ./ に修正しました。
2. これにより、chatTypes / useChatSend / stateBadge / threadStore / chatThreadIdentity の参照先を同階層へ戻しました。
3. hook 内ロジックそのもの、HOPY回答○、Compass、confirmed payload、DB保存・復元の唯一の正には触っていません。
*/