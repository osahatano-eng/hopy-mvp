// /components/chat/lib/chatSendDispatchThreadsRefresh.ts
"use client";

export type DispatchSendThreadsRefreshArgs = {
  threadId: string;
};

export function dispatchSendThreadsRefresh(
  args: DispatchSendThreadsRefreshArgs
): void {
  const resolvedThreadId = String(args.threadId ?? "").trim();
  if (!resolvedThreadId) return;

  try {
    if (typeof window === "undefined") return;

    window.dispatchEvent(
      new CustomEvent("hopy:threads-refresh", {
        detail: {
          reason: "send:resolved",
          id: resolvedThreadId,
          threadId: resolvedThreadId,
          updated_at: new Date().toISOString(),
        },
      })
    );
  } catch {}
}

/*
このファイルの正式役割
送信完了後の threads-refresh 発火専用子ファイル。
threadId を受け取り、payload を組み立てて hopy:threads-refresh を dispatch することだけを担う。
親ファイル側で event payload 本体を持たせず、呼び出されるだけの責務に絞る。
*/

/*
【今回このファイルで修正したこと】
1. chatSendThreadPostProcess.ts に残っていた threads-refresh 発火本体を切り出すための子ファイルを新規作成しました。
2. CustomEvent の detail 組み立てと window.dispatchEvent 実行責務だけに限定しました。
3. HOPY唯一の正である confirmed payload / state_changed / Compass の意味生成には触っていません。
*/

/* /components/chat/lib/chatSendDispatchThreadsRefresh.ts */