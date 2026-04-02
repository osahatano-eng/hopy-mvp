"use client";

import React, { Suspense, useMemo, useState } from "react";
import styles from "./ChatLauncher.module.css";

const LazyChatClient = React.lazy(() => import("./ChatClient"));

export default function ChatLauncher() {
  const [open, setOpen] = useState(false);

  const fallback = useMemo(() => {
    return (
      <div className={styles.loading}>
        <div className={styles.loadingTitle}>Loading…</div>
        <div className={styles.loadingSub}>最小ロード → 必要な時だけ起動</div>
      </div>
    );
  }, []);

  if (!open) {
    return (
      <section className={styles.hero} aria-label="landing">
        <div className={styles.heroInner}>
          <div className={styles.heroTitle}>HOPY</div>
          <div className={styles.heroSub}>思考を澄ませる、静かな伴走者。</div>
          <div className={styles.heroMeta}>
            初回は超軽量。必要になった瞬間にだけチャットを読み込みます。
          </div>

          <div className={styles.actions}>
            <button className={styles.primary} onClick={() => setOpen(true)}>
              はじめる
            </button>
            <div className={styles.micro}>No clutter. Just thinking.</div>
          </div>
        </div>
      </section>
    );
  }

  return (
    <Suspense fallback={fallback}>
      <LazyChatClient />
    </Suspense>
  );
}
