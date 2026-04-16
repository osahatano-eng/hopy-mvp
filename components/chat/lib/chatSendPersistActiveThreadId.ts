// /components/chat/lib/chatSendPersistActiveThreadId.ts
"use client";

import { logWarn, safePersistActiveThreadId } from "./chatSendShared";

export type PersistSendActiveThreadIdArgs = {
  threadId: string;
};

export function persistSendActiveThreadId(
  args: PersistSendActiveThreadIdArgs
): void {
  const resolvedThreadId = String(args.threadId ?? "").trim();
  if (!resolvedThreadId) return;

  try {
    safePersistActiveThreadId(resolvedThreadId);
  } catch (e) {
    logWarn("[chatSendPersistActiveThreadId] persist active thread failed", {
      threadId: resolvedThreadId,
      reason: String((e as any)?.message ?? e ?? ""),
    });
  }
}

/*
このファイルの正式役割
送信完了後の activeThread 保存専用子ファイル。
threadId を受け取り、safePersistActiveThreadId を実行し、
失敗時は logWarn で記録することだけを担う。
親ファイル側で保存実行本体と例外処理本体を持たせず、
呼び出されるだけの責務に絞る。
*/

/*
【今回このファイルで修正したこと】
1. chatSendThreadPostProcess.ts に残っていた activeThread 保存本体を切り出すための子ファイルを新規作成しました。
2. safePersistActiveThreadId の実行と失敗時 logWarn だけに責務を限定しました。
3. HOPY唯一の正である confirmed payload / state_changed / Compass の意味生成には触っていません。
*/

/* /components/chat/lib/chatSendPersistActiveThreadId.ts */