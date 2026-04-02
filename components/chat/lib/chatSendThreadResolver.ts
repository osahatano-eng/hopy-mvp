// /components/chat/lib/chatSendThreadResolver.ts
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  getAuthContext,
  isTemporaryGuestThreadId,
  microtask,
  safeLoadPersistedActiveThreadId,
  safePersistActiveThreadId,
} from "./chatSendShared";

export function createThreadResolver(args: {
  supabase: SupabaseClient;
  activeThreadId: string | null;
  ensureThreadId?: () => Promise<string | null>;
  onThreadIdResolved?: (threadId: string) => void;
  ensureInFlightRef: { current: Promise<string | null> | null };
  ensureInFlightAtRef: { current: number };
  ensureDedupeWindowMs: number;
}) {
  const {
    supabase,
    activeThreadId,
    ensureThreadId,
    onThreadIdResolved,
    ensureInFlightRef,
    ensureInFlightAtRef,
    ensureDedupeWindowMs,
  } = args;

  return async function resolveThreadIdOrNull(): Promise<string | null> {
    const auth = await getAuthContext(supabase);
    if (!auth.isLoggedIn) return null;

    const current = String(activeThreadId ?? "").trim();
    const currentIsUsable = current && !isTemporaryGuestThreadId(current);

    if (currentIsUsable) return current;

    const persisted = String(safeLoadPersistedActiveThreadId() ?? "").trim();
    const persistedIsUsable = persisted && !isTemporaryGuestThreadId(persisted);

    if (persistedIsUsable) return persisted;

    if (typeof ensureThreadId !== "function") {
      if (currentIsUsable) return current;
      if (persistedIsUsable) return persisted;
      return null;
    }

    const now = Date.now();
    const inflight = ensureInFlightRef.current;
    if (inflight && now - ensureInFlightAtRef.current <= ensureDedupeWindowMs) {
      try {
        const reused = String((await inflight) ?? "").trim();
        if (reused) return reused;

        const latestPersisted = String(safeLoadPersistedActiveThreadId() ?? "").trim();
        if (latestPersisted && !isTemporaryGuestThreadId(latestPersisted)) return latestPersisted;

        if (currentIsUsable) return current;
        if (persistedIsUsable) return persisted;
        return null;
      } catch {
        const latestPersisted = String(safeLoadPersistedActiveThreadId() ?? "").trim();
        if (latestPersisted && !isTemporaryGuestThreadId(latestPersisted)) return latestPersisted;

        if (currentIsUsable) return current;
        if (persistedIsUsable) return persisted;
        return null;
      }
    }

    ensureInFlightAtRef.current = now;

    ensureInFlightRef.current = (async () => {
      try {
        const created = String((await ensureThreadId()) ?? "").trim();
        if (created) {
          safePersistActiveThreadId(created);

          try {
            if (typeof onThreadIdResolved === "function") onThreadIdResolved(created);
          } catch {}

          return created;
        }

        const latestPersisted = String(safeLoadPersistedActiveThreadId() ?? "").trim();
        if (latestPersisted && !isTemporaryGuestThreadId(latestPersisted)) {
          return latestPersisted;
        }

        if (currentIsUsable) return current;
        if (persistedIsUsable) return persisted;
        return null;
      } catch {
        const latestPersisted = String(safeLoadPersistedActiveThreadId() ?? "").trim();
        if (latestPersisted && !isTemporaryGuestThreadId(latestPersisted)) {
          return latestPersisted;
        }

        if (currentIsUsable) return current;
        if (persistedIsUsable) return persisted;
        return null;
      } finally {
        microtask(() => {
          ensureInFlightRef.current = null;
          ensureInFlightAtRef.current = 0;
        });
      }
    })();

    try {
      const resolved = String((await ensureInFlightRef.current) ?? "").trim();
      if (resolved) return resolved;

      const latestPersisted = String(safeLoadPersistedActiveThreadId() ?? "").trim();
      if (latestPersisted && !isTemporaryGuestThreadId(latestPersisted)) return latestPersisted;

      if (currentIsUsable) return current;
      if (persistedIsUsable) return persisted;
      return null;
    } catch {
      const latestPersisted = String(safeLoadPersistedActiveThreadId() ?? "").trim();
      if (latestPersisted && !isTemporaryGuestThreadId(latestPersisted)) return latestPersisted;

      if (currentIsUsable) return current;
      if (persistedIsUsable) return persisted;
      return null;
    }
  };
}