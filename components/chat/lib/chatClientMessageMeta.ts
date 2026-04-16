// /components/chat/lib/chatClientMessageMeta.ts
import type { ChatMsg } from "./chatTypes";

export function extractRenderableMessageText(value: unknown): string {
  if (typeof value === "string") {
    return value.trim();
  }

  if (Array.isArray(value)) {
    const joined = value
      .map((item) => extractRenderableMessageText(item))
      .filter(Boolean)
      .join(" ")
      .trim();
    return joined;
  }

  if (value && typeof value === "object") {
    const safe = value as Record<string, unknown>;

    return extractRenderableMessageText(
      safe.text ??
        safe.content ??
        safe.body ??
        safe.reply ??
        safe.message ??
        safe.value ??
        safe.parts,
    );
  }

  return "";
}

export function extractMessageThreadId(msg: ChatMsg | null | undefined): string {
  const safe = msg as any;
  if (!safe) return "";

  const candidates = [
    safe.thread_id,
    safe.threadId,
    safe.conversation_id,
    safe.conversationId,
    safe.chat_id,
    safe.chatId,
    safe.thread?.id,
    safe.conversation?.id,
  ];

  for (const candidate of candidates) {
    const tid = String(candidate ?? "").trim();
    if (tid) return tid;
  }

  return "";
}

export function resolveMessagesOwnerThreadId(messages: ChatMsg[] | null | undefined): string {
  if (!Array.isArray(messages) || messages.length <= 0) return "";

  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const tid = extractMessageThreadId(messages[i]);
    if (tid) {
      return tid;
    }
  }

  return "";
}

export function isCompletedAssistantReplyMessage(msg: ChatMsg | null | undefined): boolean {
  const safe = msg as any;
  if (!safe) return false;

  const role = String(safe.role ?? "").trim().toLowerCase();
  if (role !== "assistant") return false;

  const status = String(safe.status ?? "").trim().toLowerCase();
  if (status === "pending" || status === "loading" || status === "streaming") {
    return false;
  }

  if (
    safe.pending === true ||
    safe.loading === true ||
    safe.streaming === true ||
    safe.isThinking === true
  ) {
    return false;
  }

  const text = extractRenderableMessageText(
    safe.text ??
      safe.content ??
      safe.body ??
      safe.reply ??
      safe.message ??
      safe.parts,
  );

  return Boolean(text);
}

/*
このファイルの正式役割
ChatClient の中に残っていた、
messages の文字抽出・thread 所属判定・assistant 回答完了判定の補助責務だけを受け持つ。
親ファイルはこの util を import して使うだけに寄せる。
*/

/*
【今回このファイルで修正したこと】
1. resolveMessagesOwnerThreadId(messages) の owner thread 判定を、多数決ではなく配列末尾の最新 message 優先に変更しました。
2. 新規チャット1通目の仮thread→実thread切替直後でも、最新 message 側の thread を本文採用の正として返すようにしました。
3. extractRenderableMessageText、extractMessageThreadId、isCompletedAssistantReplyMessage の責務には触れていません。
4. HOPY回答○、Compass、confirmed payload、DB保存・復元の唯一の正には触れていません。
*/

/*
/components/chat/lib/chatClientMessageMeta.ts
*/