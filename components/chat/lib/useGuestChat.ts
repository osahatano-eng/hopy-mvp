// /components/chat/lib/useGuestChat.ts
"use client";

import { useCallback, useMemo, useState } from "react";
import type { ChatMsg, Lang, Thread } from "./chatTypes";
import type { FailedSend } from "./useChatSend";

type Params = {
  authReady: boolean;
  loggedIn: boolean;
  displayLoggedIn: boolean;
  uiLang: Lang;
  input: string;
  loading: boolean;
  threadBusy: boolean;
  composing: boolean;
  messages: ChatMsg[];
  setMessages: React.Dispatch<React.SetStateAction<ChatMsg[]>>;
  setVisibleCount: React.Dispatch<React.SetStateAction<number>>;
  setInput: React.Dispatch<React.SetStateAction<string>>;
  setUserStateErr: React.Dispatch<React.SetStateAction<string | null>>;
  setLastFailed: React.Dispatch<React.SetStateAction<FailedSend | null>>;
  setAtBottom: React.Dispatch<React.SetStateAction<boolean>>;
  atBottomRef: React.MutableRefObject<boolean>;
  scrollToBottom: (behavior?: ScrollBehavior | "auto" | "smooth") => void;
  activeThreadId: string | null;
  threads: Thread[];
};

export function useGuestChat({
  input,
  loading,
  threadBusy,
  composing,
}: Params) {
  const [guestMessageCount, setGuestMessageCount] = useState(0);

  const guestCanSendNow = useMemo(() => {
    const normalizedInput = String(input ?? "").trim();
    return !loading && !threadBusy && !composing && Boolean(normalizedInput);
  }, [input, loading, threadBusy, composing]);

  const guestSendMessage = useCallback(async (_textOverride?: string) => {
    return;
  }, []);

  const resetGuestCarryOverDone = useCallback(() => {
    return;
  }, []);

  return {
    guestMessageCount,
    setGuestMessageCount,
    guestSendMessage,
    guestCanSendNow,
    resetGuestCarryOverDone,
  };
}