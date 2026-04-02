// /components/chat/lib/chatMessageState.ts
import type { ChatMsg } from "./chatTypes";

export function hasAssistantStateLike(msg: ChatMsg | null | undefined): boolean {
  const raw = msg as any;
  if (!raw || typeof raw !== "object") return false;

  const candidates = [
    raw?.state,
    raw?.assistant_state,
    raw?.assistantState,
    raw?.reply_state,
    raw?.replyState,
    raw?.hopy_state,
    raw?.hopyState,
    raw?.current_phase,
    raw?.currentPhase,
    raw?.state_level,
    raw?.stateLevel,
    raw?.prev_phase,
    raw?.prevPhase,
    raw?.prev_state_level,
    raw?.prevStateLevel,
    raw?.state_changed,
    raw?.stateChanged,
  ];

  return candidates.some((v) => v !== undefined && v !== null && v !== "");
}

export function mergeAssistantStateFromCurrent(currentMsg: ChatMsg, loadedMsg: ChatMsg): ChatMsg {
  const currentRaw = currentMsg as any;
  const loadedRaw = loadedMsg as any;

  if (String(loadedRaw?.role ?? "") !== "assistant") return loadedMsg;
  if (hasAssistantStateLike(loadedMsg)) return loadedMsg;
  if (!hasAssistantStateLike(currentMsg)) return loadedMsg;

  return {
    ...loadedMsg,
    state: currentRaw?.state ?? loadedRaw?.state,
    assistant_state: currentRaw?.assistant_state ?? loadedRaw?.assistant_state,
    assistantState: currentRaw?.assistantState ?? loadedRaw?.assistantState,
    reply_state: currentRaw?.reply_state ?? loadedRaw?.reply_state,
    replyState: currentRaw?.replyState ?? loadedRaw?.replyState,
    hopy_state: currentRaw?.hopy_state ?? loadedRaw?.hopy_state,
    hopyState: currentRaw?.hopyState ?? loadedRaw?.hopyState,
    current_phase: currentRaw?.current_phase ?? loadedRaw?.current_phase,
    currentPhase: currentRaw?.currentPhase ?? loadedRaw?.currentPhase,
    state_level: currentRaw?.state_level ?? loadedRaw?.state_level,
    stateLevel: currentRaw?.stateLevel ?? loadedRaw?.stateLevel,
    prev_phase: currentRaw?.prev_phase ?? loadedRaw?.prev_phase,
    prevPhase: currentRaw?.prevPhase ?? loadedRaw?.prevPhase,
    prev_state_level: currentRaw?.prev_state_level ?? loadedRaw?.prev_state_level,
    prevStateLevel: currentRaw?.prevStateLevel ?? loadedRaw?.prevStateLevel,
    state_changed: currentRaw?.state_changed ?? loadedRaw?.state_changed,
    stateChanged: currentRaw?.stateChanged ?? loadedRaw?.stateChanged,
    changed: currentRaw?.changed ?? loadedRaw?.changed,
  } as ChatMsg;
}

export function buildMessageIdentityKey(msg: ChatMsg, index: number): string {
  const raw = msg as any;
  const id = String(raw?.id ?? "").trim();
  if (id) return `id:${id}`;

  const role = String(raw?.role ?? "");
  const content = String(raw?.content ?? "");
  const createdAt = String(raw?.created_at ?? "");
  return `fallback:${index}:${role}:${createdAt}:${content}`;
}

export function mergeLoadedMessagesPreservingAssistantState(
  currentMessages: ChatMsg[],
  loadedMessages: ChatMsg[]
): ChatMsg[] {
  if (!Array.isArray(loadedMessages) || loadedMessages.length <= 0) return loadedMessages;
  if (!Array.isArray(currentMessages) || currentMessages.length <= 0) return loadedMessages;

  const currentById = new Map<string, ChatMsg>();
  const currentAssistantByFallback = new Map<string, ChatMsg>();

  for (let i = 0; i < currentMessages.length; i++) {
    const msg = currentMessages[i];
    const raw = msg as any;
    const id = String(raw?.id ?? "").trim();
    if (id) currentById.set(id, msg);

    if (String(raw?.role ?? "") === "assistant" && hasAssistantStateLike(msg)) {
      currentAssistantByFallback.set(buildMessageIdentityKey(msg, i), msg);
    }
  }

  return loadedMessages.map((loadedMsg, index) => {
    const loadedRaw = loadedMsg as any;
    if (String(loadedRaw?.role ?? "") !== "assistant") return loadedMsg;

    const loadedId = String(loadedRaw?.id ?? "").trim();
    const byId = loadedId ? currentById.get(loadedId) : undefined;
    if (byId) return mergeAssistantStateFromCurrent(byId, loadedMsg);

    const byFallback = currentAssistantByFallback.get(buildMessageIdentityKey(loadedMsg, index));
    if (byFallback) return mergeAssistantStateFromCurrent(byFallback, loadedMsg);

    return loadedMsg;
  });
}

export function pickLatestAssistantStateMessage(messages: ChatMsg[]): ChatMsg | null {
  if (!Array.isArray(messages) || messages.length <= 0) return null;

  for (let i = messages.length - 1; i >= 0; i--) {
    const msg = messages[i] as any;
    if (String(msg?.role ?? "") !== "assistant") continue;
    if (hasAssistantStateLike(msg)) return messages[i];
  }

  return null;
}