// /components/pwa/PwaUpdateBridge.tsx
"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const HOPY_SW_PATH = "/sw.js";
const HOPY_SW_MESSAGES = {
  ACTIVATED: "HOPY_SW_ACTIVATED",
  SKIP_WAITING: "HOPY_SW_SKIP_WAITING",
} as const;

type UpdateState = "idle" | "ready" | "reloading";

function isBrowserReady(): boolean {
  return typeof window !== "undefined" && "serviceWorker" in navigator;
}

function isServiceWorkerMessage(data: unknown): data is { type: string; version?: string } {
  return !!data && typeof data === "object" && "type" in data;
}

export default function PwaUpdateBridge() {
  const [updateState, setUpdateState] = useState<UpdateState>("idle");
  const [versionLabel, setVersionLabel] = useState<string>("");
  const registrationRef = useRef<ServiceWorkerRegistration | null>(null);
  const hasReloadedRef = useRef(false);

  const markWaitingWorker = useCallback(
    (registration: ServiceWorkerRegistration | null) => {
      if (!registration?.waiting) return false;
      registrationRef.current = registration;
      setUpdateState("ready");
      return true;
    },
    [],
  );

  const bindInstallingWorker = useCallback(
    (registration: ServiceWorkerRegistration, worker: ServiceWorker) => {
      const syncInstalledWorker = () => {
        if (worker.state !== "installed") return;
        if (!navigator.serviceWorker.controller) return;

        window.setTimeout(() => {
          markWaitingWorker(registration);
        }, 0);
      };

      syncInstalledWorker();
      worker.addEventListener("statechange", syncInstalledWorker);
    },
    [markWaitingWorker],
  );

  const requestActivation = useCallback(() => {
    const waitingWorker = registrationRef.current?.waiting;

    if (!waitingWorker) {
      window.location.reload();
      return;
    }

    setUpdateState("reloading");
    waitingWorker.postMessage({
      type: HOPY_SW_MESSAGES.SKIP_WAITING,
    });
  }, []);

  useEffect(() => {
    if (!isBrowserReady()) return;

    const handleControllerChange = () => {
      if (hasReloadedRef.current) return;
      hasReloadedRef.current = true;
      window.location.reload();
    };

    const handleServiceWorkerMessage = (event: MessageEvent) => {
      const data = event.data;
      if (!isServiceWorkerMessage(data)) return;
      if (data.type !== HOPY_SW_MESSAGES.ACTIVATED) return;

      if (typeof data.version === "string" && data.version.trim()) {
        setVersionLabel(data.version.trim());
      }
    };

    navigator.serviceWorker.addEventListener("controllerchange", handleControllerChange);
    navigator.serviceWorker.addEventListener("message", handleServiceWorkerMessage);

    return () => {
      navigator.serviceWorker.removeEventListener("controllerchange", handleControllerChange);
      navigator.serviceWorker.removeEventListener("message", handleServiceWorkerMessage);
    };
  }, []);

  useEffect(() => {
    if (!isBrowserReady()) return;

    let cancelled = false;

    const registerServiceWorker = async () => {
      try {
        const registration = await navigator.serviceWorker.register(HOPY_SW_PATH);
        if (cancelled) return;

        registrationRef.current = registration;

        if (markWaitingWorker(registration)) return;

        if (registration.installing) {
          bindInstallingWorker(registration, registration.installing);
        }

        const handleUpdateFound = () => {
          const installingWorker = registration.installing;
          if (!installingWorker) return;
          bindInstallingWorker(registration, installingWorker);
        };

        registration.addEventListener("updatefound", handleUpdateFound);

        const triggerUpdateCheck = () => {
          void registration.update().catch(() => {
            // 更新確認失敗は致命ではないため握りつぶす
          });
        };

        const handleVisibilityChange = () => {
          if (document.visibilityState === "visible") {
            triggerUpdateCheck();
          }
        };

        window.addEventListener("focus", triggerUpdateCheck);
        document.addEventListener("visibilitychange", handleVisibilityChange);

        return () => {
          registration.removeEventListener("updatefound", handleUpdateFound);
          window.removeEventListener("focus", triggerUpdateCheck);
          document.removeEventListener("visibilitychange", handleVisibilityChange);
        };
      } catch {
        // service worker 登録失敗時は何も出さず通常利用を優先する
      }
    };

    let cleanup: (() => void) | void;

    void registerServiceWorker().then((fn) => {
      cleanup = fn;
    });

    return () => {
      cancelled = true;
      if (typeof cleanup === "function") cleanup();
    };
  }, [bindInstallingWorker, markWaitingWorker]);

  if (updateState === "idle") {
    return null;
  }

  const isReloading = updateState === "reloading";

  return (
    <div
      aria-live="polite"
      className="fixed inset-x-4 bottom-4 z-[120] mx-auto w-auto max-w-[520px] rounded-2xl border border-black/10 bg-white/92 px-4 py-3 shadow-[0_10px_30px_rgba(0,0,0,0.08)] backdrop-blur-md"
      role="status"
    >
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[13px] font-medium text-neutral-900">
            新しいHOPYがあります
          </p>
          <p className="mt-1 text-[12px] leading-5 text-neutral-600">
            {isReloading
              ? "更新を適用しています…"
              : "再読み込みして最新の表示へ切り替えます。"}
            {versionLabel ? ` (${versionLabel})` : ""}
          </p>
        </div>

        <button
          className="shrink-0 rounded-xl border border-black/10 px-3 py-2 text-[12px] font-medium text-neutral-900 transition hover:bg-black/[0.03] disabled:cursor-default disabled:opacity-60"
          disabled={isReloading}
          onClick={requestActivation}
          type="button"
        >
          {isReloading ? "更新中" : "更新する"}
        </button>
      </div>
    </div>
  );
}

/* このファイルの正式役割
PWA更新検知と、ユーザーへの再読み込み導線をつなぐUIブリッジ。
新しい service worker を検知し、更新ありを静かに伝え、必要な再読み込み操作へつなぐことだけを担当する。
*/

/*【今回このファイルで修正したこと】
1. installing worker に listener を付けた直後に、すでに installed 済みかどうかも即時確認するようにした
2. statechange の未来イベント待ちだけで取りこぼしていた ready 化を、このファイル内だけで補強した
*/

/* フルパス
/components/pwa/PwaUpdateBridge.tsx
*/