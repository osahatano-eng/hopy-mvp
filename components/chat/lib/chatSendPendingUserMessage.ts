// /components/chat/lib/chatSendPendingUserMessage.ts
"use client";

import type { ChatMsg, Lang } from "./chatTypes";
import { attachThreadIdToMessage } from "./chatSendConfirmedAssistantMessage";
import { mkTempId } from "./chatSendShared";

export function createPendingUserMessage(args: {
text: string;
detectUserLang: (text: string) => Lang;
displayThreadId: string | null;
}) {
const { text, detectUserLang, displayThreadId } = args;

const userMsgId = mkTempId();
const msgLang = detectUserLang(text);

const message: ChatMsg = attachThreadIdToMessage(
{
id: userMsgId,
role: "user",
content: text,
lang: msgLang,
created_at: new Date().toISOString(),
},
String(displayThreadId ?? "").trim() || null
);

return {
userMsgId,
msgLang,
message,
};
}

/*
このファイルの正式役割
useChatSend 親ファイルから分離した、user message仮追加責務の子ファイル。
送信直前に表示する user message の一時ID生成、言語判定、thread紐付け済み message 生成だけを行う。
messages 配列への反映、loading 制御、visibleCount 更新、API送信、assistant message 反映は持たない。
HOPY唯一の正、confirmed payload、state_changed、Compass、DB保存 / DB復元、1..5 の意味判定には触れない。
*/

/*
【今回このファイルで修正したこと】

useChatSend.ts に残っていた user message仮追加責務の受け皿として、この新規子ファイルを作成しました。
一時ID生成、言語判定、thread紐付け済み user message 生成だけをこの子へ切り出しました。
親が今後、読むだけ・つなぐだけへ寄るための最小責務に限定しました。
*/

/* /components/chat/lib/chatSendPendingUserMessage.ts */