// /components/chat/ui/memory-modal/MemoryModalToast.tsx

import React from "react";
import styles from "../MemoryModal.module.css";
import type { ToastState } from "./types";

type Props = {
  toast: ToastState;
  onDismiss: () => void;
};

export default function MemoryModalToast({ toast, onDismiss }: Props) {
  if (!toast) return null;

  return (
    <div className={styles.toastWrap} aria-live="polite">
      <div
        className={`${styles.toast} ${toast.tone === "danger" ? styles.toastDanger : ""}`}
        role="status"
      >
        <div className={styles.toastMsg}>{toast.message}</div>
        <div className={styles.toastActions}>
          {toast.actionLabel && toast.onAction ? (
            <button className={styles.toastBtn} onClick={() => toast.onAction?.()}>
              {toast.actionLabel}
            </button>
          ) : null}

          {toast.action2Label && toast.onAction2 ? (
            <button className={styles.toastBtnSecondary} onClick={() => toast.onAction2?.()}>
              {toast.action2Label}
            </button>
          ) : null}

          <button
            className={styles.toastBtnGhost}
            onClick={onDismiss}
            aria-label="dismiss"
            title="dismiss"
          >
            ×
          </button>
        </div>
      </div>
    </div>
  );
}