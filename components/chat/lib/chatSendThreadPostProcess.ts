// /components/chat/lib/chatSendThreadPostProcess.ts
"use client";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { ApiThread } from "./chatSendState";
import { applyThreadTitleForUi } from "./chatSendApplyThreadTitleForUi";
import { dispatchSendThreadsRefresh } from "./chatSendDispatchThreadsRefresh";
import { persistSendActiveThreadId } from "./chatSendPersistActiveThreadId";
import { resolveSendPostProcessTitle } from "./chatSendResolvePostProcessTitle";

export type ThreadPostProcessThreadSummary = {
  title?: string;
  next_title?: string;
};

export type ThreadPostProcessLegacyThread = {
  title?: string;
} | null;

export type RunSendThreadPostProcessArgs = {
  supabase: SupabaseClient;
  isLoggedIn: boolean;
  threadIdForUi: string | null;
  userText: string;
  confirmedThreadSummary?: ThreadPostProcessThreadSummary | null;
  legacyThread?: ThreadPostProcessLegacyThread;
  renameGuardSet: Set<string>;
  onThreadRenamed?: (thread: ApiThread) => void;
};

export type RunSendThreadPostProcessResult = {
  threadIdForUi: string | null;
  serverTitle: string;
  titleForUi: string;
};

function buildThreadPostProcessResult(args: {
  threadIdForUi: string | null;
  serverTitle: string;
  titleForUi: string;
}): RunSendThreadPostProcessResult {
  return {
    threadIdForUi: args.threadIdForUi,
    serverTitle: args.serverTitle,
    titleForUi: args.titleForUi,
  };
}

export async function runSendThreadPostProcess(
  args: RunSendThreadPostProcessArgs
): Promise<RunSendThreadPostProcessResult> {
  const {
    supabase,
    isLoggedIn,
    threadIdForUi,
    userText,
    confirmedThreadSummary,
    legacyThread,
    renameGuardSet,
    onThreadRenamed,
  } = args;

  const resolvedThreadId = String(threadIdForUi ?? "").trim();
  const serverTitle = String(
    confirmedThreadSummary?.next_title ??
      confirmedThreadSummary?.title ??
      legacyThread?.title ??
      ""
  ).trim();

  if (!isLoggedIn || !resolvedThreadId) {
    return buildThreadPostProcessResult({
      threadIdForUi: resolvedThreadId || null,
      serverTitle,
      titleForUi: serverTitle,
    });
  }

  persistSendActiveThreadId({
    threadId: resolvedThreadId,
  });

  dispatchSendThreadsRefresh({
    threadId: resolvedThreadId,
  });

  const resolvedTitleResult = await resolveSendPostProcessTitle({
    supabase,
    threadId: resolvedThreadId,
    userText,
    serverTitle,
    renameGuardSet,
  });

  const appliedTitle = applyThreadTitleForUi({
    threadId: resolvedThreadId,
    serverTitle,
    resolvedTitle: resolvedTitleResult.titleForUi,
    onThreadRenamed,
  });

  return buildThreadPostProcessResult({
    threadIdForUi: resolvedThreadId,
    serverTitle,
    titleForUi: appliedTitle.titleForUi,
  });
}

/*
このファイルの正式役割
送信後スレッド後処理の親として、入口整理・保存子の呼び出し・イベント発火子の呼び出し・自動タイトル解決子の呼び出し・送信後タイトルUI反映子の呼び出し・戻り値中継だけを持つ。
親自身は読むだけ・つなぐだけに寄せる。
*/

/*
【今回このファイルで修正したこと】
1. 自動タイトル解決本体を chatSendResolvePostProcessTitle.ts へ委譲しました。
2. chatSendThreadPostProcess.ts 内の resolveSendAutoTitle 実行本体、try/catch、本体内 resolvedTitle 確定処理を削除しました。
3. activeThread 保存、threads-refresh 発火、送信後タイトルUI反映の流れは変えていません。
4. HOPY唯一の正である confirmed payload / state_changed / Compass の意味生成には触っていません。
*/

/* /components/chat/lib/chatSendThreadPostProcess.ts */