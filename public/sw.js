// /public/sw.js

const HOPY_SW_VERSION = "hopy-sw-v2";
const HOPY_CACHE_PREFIXES = ["hopy-", "workbox-", "next-pwa-"];
const HOPY_CLIENT_MESSAGE = {
  ACTIVATED: "HOPY_SW_ACTIVATED",
};

function shouldDeleteCache(cacheName) {
  if (cacheName === HOPY_SW_VERSION) return false;

  return HOPY_CACHE_PREFIXES.some((prefix) => cacheName.startsWith(prefix));
}

async function deleteLegacyCaches() {
  const cacheNames = await caches.keys();
  const deleteTargets = cacheNames.filter(shouldDeleteCache);

  await Promise.all(deleteTargets.map((cacheName) => caches.delete(cacheName)));
}

async function notifyAllClients(message) {
  const clientList = await self.clients.matchAll({
    type: "window",
    includeUncontrolled: true,
  });

  await Promise.all(
    clientList.map((client) => {
      return client.postMessage(message);
    }),
  );
}

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      await deleteLegacyCaches();
      await self.clients.claim();

      await notifyAllClients({
        type: HOPY_CLIENT_MESSAGE.ACTIVATED,
        version: HOPY_SW_VERSION,
      });
    })(),
  );
});

self.addEventListener("message", (event) => {
  const data =
    event && typeof event === "object" && "data" in event ? event.data : null;

  if (!data || typeof data !== "object") return;

  if (data.type === "HOPY_SW_SKIP_WAITING") {
    event.waitUntil(self.skipWaiting());
    return;
  }

  if (data.type === "HOPY_SW_CLEAR_LEGACY_CACHES") {
    event.waitUntil(deleteLegacyCaches());
  }
});

/*
このファイルの正式役割:
PWA更新の反映責務を一元管理する唯一の service worker 本体。
新しい版の受け入れ、古い cache の整理、既存クライアントへの制御引き継ぎだけを担当する。
*/

/*
【今回このファイルで修正したこと】
1. install 時の即時 skipWaiting() を削除した
2. 更新通知UIが waiting を検知できる運用へ戻した
3. service worker version を hopy-sw-v2 に更新した
4. activate 時の旧 cache 削除、clients.claim()、ACTIVATED 通知は維持した
5. HOPY唯一の正、状態表示、Compass、本文系ロジックには触れていない
*/

/*
このファイルのフルパス:
/public/sw.js
*/