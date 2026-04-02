// /components/chat/ui/leftRailThreadMeta.ts
import { parseTimeMs } from "./leftRailStorage";

export function buildDisplayTitle(args: {
  thread: unknown;
  untitled: string;
  activeThreadId?: string | null;
  titleCountMap: Map<string, number>;
}) {
  const { thread, untitled, titleCountMap } = args;
  const thAny = (thread ?? null) as any;

  const thId = String(thAny?.id ?? "").trim();
  const baseTitle = String(thAny?.title ?? "").trim() || untitled;

  const sameCount = titleCountMap.get(baseTitle) ?? 0;
  const shortId = thId ? thId.slice(0, 4) : "";
  const displayTitle = sameCount >= 2 && shortId ? `${baseTitle} · ${shortId}` : baseTitle;

  return {
    thId,
    baseTitle,
    displayTitle,
    disabled: !thId,
    key: thId || `thread-missing-id-${String(thAny?.updated_at ?? "") || "no-updated"}-${baseTitle}`,
  };
}

export function inferEmptyActiveThread(args: {
  activeThread: unknown;
  untitled: string;
}) {
  const { activeThread, untitled } = args;

  try {
    if (!activeThread) return false;

    const th: any = activeThread;
    const title = String(th?.title ?? "").trim();
    const isDefaultTitle =
      title === "" ||
      title === "New chat" ||
      title === "新規チャット" ||
      title === "Untitled" ||
      title === "無題" ||
      title === untitled;

    const createdMs = parseTimeMs(th?.created_at);
    const updatedMs = parseTimeMs(th?.updated_at);

    const now = Date.now();
    const ageMs = createdMs ? Math.max(0, now - createdMs) : null;
    const touchedMs = updatedMs && createdMs ? Math.max(0, updatedMs - createdMs) : null;

    const isVeryNew = ageMs != null ? ageMs <= 5 * 60 * 1000 : false;
    const notTouched = touchedMs != null ? touchedMs <= 1500 : false;
    return Boolean(isDefaultTitle && (notTouched || isVeryNew));
  } catch {
    return false;
  }
}