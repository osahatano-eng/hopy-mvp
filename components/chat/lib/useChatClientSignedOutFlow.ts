// /components/chat/lib/useChatClientSignedOutFlow.ts
"use client";

import { useCallback, useEffect } from "react";

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
  const shouldHoldSignedOutScreen = Boolean(logoutRedirecting);

  useEffect(() => {
    if (!logoutRedirecting) return;

    try {
      if (window.location.pathname !== "/") {
        window.location.replace("/");
      }
    } catch {}
  }, [logoutRedirecting]);

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

    if (!displayLoggedIn && logoutRedirecting) {
      try {
        setEmail("");
      } catch {}
    }

    if (!loggedIn) {
      if (!logoutRedirecting) {
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
    loggedIn,
    logoutRedirecting,
    resetLoggedOutState,
    setEmail,
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
1. ログアウト後の "/" 遷移を authReady / displayLoggedIn の変化待ちから切り離しました。
2. logoutRedirecting=true を受けた時点で、即時に "/" へ replace する一本道にしました。
3. prevDisplayLoggedInRef / signedOutFromLoggedIn / justSignedOut を削除しました。
4. DevTools 起動中の focus / visibilitychange / auth 表示揺れで "/" 遷移タイミングを逃す経路を削除しました。
5. 本当のログアウト時だけ workspace state を消す方針は維持しました。
6. タブ復帰時の一時的な auth 揺れでは ChatClient 内の workspace state を維持する形を維持しました。
7. HOPY回答○、Compass、confirmed payload、state_changed、状態値 1..5 / 5段階、DB保存・復元の唯一の正には触っていません。
*/

/* /components/chat/lib/useChatClientSignedOutFlow.ts */