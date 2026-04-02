// /components/chat/lib/chatThreadIdentity.ts
export function microtask(fn: () => void) {
  try {
    if (typeof queueMicrotask === "function") {
      queueMicrotask(fn);
      return;
    }
  } catch {}
  Promise.resolve()
    .then(fn)
    .catch(() => {});
}

export function isUuidLikeThreadId(value: string) {
  const v = String(value ?? "").trim();
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
}

export function isTemporaryGuestThreadId(value: string) {
  const v = String(value ?? "").trim();
  if (!v) return false;
  if (isUuidLikeThreadId(v)) return false;

  const lower = v.toLowerCase();
  if (
    lower.startsWith("guest") ||
    lower.startsWith("guest_") ||
    lower.startsWith("guest-") ||
    lower.startsWith("local") ||
    lower.startsWith("local_") ||
    lower.startsWith("local-") ||
    lower.startsWith("temp") ||
    lower.startsWith("temp_") ||
    lower.startsWith("temp-") ||
    lower.startsWith("draft") ||
    lower.startsWith("draft_") ||
    lower.startsWith("draft-") ||
    lower.startsWith("cr_")
  ) {
    return true;
  }

  return true;
}