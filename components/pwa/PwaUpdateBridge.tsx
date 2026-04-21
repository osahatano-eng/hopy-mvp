// /components/pwa/PwaUpdateBridge.tsx
"use client";

import { useEffect } from "react";

const HOPY_CACHE_PREFIXES = ["hopy-", "workbox-", "next-pwa-"];

function isBrowserReady(): boolean {
  return typeof window !== "undefined" && "serviceWorker" in navigator;
}

function shouldDeleteCache(cacheName: string): boolean {
  return HOPY_CACHE_PREFIXES.some((prefix) => cacheName.startsWith(prefix));
}

async function unregisterServiceWorkers() {
  const registrations = await navigator.serviceWorker.getRegistrations();

  await Promise.all(
    registrations.map((registration) => {
      return registration.unregister();
    }),
  );
}

async function deletePwaCaches() {
  if (typeof caches === "undefined") return;

  const cacheNames = await caches.keys();
  const deleteTargets = cacheNames.filter(shouldDeleteCache);

  await Promise.all(
    deleteTargets.map((cacheName) => {
      return caches.delete(cacheName);
    }),
  );
}

export default function PwaUpdateBridge() {
  useEffect(() => {
    if (!isBrowserReady()) return;

    let cancelled = false;

    const disablePwa = async () => {
      try {
        await unregisterServiceWorkers();
        if (cancelled) return;

        await deletePwaCaches();
      } catch {
        // PWA解除に失敗しても、HOPY本体の通常利用を優先する
      }
    };

    void disablePwa();

    return () => {
      cancelled = true;
    };
  }, []);

  return null;
}

/*
このファイルの正式役割:
PWA / Service Worker を一時停止し、タブ復帰不具合の原因候補から外すための安全な解除ブリッジ。
既存の service worker 登録解除と、HOPY関連の PWA cache 削除だけを担当する。
*/

/*
【今回このファイルで修正したこと】
1. service worker の新規 register を削除した
2. waiting / updatefound / controllerchange / reload の更新UI処理を削除した
3. 既存 service worker 登録を unregister する処理に変更した
4. hopy- / workbox- / next-pwa- で始まる cache を削除する処理を追加した
5. PWA更新通知UIを非表示化し、PWAをタブ復帰不具合の原因候補から外す形にした
6. HOPY唯一の正、状態表示、Compass、本文系ロジック、Supabase Auth、DB取得には触れていない
*/

/*
このファイルのフルパス:
/components/pwa/PwaUpdateBridge.tsx
*/