// /components/chat/lib/chatSendResolvePostProcessTitle.ts
"use client";

import type { SupabaseClient } from "@supabase/supabase-js";
import { resolveSendAutoTitle } from "./chatSendAutoTitle";
import { logWarn } from "./chatSendShared";

export type ResolveSendPostProcessTitleArgs = {
  supabase: SupabaseClient;
  threadId: string;
  userText: string;
  serverTitle: string;
  renameGuardSet: Set<string>;
};

export type ResolveSendPostProcessTitleResult = {
  titleForUi: string;
};

export async function resolveSendPostProcessTitle(
  args: ResolveSendPostProcessTitleArgs
): Promise<ResolveSendPostProcessTitleResult> {
  const resolvedThreadId = String(args.threadId ?? "").trim();
  const resolvedServerTitle = String(args.serverTitle ?? "").trim();

  if (!resolvedThreadId) {
    return {
      titleForUi: resolvedServerTitle,
    };
  }

  try {
    const autoTitleResult = await resolveSendAutoTitle({
      supabase: args.supabase,
      threadId: resolvedThreadId,
      userText: args.userText,
      serverTitle: resolvedServerTitle,
      renameGuardSet: args.renameGuardSet,
    });

    return {
      titleForUi: String(
        autoTitleResult.titleForUi || resolvedServerTitle
      ).trim(),
    };
  } catch (e) {
    logWarn("[chatSendResolvePostProcessTitle] resolveSendAutoTitle failed", {
      threadId: resolvedThreadId,
      reason: String((e as any)?.message ?? e ?? ""),
    });

    return {
      titleForUi: resolvedServerTitle,
    };
  }
}

/*
このファイルの正式役割
送信完了後の自動タイトル解決専用子ファイル。
threadId / userText / serverTitle / renameGuardSet を受け取り、
resolveSendAutoTitle を実行して titleForUi を確定することだけを担う。
失敗時は logWarn を出し、serverTitle を返す。
親ファイル側で自動タイトル解決本体と例外処理本体を持たせず、
呼び出されるだけの責務に絞る。
*/

/*
【今回このファイルで修正したこと】
1. chatSendThreadPostProcess.ts に残っていた自動タイトル解決本体を切り出すための子ファイルを新規作成しました。
2. resolveSendAutoTitle の実行、titleForUi の確定、失敗時 logWarn と serverTitle fallback だけに責務を限定しました。
3. HOPY唯一の正である confirmed payload / state_changed / Compass の意味生成には触っていません。
*/

/* /components/chat/lib/chatSendResolvePostProcessTitle.ts */