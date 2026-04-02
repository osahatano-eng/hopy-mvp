// /components/chat/view/chatClientViewTypes.ts
import type React from "react";
import type { ChatMsg, Lang, Thread } from "../lib/chatTypes";
import type { FailedSend } from "../lib/useChatSend";
import type { HopyState } from "../lib/stateBadge";

export type Phase1to5 = 1 | 2 | 3 | 4 | 5;

export type ConfirmedThreadState = {
  current_phase: Phase1to5;
  state_level: Phase1to5;
  prev_phase: Phase1to5;
  prev_state_level: Phase1to5;
  state_changed: boolean;
};

export type ConfirmedCompassPayload = {
  text: string;
  prompt: string | null;
};

export type ConfirmedReplyStatePayload = {
  current_phase: Phase1to5;
  state_level: Phase1to5;
  prev_phase: Phase1to5;
  prev_state_level: Phase1to5;
  state_changed: boolean;
  label?: string;
  prev_label?: string;
};

export type HopyConfirmedPayload = {
  reply: string;
  state: ConfirmedReplyStatePayload;
  compass?: ConfirmedCompassPayload;
};

export type RenderItem =
  | { kind: "divider"; key: string; label: string }
  | { kind: "msg"; key: string; msg: ChatMsg; msgKey: string };

export type UiDict = {
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
  statePhase3: string;
  statePhase4: string;
  statePhase5: string;
};

export type ChatClientViewProps = {
  rootRef: React.RefObject<HTMLElement | null>;

  loggedIn: boolean;
  email: string;

  uiLang: Lang;
  ui: UiDict;

  input: string;
  setInput: (v: string) => void;

  messages: ChatMsg[];
  loading: boolean;

  threads: Thread[];
  activeThreadId: string | null;

  activeThread?: Thread | null;
  activeThreadState?: ConfirmedThreadState | null;

  threadBusy: boolean;

  memOpen: boolean;
  setMemOpen: (v: boolean) => void;

  visibleCount: number;
  rendered: RenderItem[];
  visibleTexts: Map<string, string>;

  canShowMore: boolean;
  onShowMore: () => void;

  scrollerRef: React.RefObject<HTMLDivElement | null>;
  composerRef: React.RefObject<HTMLDivElement | null>;
  inputRef: React.RefObject<HTMLTextAreaElement | null>;

  atBottom: boolean;
  setAtBottom: (v: boolean) => void;
  scrollToBottom: (behavior?: ScrollBehavior | "auto" | "smooth") => void;
  atBottomRef: React.MutableRefObject<boolean>;

  userState: HopyState | null;
  userStateErr: string | null;

  lastFailed: FailedSend | null;
  retryLastFailed: () => void;

  login: () => Promise<void> | void;

  sendMessage: (textOverride?: string) => Promise<void> | void;

  canSend: boolean;
  normalizedInput: string;
  composing: boolean;

  disableNewChat?: boolean;
  onChangeLang?: (next: Lang) => void;
};

/*
このファイルの正式役割:
ChatClientView まわりの表示用型定義ファイル。
View に渡す props、描画用 item、UI文言、確定状態型を定義する。
このファイルは状態や Compass を判定する場所ではなく、
確定済みの値を崩さず受け取るための型の入口である。
*/

/*
【今回このファイルで修正したこと】
- ConfirmedCompassPayload.prompt を string | null に修正した。
- 直前に修正した chatStreamViewItems.ts の Compass 型と整合するようにそろえた。
- Compass の表示条件は text を中心に通し、prompt は nullable の中継値として扱えるようにした。
*/
// このファイルの正式役割: ChatClientView まわりの表示用型定義ファイル