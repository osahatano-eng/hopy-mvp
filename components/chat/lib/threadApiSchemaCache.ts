// /components/chat/lib/threadApiSchemaCache.ts

// ✅ 一度判明したら、次回以降は updated_at ルートをスキップ（体感改善）
export const LS_KEY_UPDATED_AT_UNSUPPORTED = "hopy_threads_updated_at_unsupported";

let updatedAtUnsupportedCache: boolean | null = null;

export function getUpdatedAtUnsupportedCached(): boolean {
  if (updatedAtUnsupportedCache != null) return updatedAtUnsupportedCache;
  try {
    if (typeof window === "undefined") return false;
    const v = String(localStorage.getItem(LS_KEY_UPDATED_AT_UNSUPPORTED) ?? "").trim();
    updatedAtUnsupportedCache = v === "1";
    return updatedAtUnsupportedCache;
  } catch {
    updatedAtUnsupportedCache = false;
    return false;
  }
}

export function setUpdatedAtUnsupportedCached(v: boolean) {
  updatedAtUnsupportedCache = Boolean(v);
  try {
    if (typeof window === "undefined") return;
    if (updatedAtUnsupportedCache) localStorage.setItem(LS_KEY_UPDATED_AT_UNSUPPORTED, "1");
    else localStorage.removeItem(LS_KEY_UPDATED_AT_UNSUPPORTED);
  } catch {}
}