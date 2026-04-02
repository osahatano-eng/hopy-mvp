// /components/chat/ui/leftRailTypes.ts

import type { Lang, Thread } from "../lib/chatTypes";
import type { HopyState } from "../lib/stateBadge";
import type { ConfirmedThreadState } from "../view/chatClientViewTypes";

export type LeftRailUiLabels = {
  stateTitle: string;
  stateUnknownShort: string;
  statePhase1: string;
  statePhase2: string;
  statePhase3: string;
  statePhase4: string;
  statePhase5: string;
};

export type LeftRailProps = {
  uiLang: Lang;
  ui: LeftRailUiLabels;

  railOpen?: boolean;

  onClose?: () => void;
  onOpenMemories?: () => void;

  userState: HopyState | null;
  userStateErr: string | null;

  showCloseButton?: boolean;

  threads?: Thread[];
  activeThreadId?: string | null;
  activeThread?: Thread | null;
  activeThreadState?: ConfirmedThreadState | null;
  onSelectThread?: (threadId: string) => void;

  onCreateThread?: (opts?: { clientRequestId: string }) => any;

  onRenameThread?: (threadId: string, nextTitle: string) => void;

  onDeleteThread?: (threadId: string) => void;

  disableNewChat?: boolean;
};