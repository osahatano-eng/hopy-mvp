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

  const counts = new Map<string, number>();
  let firstDetected = "";

  for (const msg of messages) {
    const tid = extractMessageThreadId(msg);
    if (!tid) continue;

    if (!firstDetected) {
      firstDetected = tid;
    }

    counts.set(tid, (counts.get(tid) ?? 0) + 1);
  }

  if (!firstDetected) return "";

  if (counts.size === 1) {
    return firstDetected;
  }

  let winner = "";
  let winnerCount = 0;

  for (const [tid, count] of counts.entries()) {
    if (count > winnerCount) {
      winner = tid;
      winnerCount = count;
    }
  }

  return winner;
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
1. ChatClient.tsx 内にあった messages 補助判定本体を、新規 util ファイルとして切り出しました。
2. extractRenderableMessageText、extractMessageThreadId、resolveMessagesOwnerThreadId、isCompletedAssistantReplyMessage をこのファイルへ集約しました。
3. HOPY回答○、Compass、confirmed payload、DB保存・復元の唯一の正には触れていません。
*/