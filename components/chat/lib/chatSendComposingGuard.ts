// /components/chat/lib/chatSendComposingGuard.ts
"use client";

export type IsChatSendComposingNowArgs = {
  getIsComposing?: () => boolean;
};

export function isChatSendComposingNow(
  args: IsChatSendComposingNowArgs
): boolean {
  const { getIsComposing } = args;

  try {
    return typeof getIsComposing === "function"
      ? Boolean(getIsComposing())
      : false;
  } catch {
    return false;
  }
}

/*
このファイルの正式役割
送信時の IME composing 判定だけを担う子ファイル。
getIsComposing の有無確認、実行、boolean 化、例外時 false 返却だけを行う。
親はこの子を呼ぶだけにする。
*/

/*
【今回このファイルで修正したこと】
1. useChatSend.ts に残っていた IME composing 判定本体の受け皿となる子ファイルを新規作成しました。
2. getIsComposing の実行、boolean 化、例外時 false 返却をこの子へ分離しました。
3. HOPY唯一の正である confirmed payload / state_changed / Compass / 1..5 の意味判定には触っていません。
*/

/* /components/chat/lib/chatSendComposingGuard.ts */