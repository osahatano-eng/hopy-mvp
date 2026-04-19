// /lib/supabaseClient.ts
"use client";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const url = String(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").trim();
const anon = String(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "").trim();

if (!url || !anon) {
  throw new Error("Supabase env missing: NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY");
}

/**
 * ✅ HOPY: セッション安定化版 Supabase client
 *
 * 方針:
 * - 認証保存先は localStorage を唯一の正規保存先にする
 * - localStorage が使えない時だけ memory fallback
 * - cookie へは保存しない
 *
 * 理由:
 * - localStorage / cookie / memory を同時併用すると、
 *   ログアウトや再ログイン時に古い refresh token が別保存先から復活しやすい
 * - 今回の「初回は通る / 次回以降 Invalid Refresh Token」は
 *   複数保存先の不整合と相性が非常に悪い
 * - 開発中の Chrome / 通常SPA/PWA では localStorage 正本のほうが安定する
 */

type StorageLike = {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
  removeItem: (key: string) => void;
};

function createMemoryStorage(): StorageLike {
  const mem = new Map<string, string>();
  return {
    getItem: (key) => (mem.has(key) ? mem.get(key)! : null),
    setItem: (key, value) => {
      mem.set(key, value);
    },
    removeItem: (key) => {
      mem.delete(key);
    },
  };
}

function canUseWebStorage(storage: StorageLike | undefined | null) {
  try {
    if (!storage) return false;
    const k = "__hopy_storage_test__";
    storage.setItem(k, "1");
    storage.removeItem(k);
    return true;
  } catch {
    return false;
  }
}

/**
 * ✅ 認証保存は localStorage を正本に固定
 * - localStorage が使えるときは localStorage だけを使う
 * - localStorage が使えないときだけ memory fallback を使う
 * - remove は localStorage / memory の両方から消す
 *
 * ※ cookie を読まない / 書かない / 復元しない
 *   → stale refresh token の復活経路を断つ
 *
 * ※ 重要:
 *   localStorage が使えるのに memory にも常時ミラーすると、
 *   ログアウト途中失敗時に memory 側へ古い auth が残り、
 *   別導線から session が残って見える原因になり得る
 */
function createStableAuthStorage(): StorageLike {
  const memory = createMemoryStorage();

  const getLocal = (): StorageLike | null => {
    try {
      if (typeof window !== "undefined" && canUseWebStorage(window.localStorage)) {
        return window.localStorage;
      }
    } catch {}
    return null;
  };

  return {
    getItem: (key) => {
      const local = getLocal();

      if (local) {
        try {
          return local.getItem(key);
        } catch {
          return null;
        }
      }

      try {
        return memory.getItem(key);
      } catch {
        return null;
      }
    },

    setItem: (key, value) => {
      const v = String(value ?? "");
      const local = getLocal();

      if (local) {
        try {
          local.setItem(key, v);
          return;
        } catch {}
      }

      try {
        memory.setItem(key, v);
      } catch {}
    },

    removeItem: (key) => {
      const local = getLocal();

      try {
        local?.removeItem(key);
      } catch {}

      try {
        memory.removeItem(key);
      } catch {}
    },
  };
}

// グローバルに保持して HMR / 再レンダでも単一化
declare global {
  // eslint-disable-next-line no-var
  var __HOPY_SUPABASE__: SupabaseClient | undefined;

  // eslint-disable-next-line no-var
  var __HOPY_SUPABASE_AUTH_WAKE_BOUND__: boolean | undefined;
}

export const supabase: SupabaseClient =
  globalThis.__HOPY_SUPABASE__ ??
  createClient(url, anon, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,

      // ✅ PKCEを明示
      flowType: "pkce",

      // ✅ 保存先を一本化
      storage: createStableAuthStorage(),

      // ✅ key固定
      storageKey: "hopy_auth",
    },
    realtime: {
      params: { eventsPerSecond: 10 },
    },
  });

if (!globalThis.__HOPY_SUPABASE__) {
  globalThis.__HOPY_SUPABASE__ = supabase;
}

/**
 * ✅ Safari / PWA で「初回アクセス時だけ session 復元が遅い」対策
 *
 * 症状:
 * - 初回アクセス直後は LeftRail が空
 * - 別タブへ移動 → 戻る と反映される
 *
 * つまり:
 * - visibility / focus / pageshow をきっかけに auth 復元が進んでいる可能性が高い
 *
 * 対策:
 * - client 作成直後に短い getSession() ウォームアップを数回実行
 * - focus / pageshow / visibility / online でも getSession() を軽く叩いて復元を前倒し
 * - 一度だけ bind して多重登録を防ぐ
 */
function bindSupabaseAuthWake(client: SupabaseClient) {
  if (typeof window === "undefined") return;
  if (globalThis.__HOPY_SUPABASE_AUTH_WAKE_BOUND__) return;
  globalThis.__HOPY_SUPABASE_AUTH_WAKE_BOUND__ = true;

  let wakeInFlight = false;
  let lastWakeAt = 0;

  const wake = async (_reason: string) => {
    const now = Date.now();

    // 近接連打を抑止
    if (wakeInFlight) return;
    if (now - lastWakeAt < 120) return;

    wakeInFlight = true;
    lastWakeAt = now;

    try {
      await client.auth.getSession();
    } catch {
      // noop
    } finally {
      wakeInFlight = false;
    }
  };

  const warmup = async () => {
    const delays = [0, 120, 320, 700, 1200];

    for (let i = 0; i < delays.length; i++) {
      const ms = delays[i];

      if (ms > 0) {
        await new Promise<void>((resolve) => {
          window.setTimeout(() => resolve(), ms);
        });
      }

      try {
        await wake(`startup:${ms}`);
      } catch {}
    }
  };

  const onVisible = () => {
    try {
      if (document.visibilityState !== "visible") return;
      void wake("visibility");
    } catch {}
  };

  const onFocus = () => {
    void wake("focus");
  };

  const onPageShow = () => {
    void wake("pageshow");
  };

  const onOnline = () => {
    void wake("online");
  };

  try {
    document.addEventListener("visibilitychange", onVisible);
  } catch {}
  try {
    window.addEventListener("focus", onFocus);
  } catch {}
  try {
    window.addEventListener("pageshow", onPageShow);
  } catch {}
  try {
    window.addEventListener("online", onOnline);
  } catch {}

  void warmup();
}

bindSupabaseAuthWake(supabase);

/*
このファイルの正式役割:
HOPY のクライアント側 Supabase 接続を単一化し、認証セッション保存先、PKCE 認証設定、初回復元ウォームアップを安定して提供する。
*/

/*
【今回このファイルで修正したこと】
認証 storage の localStorage と memory の二重保持をやめ、
localStorage が使えるときは localStorage のみ、使えないときだけ memory fallback を使う形へ修正した。
これにより、ログアウト途中失敗時に memory 側へ残った古い認証情報が再利用される可能性を止める方向へ寄せた。
*/