// /app/api/chat/_lib/route/requestBody.ts
export function isTrueBoolean(x: any): boolean {
  return x === true;
}

export function safeText(v: any): string {
  return String(v ?? "").trim();
}

export function resolveClientRequestIdFromBody(body: any): string {
  return safeText(
    body?.client_request_id ??
      body?.clientRequestId ??
      body?.client_requestId ??
      body?.request_id ??
      body?.requestId
  );
}

export function resolveConversationIdFromBody(body: any): string {
  return String(
    body?.thread_id ??
      body?.conversation_id ??
      body?.conversationId ??
      body?.threadId ??
      ""
  ).trim();
}