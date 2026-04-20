// /components/chat/view/ChatOverlays.tsx
"use client";

import React from "react";
import MemoryModal from "../ui/MemoryModal";
import LeftRail from "../ui/LeftRail";
import GuestLeftRail from "../ui/GuestLeftRail";
import type { Lang, Thread } from "../lib/chatTypes";
import type { HopyState } from "../lib/stateBadge";
import type { ConfirmedThreadState } from "./chatClientViewTypes";

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
  railOpen: boolean;
  memOpen: boolean;
  uiLang: Lang;
  ui: UiDict;
  userState: HopyState | null;
  userStateErr: string | null;
  threads: Thread[] | null | undefined;
  activeThreadId: string | null;
  activeThread?: Thread | null;
  activeThreadState?: ConfirmedThreadState | null;
  disableNewChat: boolean;
  onCloseMem: () => void;
  onOpenMemories: () => void;
  onCloseRail: () => void;
  onSelectThread: (threadId: string) => void;
  onCreateThread: (opts?: { clientRequestId: string }) => void;
  onRenameThread: (threadId: string, nextTitle: string) => void;
  onDeleteThread: (threadId: string) => void;
  isLeftRailOpeningDrag?: boolean;
  leftRailOpeningStyle?: React.CSSProperties;
  leftRailOpeningBackdropStyle?: React.CSSProperties;
};

const EMPTY_THREADS: Thread[] = [];

const guestRailWrapStyle: React.CSSProperties = {
  position: "fixed",
  top: "calc(env(safe-area-inset-top, 0px) + var(--site-header-height, 64px) + 8px)",
  bottom:
    "calc(env(safe-area-inset-bottom, 0px) + var(--chat-composer-safe-height, 96px) + 8px)",
  left: 0,
  width: "min(360px, 100vw)",
  maxWidth: "100vw",
  minHeight: 0,
  zIndex: 35,
  overflow: "hidden",
  pointerEvents: "auto",
};

export const ChatOverlays = React.memo(function ChatOverlays(props: Props) {
  const {
    guestMode,
    railOpen,
    memOpen,
    uiLang,
    ui,
    userState,
    userStateErr,
    threads,
    activeThreadId,
    activeThread,
    activeThreadState,
    disableNewChat,
    onCloseMem,
    onOpenMemories,
    onCloseRail,
    onSelectThread,
    onCreateThread,
    onRenameThread,
    onDeleteThread,
    isLeftRailOpeningDrag = false,
    leftRailOpeningStyle = {},
    leftRailOpeningBackdropStyle = {},
  } = props;

  const safeThreads = React.useMemo<Thread[]>(
    () => (Array.isArray(threads) ? threads : EMPTY_THREADS),
    [threads]
  );

  const LeftRailAny = LeftRail as any;

  return (
    <>
      <MemoryModal open={memOpen} onClose={onCloseMem} uiLang={uiLang} />

      {guestMode ? (
        railOpen ? (
          <div style={guestRailWrapStyle}>
            <GuestLeftRail uiLang={uiLang} />
          </div>
        ) : null
      ) : (
        <LeftRailAny
          uiLang={uiLang}
          ui={ui}
          onOpenMemories={onOpenMemories}
          userState={userState}
          userStateErr={userStateErr}
          onClose={onCloseRail}
          railOpen={railOpen}
          threads={safeThreads}
          activeThreadId={activeThreadId}
          activeThread={activeThread}
          activeThreadState={activeThreadState ?? null}
          onSelectThread={onSelectThread}
          onCreateThread={onCreateThread}
          onRenameThread={onRenameThread}
          onDeleteThread={onDeleteThread}
          disableNewChat={disableNewChat}
          isLeftRailOpeningDrag={isLeftRailOpeningDrag}
          leftRailOpeningStyle={leftRailOpeningStyle}
          leftRailOpeningBackdropStyle={leftRailOpeningBackdropStyle}
        />
      )}
    </>
  );
});

export default ChatOverlays;

/*
このファイルの正式役割
Chat の overlay 系 UI を束ねる中継ファイル。
MemoryModal、GuestLeftRail、LeftRail へ、親から受け取った確定済み値だけを渡す。
このファイルは状態や Compass を再判定する場所ではなく、
overlay 系 UI へ同じ正を中継する責務だけを持つ。
*/

/*
【今回このファイルで修正したこと】
1. LeftRail へ userState / userStateErr を null 固定で渡していた箇所を、親から受け取った userState / userStateErr をそのまま渡す形へ戻しました。
2. userState / userStateErr を捨てるためだけの void 処理を削除しました。
3. 左下アカウント表示・名前・プラン表示が、ChatClient 側で確定した userState を受け取れる経路へ戻しました。
4. MemoryModal、GuestLeftRail、送信処理、Compass本体、MEMORIES、DB保存、DB復元、HOPY唯一の正には触っていません。
*/

/* /components/chat/view/ChatOverlays.tsx */