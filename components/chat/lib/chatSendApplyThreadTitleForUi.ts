// /components/chat/lib/chatSendApplyThreadTitleForUi.ts
"use client";

import type { ApiThread } from "./chatSendState";
import { microtask } from "./chatSendShared";

export type ApplyThreadTitleForUiArgs = {
  threadId: string;
  serverTitle: string;
  resolvedTitle?: string | null;
  onThreadRenamed?: (thread: ApiThread) => void;
};

export type ApplyThreadTitleForUiResult = {
  titleForUi: string;
};

export function applyThreadTitleForUi(
  args: ApplyThreadTitleForUiArgs
): ApplyThreadTitleForUiResult {
  const { threadId, serverTitle, resolvedTitle, onThreadRenamed } = args;

  const resolvedThreadId = String(threadId || "").trim();
  const titleForUi = String(resolvedTitle || serverTitle || "").trim();

  if (
    resolvedThreadId &&
    titleForUi &&
    typeof onThreadRenamed === "function"
  ) {
    microtask(() => {
      try {
        onThreadRenamed({
          id: resolvedThreadId,
          title: titleForUi,
        });
      } catch {}
    });
  }

  return {
    titleForUi,
  };
}

/*
このファイルの正式役割
chatSendThreadPostProcess 親ファイルから分離した、送信後タイトルUI反映責務の子ファイル。
resolvedTitle / serverTitle から titleForUi を確定し、onThreadRenamed を microtask で中継することだけを行う。
activeThread 保存、threads-refresh 発火、自動タイトル解決、API送信、assistant message 組み立て、retry、state / Compass の意味判定は持たない。
HOPY唯一の正、confirmed payload、state_changed、DB保存 / DB復元、1..5 の意味判定には触れない。
*/

/*
【今回このファイルで修正したこと】
chatSendThreadPostProcess.ts に残っている送信後タイトルUI反映責務の受け皿として、この新規子ファイルを作成しました。
titleForUi の確定と onThreadRenamed の microtask 実行だけをこの子へ切り出しました。
親が今後、読むだけ・つなぐだけへ寄るための最小責務に限定しました。
*/

/* /components/chat/lib/chatSendApplyThreadTitleForUi.ts */