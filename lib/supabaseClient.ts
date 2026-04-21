// /lib/supabaseClient.ts
"use client";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const url = String(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").trim();
const anon = String(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "").trim();

if (!url || !anon) {
  throw new Error("Supabase env missing: NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY");
}

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

/*
このファイルの正式役割:
HOPY のクライアント側 Supabase 接続を単一化し、認証セッション保存先と PKCE 認証設定を安定して提供する。
*/

/*
【今回このファイルで修正したこと】
1. Supabase Auth の auth.lock 上書きを削除しました。
2. runWithoutNavigatorLock() を削除しました。
3. タブ復帰時に Supabase 本来の auth 処理直列化を外していた経路を戻しました。
4. persistSession / autoRefreshToken / detectSessionInUrl / flowType / storage / storageKey は維持しました。
5. localStorage 正本、memory fallback の方針は維持しました。
6. HOPY唯一の正、confirmed payload、state_changed、HOPY回答○、Compass、状態値 1..5 / 5段階、DB保存・復元には触れていません。
*/

/* /lib/supabaseClient.ts */