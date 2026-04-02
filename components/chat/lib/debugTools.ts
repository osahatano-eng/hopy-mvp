// /components/chat/lib/debugTools.ts
"use client";

declare global {
  interface Window {
    __hopyOriginalFetch?: typeof fetch;
    __hopyFetchWrapped?: boolean;
    __hopyApiDebugEnabled?: boolean;
    hopyEnableApiDebug?: () => void;
    hopyDisableApiDebug?: () => void;

    __hopyImeDebugEnabled?: boolean;
    hopyEnableImeDebug?: () => void;
    hopyDisableImeDebug?: () => void;
  }
}

export function microtask(fn: () => void) {
  try {
    if (typeof queueMicrotask === "function") return queueMicrotask(fn);
  } catch {}
  Promise.resolve().then(fn).catch(() => {});
}

export function cleanForDecision(s: any) {
  const v = String(s ?? "");
  const noZw = v.replace(/[\u200B-\u200D\uFEFF]/g, "");
  return noZw.replace(/\r/g, "").trim();
}

// ✅ clientRequestId 生成（ブラウザでも落ちない）
export function safeUUID(): string {
  try {
    const g: any = globalThis as any;
    if (g?.crypto && typeof g.crypto.randomUUID === "function") {
      return g.crypto.randomUUID();
    }
  } catch {}
  try {
    return `cr_${Date.now()}_${Math.random().toString(16).slice(2)}`;
  } catch {
    return `cr_${Date.now()}`;
  }
}

export function initHopyApiDebugTools() {
  if (typeof window === "undefined") return;

  if (
    typeof window.hopyEnableApiDebug === "function" &&
    typeof window.hopyDisableApiDebug === "function"
  ) {
    return;
  }

  if (!window.__hopyOriginalFetch) {
    window.__hopyOriginalFetch = window.fetch.bind(window);
  }

  const wrapFetch = () => {
    if (window.__hopyFetchWrapped) return;
    window.__hopyFetchWrapped = true;

    const originalFetch = window.__hopyOriginalFetch!;
    window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
      const res = await originalFetch(input, init);
      if (!window.__hopyApiDebugEnabled) return res;

      try {
        const url =
          typeof input === "string"
            ? input
            : input instanceof URL
              ? input.toString()
              : (input as Request).url;

        if (url.includes("/api/chat")) {
          const cloned = res.clone();
          const ct = cloned.headers.get("content-type") || "";
          if (ct.includes("application/json")) {
            const data = await cloned.json().catch(() => null);
            if (data && typeof data === "object") {
              const meta = {
                ok: (data as any).ok,
                status: res.status,
                user_saved: (data as any).user_saved,
                assistant_saved: (data as any).assistant_saved,
                memory_write: (data as any).memory_write,
                memory_inserted: (data as any).memory_inserted,
                memory_skip_reason: (data as any).memory_skip_reason,
                user_save_error: (data as any).user_save_error,
                assistant_save_error: (data as any).assistant_save_error,
                error: (data as any).error,
                message: (data as any).message,
              };
              // eslint-disable-next-line no-console
              console.info("[HOPY API DEBUG] /api/chat", meta);
            }
          } else {
            // eslint-disable-next-line no-console
            console.info("[HOPY API DEBUG] /api/chat non-json", {
              status: res.status,
              contentType: ct,
            });
          }
        }
      } catch (e) {
        // eslint-disable-next-line no-console
        console.warn("[HOPY API DEBUG] hook error", e);
      }

      return res;
    };
  };

  const unwrapFetch = () => {
    if (!window.__hopyFetchWrapped) return;
    window.__hopyFetchWrapped = false;
    if (window.__hopyOriginalFetch) {
      window.fetch = window.__hopyOriginalFetch;
    }
  };

  window.hopyEnableApiDebug = () => {
    window.__hopyApiDebugEnabled = true;
    wrapFetch();
    // eslint-disable-next-line no-console
    console.info("[HOPY API DEBUG] enabled (now logging /api/chat responses)");
  };

  window.hopyDisableApiDebug = () => {
    window.__hopyApiDebugEnabled = false;
    unwrapFetch();
    // eslint-disable-next-line no-console
    console.info("[HOPY API DEBUG] disabled");
  };
}

export function initHopyImeDebugTools() {
  if (typeof window === "undefined") return;

  if (
    typeof window.hopyEnableImeDebug === "function" &&
    typeof window.hopyDisableImeDebug === "function"
  ) {
    return;
  }

  window.hopyEnableImeDebug = () => {
    window.__hopyImeDebugEnabled = true;
    // eslint-disable-next-line no-console
    console.info("[HOPY IME DEBUG] enabled");
  };

  window.hopyDisableImeDebug = () => {
    window.__hopyImeDebugEnabled = false;
    // eslint-disable-next-line no-console
    console.info("[HOPY IME DEBUG] disabled");
  };
}