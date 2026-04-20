// /components/chat/ui/useLeftRailController.ts

"use client";

import React from "react";
import type { Thread } from "../lib/chatTypes";
import type { HopyState } from "../lib/stateBadge";
import {
  dispatchSafe,
  isThenable,
  readRailOpen,
  safeRemove,
  safeUUID,
  writeRailOpen,
} from "./leftRailStorage";
import { buildLeftRailLabels } from "./leftRailLabels";
import { buildActiveThreadState } from "./leftRailState";
import type { LeftRailProps } from "./leftRailTypes";

type Params = {
  props: LeftRailProps;
  labels: ReturnType<typeof buildLeftRailLabels>;
};

function useRailOpenState(isControlled: boolean, railOpen?: boolean) {
  const [isOpenInternal, setIsOpenInternal] = React.useState(false);
  const isOpen = isControlled ? Boolean(railOpen) : isOpenInternal;

  React.useEffect(() => {
    if (typeof window === "undefined") return;
    if (isControlled) return;
    setIsOpenInternal(readRailOpen());
  }, [isControlled]);

  React.useEffect(() => {
    if (typeof window === "undefined") return;
    if (isControlled) return;

    function onToggle() {
      setIsOpenInternal((v) => {
        const next = !v;
        writeRailOpen(next);
        return next;
      });
    }

    window.addEventListener("hopy:toggle-left-rail", onToggle as any);
    return () => window.removeEventListener("hopy:toggle-left-rail", onToggle as any);
  }, [isControlled]);

  const openLayer = React.useCallback(() => {
    if (!isControlled) {
      setIsOpenInternal(true);
      writeRailOpen(true);
    }
  }, [isControlled]);

  return {
    isOpen,
    setIsOpenInternal,
    openLayer,
  };
}

function useActiveMenuState() {
  const [activeMenuOpen, setActiveMenuOpen] = React.useState(false);
  const activeMenuRef = React.useRef<HTMLDivElement | null>(null);

  React.useEffect(() => {
    if (!activeMenuOpen) return;

    const onDocPointer = (e: MouseEvent | TouchEvent) => {
      const root = activeMenuRef.current;
      if (!root) return;
      if (!e.target || !(e.target instanceof Node)) return;
      if (root.contains(e.target)) return;
      setActiveMenuOpen(false);
    };

    document.addEventListener("mousedown", onDocPointer);
    document.addEventListener("touchstart", onDocPointer);

    return () => {
      document.removeEventListener("mousedown", onDocPointer);
      document.removeEventListener("touchstart", onDocPointer);
    };
  }, [activeMenuOpen]);

  return {
    activeMenuOpen,
    setActiveMenuOpen,
    activeMenuRef,
  };
}

function useRailCloseActions(params: {
  isControlled: boolean;
  onClose?: () => void;
  setIsOpenInternal: React.Dispatch<React.SetStateAction<boolean>>;
  setActiveMenuOpen: React.Dispatch<React.SetStateAction<boolean>>;
}) {
  const { isControlled, onClose, setIsOpenInternal, setActiveMenuOpen } = params;

  const closeLayer = React.useCallback(() => {
    if (!isControlled) {
      setIsOpenInternal(false);
      writeRailOpen(false);
    }
    setActiveMenuOpen(false);
    if (typeof onClose === "function") onClose();
  }, [isControlled, onClose, setIsOpenInternal, setActiveMenuOpen]);

  const closeLayerNextFrame = React.useCallback(() => {
    try {
      requestAnimationFrame(() => closeLayer());
      return;
    } catch {}
    try {
      setTimeout(() => closeLayer(), 0);
      return;
    } catch {}
    closeLayer();
  }, [closeLayer]);

  return {
    closeLayer,
    closeLayerNextFrame,
  };
}

function useEscapeCloseEffect(params: {
  isOpen: boolean;
  activeMenuOpen: boolean;
  setActiveMenuOpen: React.Dispatch<React.SetStateAction<boolean>>;
  closeLayer: () => void;
}) {
  const { isOpen, activeMenuOpen, setActiveMenuOpen, closeLayer } = params;

  React.useEffect(() => {
    if (typeof window === "undefined") return;
    if (!isOpen) return;

    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        if (activeMenuOpen) {
          setActiveMenuOpen(false);
          return;
        }
        closeLayer();
      }
    }

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isOpen, activeMenuOpen, setActiveMenuOpen, closeLayer]);
}

function useRecoverState(userStateErr: string | null) {
  return React.useMemo(() => {
    return typeof userStateErr === "string" && userStateErr.trim().length > 0;
  }, [userStateErr]);
}

function useThreadsViewModel(params: {
  threads?: Thread[];
  activeThreadId?: string | null;
  activeThreadProp?: Thread | null;
  activeThreadStateProp?: HopyState | null;
  untitled: string;
}) {
  const { threads, activeThreadId, activeThreadProp, activeThreadStateProp, untitled } = params;

  const threadsSafe: Thread[] = React.useMemo(() => (Array.isArray(threads) ? threads : []), [threads]);
  const hasThreads = threadsSafe.length > 0;

  const activeIdSafe = React.useMemo(() => String(activeThreadId ?? "").trim(), [activeThreadId]);

  const activeThreadFromList: any = React.useMemo(() => {
    if (!activeIdSafe) return null;
    return threadsSafe.find((x: any) => String(x?.id ?? "").trim() === activeIdSafe) ?? null;
  }, [threadsSafe, activeIdSafe]);

  const activeThread: any = React.useMemo(() => {
    if (activeThreadFromList) return activeThreadFromList;
    if (activeThreadProp) return activeThreadProp as any;
    return null;
  }, [activeThreadFromList, activeThreadProp]);

  const activeThreadTitle = React.useMemo(() => {
    try {
      if (!activeThread) return "";
      const title = String((activeThread as any)?.title ?? "").trim();
      return title || untitled;
    } catch {
      return untitled;
    }
  }, [activeThread, untitled]);

  const activeThreadState: HopyState | null = React.useMemo(() => {
    if (activeThreadFromList) {
      const listState = buildActiveThreadState(activeThreadFromList);
      if (listState) return listState;
    }

    if (activeThreadStateProp) return activeThreadStateProp;

    return buildActiveThreadState(activeThread);
  }, [activeThreadFromList, activeThreadStateProp, activeThread]);

  const titleCountMap = React.useMemo(() => {
    const map = new Map<string, number>();
    for (const th of threadsSafe) {
      const baseTitle = String((th as any)?.title ?? "").trim() || untitled;
      map.set(baseTitle, (map.get(baseTitle) ?? 0) + 1);
    }
    return map;
  }, [threadsSafe, untitled]);

  return {
    threadsSafe,
    hasThreads,
    activeIdSafe,
    activeThread,
    activeThreadTitle,
    activeThreadState,
    titleCountMap,
  };
}

function useInitialControlledAutoCloseEffect(params: {
  isControlled: boolean;
  railOpen?: boolean;
  isOpen: boolean;
  activeIdSafe: string;
  hasThreads: boolean;
  showRecover: boolean;
  onClose?: () => void;
}) {
  const { isControlled, railOpen, isOpen, activeIdSafe, hasThreads, showRecover, onClose } = params;

  const initialControlledOpenRef = React.useRef<boolean>(Boolean(isControlled && railOpen));
  const initialAutoClosedRef = React.useRef(false);

  React.useEffect(() => {
    if (!isControlled) return;
    if (!initialControlledOpenRef.current) return;
    if (!isOpen) return;
    if (initialAutoClosedRef.current) return;
    if (activeIdSafe) return;
    if (hasThreads) return;
    if (showRecover) return;

    initialAutoClosedRef.current = true;

    try {
      writeRailOpen(false);
    } catch {}

    if (typeof onClose === "function") {
      try {
        onClose();
      } catch {}
    }
  }, [isControlled, isOpen, activeIdSafe, hasThreads, showRecover, onClose]);
}

function useHandleReset() {
  return React.useCallback(() => {
    safeRemove(["hopy_auth", "hopy_active_thread", "hopy_rail_open", "supabase.auth.token", "sb-auth-token"]);
    try {
      location.reload();
    } catch {}
  }, []);
}

function useCreateThreadAction(onCreateThreadProp?: (opts?: { clientRequestId: string }) => any) {
  const creatingRef = React.useRef(false);
  const createOpRef = React.useRef<{ id: string; at: number }>({ id: "", at: 0 });
  const CREATE_REQ_REUSE_MS = 500;

  return React.useCallback(() => {
    if (creatingRef.current) return;
    creatingRef.current = true;

    let released = false;
    const release = () => {
      if (released) return;
      released = true;
      creatingRef.current = false;
    };

    let waitPromise = false;

    try {
      const now = Date.now();
      const prev = createOpRef.current;
      const dt = now - (prev.at || 0);
      const reuse = Boolean(prev.id) && dt >= 0 && dt <= CREATE_REQ_REUSE_MS;

      const clientRequestId = reuse ? prev.id : safeUUID();
      createOpRef.current = { id: clientRequestId, at: now };

      if (typeof onCreateThreadProp === "function") {
        const ret = onCreateThreadProp({ clientRequestId });

        if (isThenable(ret)) {
          waitPromise = true;
          try {
            (ret as PromiseLike<any>).then(
              () => release(),
              () => release()
            );
            return;
          } catch {
            waitPromise = false;
          }
        }
      } else {
        dispatchSafe("hopy:create-thread", { reason: "ui:left-rail", source: "direct", clientRequestId });
      }
    } finally {
      if (waitPromise) return;

      try {
        setTimeout(() => {
          release();
        }, 60);
      } catch {
        release();
      }
    }
  }, [onCreateThreadProp]);
}

function useThreadSelectionAction() {
  return React.useCallback((threadId: string, threadTitle?: string) => {
    const id = String(threadId ?? "").trim();
    const title = String(threadTitle ?? "").trim();
    if (!id) return;

    try {
      dispatchSafe("hopy:select-thread", {
        threadId: id,
        id,
        selectedThreadId: id,
        selectedTitle: title || undefined,
        reason: "ui:left-rail",
        source: "direct",
      });
    } catch {}
  }, []);
}

function useThreadRenameAction(onRenameThread?: (threadId: string, nextTitle: string) => void) {
  return React.useCallback(
    (threadId: string, nextTitle: string, prevTitle?: string) => {
      const id = String(threadId ?? "").trim();
      const title = String(nextTitle ?? "").trim();
      const prev = String(prevTitle ?? "").trim();
      if (!id || !title) return;

      if (typeof onRenameThread === "function") {
        onRenameThread(id, title);
        return;
      }

      let updated_at = "";
      try {
        updated_at = new Date().toISOString();
      } catch {}

      const refreshPayload: any = {
        reason: "rename:optimistic",
        id,
        threadId: id,
        title,
        source: "direct",
      };
      if (updated_at) refreshPayload.updated_at = updated_at;
      if (prev) refreshPayload.prevTitle = prev;

      dispatchSafe("hopy:threads-refresh", refreshPayload);

      const renamePayload: any = {
        threadId: id,
        id,
        title,
        reason: "ui:left-rail",
        source: "direct",
      };
      if (prev) renamePayload.prevTitle = prev;

      dispatchSafe("hopy:rename-thread", renamePayload);
    },
    [onRenameThread]
  );
}

function useThreadDeleteAction(onDeleteThread?: (threadId: string) => void) {
  return React.useCallback(
    (threadId: string, title?: string) => {
      const id = String(threadId ?? "").trim();
      const prevTitle = String(title ?? "").trim();
      if (!id) return;

      if (typeof onDeleteThread === "function") {
        onDeleteThread(id);
        return;
      }

      dispatchSafe("hopy:delete-thread", {
        threadId: id,
        id,
        prevTitle: prevTitle || undefined,
        reason: "ui:left-rail",
        source: "direct",
      });
    },
    [onDeleteThread]
  );
}

function useOpenMemoriesAction(params: {
  props: LeftRailProps;
  closeLayerNextFrame: () => void;
}) {
  const { props, closeLayerNextFrame } = params;

  return React.useCallback(() => {
    const onOpenMemories = (props as any)?.onOpenMemories;

    if (typeof onOpenMemories === "function") {
      try {
        onOpenMemories();
      } finally {
        closeLayerNextFrame();
      }
      return;
    }

    try {
      dispatchSafe("hopy:open-memories", {
        reason: "ui:left-rail",
        source: "direct",
      });
    } finally {
      closeLayerNextFrame();
    }
  }, [props, closeLayerNextFrame]);
}

function usePromptRenameAction(params: {
  renameLabel: string;
  closeLayer: () => void;
  setActiveMenuOpen: React.Dispatch<React.SetStateAction<boolean>>;
  emitRenameThread: (threadId: string, nextTitle: string, prevTitle?: string) => void;
}) {
  const { renameLabel, closeLayer, setActiveMenuOpen, emitRenameThread } = params;

  return React.useCallback(
    (threadId: string, currentTitle: string) => {
      if (typeof window === "undefined" || typeof window.prompt !== "function") return;

      const next = window.prompt(renameLabel, currentTitle);
      if (next == null) return;
      const trimmed = String(next).trim();
      if (!trimmed) return;

      try {
        emitRenameThread(threadId, trimmed, currentTitle);
      } finally {
        setActiveMenuOpen(false);
        closeLayer();
      }
    },
    [renameLabel, closeLayer, setActiveMenuOpen, emitRenameThread]
  );
}

function useConfirmDeleteAction(params: {
  deleteConfirmLabel: string;
  closeLayer: () => void;
  setActiveMenuOpen: React.Dispatch<React.SetStateAction<boolean>>;
  emitDeleteThread: (threadId: string, title?: string) => void;
}) {
  const { deleteConfirmLabel, closeLayer, setActiveMenuOpen, emitDeleteThread } = params;

  return React.useCallback(
    (threadId: string, currentTitle: string) => {
      if (typeof window === "undefined" || typeof window.confirm !== "function") return;
      const ok = window.confirm(deleteConfirmLabel);
      if (!ok) return;

      try {
        emitDeleteThread(threadId, currentTitle);
      } finally {
        setActiveMenuOpen(false);
        closeLayer();
      }
    },
    [deleteConfirmLabel, closeLayer, setActiveMenuOpen, emitDeleteThread]
  );
}

export function useLeftRailController({ props, labels: t }: Params) {
  const {
    onClose,
    userStateErr,
    threads,
    activeThreadId,
    activeThread: activeThreadProp,
    onCreateThread: onCreateThreadProp,
    onRenameThread,
    onDeleteThread,
  } = props;

  const activeThreadStateProp = ((props as any)?.activeThreadState ?? null) as HopyState | null;
  const isControlled = typeof props.railOpen === "boolean";

  const { isOpen, setIsOpenInternal, openLayer } = useRailOpenState(isControlled, props.railOpen);
  const { activeMenuOpen, setActiveMenuOpen, activeMenuRef } = useActiveMenuState();
  const { closeLayer, closeLayerNextFrame } = useRailCloseActions({
    isControlled,
    onClose,
    setIsOpenInternal,
    setActiveMenuOpen,
  });

  useEscapeCloseEffect({
    isOpen,
    activeMenuOpen,
    setActiveMenuOpen,
    closeLayer,
  });

  const showRecover = useRecoverState(userStateErr);

  const {
    threadsSafe,
    hasThreads,
    activeIdSafe,
    activeThread,
    activeThreadTitle,
    activeThreadState,
    titleCountMap,
  } = useThreadsViewModel({
    threads,
    activeThreadId,
    activeThreadProp,
    activeThreadStateProp,
    untitled: t.untitled,
  });

  const disableNewChat = React.useMemo(() => {
    return Boolean(props.disableNewChat);
  }, [props.disableNewChat]);

  useInitialControlledAutoCloseEffect({
    isControlled,
    railOpen: props.railOpen,
    isOpen,
    activeIdSafe,
    hasThreads,
    showRecover,
    onClose,
  });

  const handleReset = useHandleReset();
  const createThread = useCreateThreadAction(onCreateThreadProp);
  const emitSelectThread = useThreadSelectionAction();
  const emitRenameThread = useThreadRenameAction(onRenameThread);
  const emitDeleteThread = useThreadDeleteAction(onDeleteThread);
  const openMemories = useOpenMemoriesAction({
    props,
    closeLayerNextFrame,
  });

  const promptRename = usePromptRenameAction({
    renameLabel: t.rename,
    closeLayer,
    setActiveMenuOpen,
    emitRenameThread,
  });

  const confirmDelete = useConfirmDeleteAction({
    deleteConfirmLabel: t.deleteConfirm,
    closeLayer,
    setActiveMenuOpen,
    emitDeleteThread,
  });

  const showCloseBtn = React.useMemo(() => {
    return Boolean(props.showCloseButton ?? true);
  }, [props.showCloseButton]);

  return {
    isOpen,
    closeLayer,
    closeLayerNextFrame,
    openLayer,
    showRecover,
    threadsSafe,
    hasThreads,
    activeIdSafe,
    activeThread,
    activeThreadTitle,
    activeThreadState,
    disableNewChat,
    activeMenuOpen,
    activeMenuRef,
    setActiveMenuOpen,
    createThread,
    titleCountMap,
    emitSelectThread,
    promptRename,
    confirmDelete,
    openMemories,
    handleReset,
    showCloseBtn,
  };
}

/*
このファイルの正式役割
LeftRail 内の操作責務だけを持ち、開閉、スレッド選択、新規作成、名前変更、削除、Memories 起動のイベント中継を行う。
状態の唯一の正は作らず、受け取った props と確定済み値を UI 操作へ渡すだけに限定する。
*/

/*
【今回このファイルで修正したこと】
1. useThreadSelectionAction が親の onSelectThread を優先して hopy:select-thread の直接 dispatch を止めていた経路を削除しました。
2. スレッド選択は必ず hopy:select-thread を dispatch する一本道に戻しました。
3. useLeftRailController から onSelectThread の受け取りを削除し、左カラムのスレッド選択入口を emitSelectThread → hopy:select-thread に統一しました。
4. New Chat、状態表示、メモリーズ、Recover、左下アカウント表示、HOPY唯一の正、state_changed、Compass、DB保存・復元には触っていません。
*/

/* /components/chat/ui/useLeftRailController.ts */