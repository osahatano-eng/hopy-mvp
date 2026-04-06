// /public/sw.js

const HOPY_SW_VERSION = "hopy-sw-v1";
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

self.addEventListener("install", (event) => {
  event.waitUntil(self.skipWaiting());
});

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

// /public/sw.js

/* このファイルの正式役割
PWA更新の反映責務を一元管理する唯一の service worker 本体。
新しい版の受け入れ、古い cache の整理、既存クライアントへの制御引き継ぎだけを担当する。
*/

/*【今回このファイルで修正したこと】
1. /public/sw.js を新規作成した
2. install 時に skipWaiting() を使って waiting の滞留を減らした
3. activate 時に旧 cache を削除し、clients.claim() で既存クライアントへ新版を反映しやすくした
4. クライアント通知用の postMessage を追加した
5. 後続の更新通知UIから使える message 受信口を追加した
*/