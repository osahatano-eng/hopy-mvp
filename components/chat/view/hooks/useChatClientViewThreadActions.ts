// /components/chat/view/hooks/useChatClientViewThreadActions.ts
"use client";

import React from "react";

type UseChatClientViewThreadActionsArgs = {
  threads: any[];
  activeThreadId: string | null;
  shouldHoldBlankThreadStage: boolean;
  disableNewChat: boolean;
  canRunWorkspaceAction: () => boolean;
  setWorkspaceHeroDismissed: (next: boolean) => void;
  closeRailForViewport: () => void;
};

function safeUUID(): string {
  try {
    const g: any = globalThis as any;
    if (g?.crypto && typeof g.crypto.randomUUID === "function") {
      return `cr_${g.crypto.randomUUID()}`;
    }
  } catch {}

  try {
    return `cr_${Date.now()}_${Math.random().toString(16).slice(2)}`;
  } catch {
    return `cr_${Date.now()}`;
  }
}

function findThreadTitleById(list: any[], threadId: string): string {
  const id = String(threadId ?? "").trim();
  if (!id) return "";

  try {
    const arr = Array.isArray(list) ? list : [];
    return String(
      arr.find((t) => String((t as any)?.id ?? "").trim() === id)?.title ?? "",
    ).trim();
  } catch {
    return "";
  }
}

function buildPrevTitleAliases(prevTitle: string) {
  const value = String(prevTitle ?? "").trim() || undefined;

  return {
    prevTitle: value,
    previousTitle: value,
    prev_title: value,
    previous_title: value,
  };
}

function withDirectSource<T extends Record<string, any>>(detail: T) {
  return {
    ...detail,
    source: "direct" as const,
  };
}

function buildThreadIdentityDetail(threadId: string) {
  const id = String(threadId ?? "").trim();

  return {
    threadId: id,
    id,
  };
}

function buildThreadReasonDetail(threadId: string, reason: string) {
  return withDirectSource({
    ...buildThreadIdentityDetail(threadId),
    reason,
  });
}

function buildSelectThreadDetail(
  threadId: string,
  reason: string,
  selectedTitle?: string,
) {
  const id = String(threadId ?? "").trim();

  return withDirectSource({
    ...buildThreadIdentityDetail(id),
    selectedThreadId: id,
    selectedTitle: selectedTitle || undefined,
    reason,
  });
}

function buildCreateThreadDetail(clientRequestId: string) {
  const id = String(clientRequestId ?? "").trim();

  return withDirectSource({
    ...buildThreadIdentityDetail(id),
    selectedThreadId: id,
    clientRequestId: id,
  });
}

function dispatchWindowEvent(name: string, detail: any) {
  try {
    if (typeof window === "undefined") return;
    window.dispatchEvent(new CustomEvent(name, { detail }));
  } catch {}
}

function dispatchWindowEventsAndCloseRail(
  events: Array<{ name: string; detail: any }>,
  closeRailForViewport: () => void,
) {
  for (const event of events) {
    dispatchWindowEvent(event.name, event.detail);
  }

  closeRailForViewport();
}

export function useChatClientViewThreadActions(
  args: UseChatClientViewThreadActionsArgs,
) {
  const {
    threads,
    activeThreadId,
    shouldHoldBlankThreadStage,
    disableNewChat,
    canRunWorkspaceAction,
    setWorkspaceHeroDismissed,
    closeRailForViewport,
  } = args;

  void disableNewChat;

  const createThreadGuardRef = React.useRef(0);
  const createOpRef = React.useRef<{ id: string; at: number }>({
    id: "",
    at: 0,
  });
  const CREATE_REQ_REUSE_MS = 500;

  const onSelectThread = React.useCallback(
    (threadId: string) => {
      const id = String(threadId ?? "").trim();
      if (!id) return;

      const selectedTitle = findThreadTitleById(threads, id);

      dispatchWindowEventsAndCloseRail(
        [
          {
            name: "hopy:select-thread",
            detail: buildSelectThreadDetail(id, "ui:view", selectedTitle),
          },
        ],
        closeRailForViewport,
      );
    },
    [threads, closeRailForViewport],
  );

  const onCreateThread = React.useCallback(
    (opts?: { clientRequestId: string }) => {
      if (!canRunWorkspaceAction()) return;

      const currentActiveId = String(activeThreadId ?? "").trim();
      const shouldReturnToPendingThread =
        Boolean(currentActiveId) && shouldHoldBlankThreadStage;

      setWorkspaceHeroDismissed(true);

      if (shouldReturnToPendingThread) {
        dispatchWindowEventsAndCloseRail(
          [
            {
              name: "hopy:workspace-clear",
              detail: buildThreadReasonDetail(
                currentActiveId,
                "ui:return-pending-thread",
              ),
            },
            {
              name: "hopy:select-thread",
              detail: buildSelectThreadDetail(
                currentActiveId,
                "ui:return-pending-thread",
              ),
            },
          ],
          closeRailForViewport,
        );
        return;
      }

      const now = Date.now();

      if (now - createThreadGuardRef.current < 120) return;
      createThreadGuardRef.current = now;

      const incoming = String(opts?.clientRequestId ?? "").trim();
      const prev = createOpRef.current;

      const reusePrev =
        !incoming &&
        Boolean(prev.id) &&
        now - (prev.at || 0) >= 0 &&
        now - (prev.at || 0) <= CREATE_REQ_REUSE_MS;

      const clientRequestId = incoming || (reusePrev ? prev.id : safeUUID());
      createOpRef.current = { id: clientRequestId, at: now };

      const createThreadDetail = buildCreateThreadDetail(clientRequestId);

      dispatchWindowEventsAndCloseRail(
        [
          {
            name: "hopy:workspace-clear",
            detail: {
              reason: "ui:create-thread",
              ...createThreadDetail,
            },
          },
          {
            name: "hopy:create-thread",
            detail: {
              reason: "ui",
              ...createThreadDetail,
            },
          },
        ],
        closeRailForViewport,
      );
    },
    [
      canRunWorkspaceAction,
      activeThreadId,
      shouldHoldBlankThreadStage,
      setWorkspaceHeroDismissed,
      closeRailForViewport,
    ],
  );

  const onRenameThread = React.useCallback(
    (threadId: string, nextTitle: string) => {
      if (!canRunWorkspaceAction()) return;

      const id = String(threadId ?? "").trim();
      const title = String(nextTitle ?? "").trim();
      if (!id) return;
      if (!title) return;

      const prevTitle = findThreadTitleById(threads, id);

      if (prevTitle && prevTitle === title) {
        closeRailForViewport();
        return;
      }

      let updated_at = "";
      try {
        updated_at = new Date().toISOString();
      } catch {}

      const prevTitleAliases = buildPrevTitleAliases(prevTitle);
      const renameDetailBase = withDirectSource({
        ...buildThreadIdentityDetail(id),
        title,
        ...prevTitleAliases,
      });

      dispatchWindowEventsAndCloseRail(
        [
          {
            name: "hopy:threads-refresh",
            detail: {
              reason: "rename:optimistic",
              updated_at,
              ...renameDetailBase,
            },
          },
          {
            name: "hopy:rename-thread",
            detail: {
              reason: "ui",
              ...renameDetailBase,
            },
          },
        ],
        closeRailForViewport,
      );
    },
    [canRunWorkspaceAction, threads, closeRailForViewport],
  );

  const onDeleteThread = React.useCallback(
    (threadId: string) => {
      if (!canRunWorkspaceAction()) return;

      const id = String(threadId ?? "").trim();
      if (!id) return;

      const prevTitle = findThreadTitleById(threads, id);

      dispatchWindowEventsAndCloseRail(
        [
          {
            name: "hopy:delete-thread",
            detail: withDirectSource({
              reason: "ui",
              ...buildThreadIdentityDetail(id),
              ...buildPrevTitleAliases(prevTitle),
            }),
          },
        ],
        closeRailForViewport,
      );
    },
    [canRunWorkspaceAction, threads, closeRailForViewport],
  );

  return {
    onSelectThread,
    onCreateThread,
    onRenameThread,
    onDeleteThread,
  };
}

/*
このファイルの正式役割:
ChatClientView の中にあったスレッド操作イベント本体を切り出し、
選択・新規作成・名前変更・削除の UI 操作を
window event へ変換して返す責務だけを持つ。
このファイルは、状態や Compass を再判定する場所ではなく、
本文採用の唯一の正を作る場所でもなく、
スレッド操作イベントの組み立てと dispatch だけを担当する。
*/

/*
【今回このファイルで修正したこと】
1. safeUUID() が crypto.randomUUID() を返す場合でも、必ず cr_ prefix 付きの temporary id を返すようにしました。
2. 新規チャット押下時の clientRequestId が blank stage 判定へ入れる形式になるように戻しました。
3. shouldReturnToPendingThread の分岐、requestId 管理、select / rename / delete の責務には触っていません。
4. 本文採用、confirmed payload、state_changed、Compass、1..5 の唯一の正には触っていません。
*/

/* /components/chat/view/hooks/useChatClientViewThreadActions.ts */