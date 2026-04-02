// /components/chat/ui/MemoryModal.tsx

"use client";

import React, { useMemo, useRef } from "react";
import styles from "./MemoryModal.module.css";
import type { MemoryModalProps, RowState } from "./memory-modal/types";
import { getMemoryModalUi } from "./memory-modal/memoryModalFormat";
import { useMemoryModal } from "./memory-modal/useMemoryModal";
import MemoryModalRow from "./memory-modal/MemoryModalRow";
import MemoryModalToast from "./memory-modal/MemoryModalToast";

export default function MemoryModal({ open, onClose, uiLang }: MemoryModalProps) {
  const panelRef = useRef<HTMLDivElement | null>(null);
  const newRef = useRef<HTMLTextAreaElement | null>(null);

  const ui = useMemo(() => getMemoryModalUi(uiLang), [uiLang]);

  const {
    scope,
    loading,
    error,
    q,
    setQ,
    row,
    setRow,
    newText,
    setNewText,
    creating,
    createError,
    toast,
    setToast,
    activeCount,
    trashCount,
    filtered,
    refresh,
    beginEdit,
    cancelEdit,
    addNew,
    saveEdit,
    requestDeleteToTrash,
    restoreFromTrash,
    hardDeleteFromTrash,
    switchScope,
    requestCloseWorld,
  } = useMemoryModal({
    open,
    onClose,
    ui,
    panelRef,
    newRef,
  });

  return !open ? null : (
    <div
      className={styles.memOverlay}
      role="dialog"
      aria-modal="true"
      aria-label={ui.title}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) requestCloseWorld();
      }}
    >
      <div className={styles.memPanel} ref={panelRef} tabIndex={-1}>
        <div className={styles.memHeader}>
          <div>
            <div className={styles.memTitle}>{ui.title}</div>
            <div className={styles.memSub}>{ui.subtitle}</div>
          </div>

          <div className={styles.memHeaderActions}>
            <button
              className={styles.memGhost}
              onClick={() => refresh(scope, { syncCounts: true })}
              disabled={loading || creating}
              aria-disabled={loading || creating}
            >
              {ui.reload}
            </button>
            <button className={styles.memClose} onClick={requestCloseWorld}>
              {ui.close}
            </button>
          </div>
        </div>

        <div className={styles.memTabs}>
          <button
            className={`${styles.memTab} ${scope === "active" ? styles.memTabActive : ""}`}
            onClick={() => switchScope("active")}
            disabled={loading || creating}
          >
            {ui.active}
            <span className={styles.memBadge} title={ui.active}>
              {activeCount}
            </span>
          </button>

          <button
            className={`${styles.memTab} ${scope === "trash" ? styles.memTabActive : ""}`}
            onClick={() => switchScope("trash")}
            disabled={loading || creating}
          >
            {ui.trash}
            <span className={styles.memBadge} title={ui.trash}>
              {trashCount}
            </span>
          </button>
        </div>

        {scope === "trash" ? (
          <div className={styles.memPolicy} role="note" aria-label={ui.policyTitle}>
            <div className={styles.memPolicyTitle}>{ui.policyTitle}</div>
            <div className={styles.memPolicyLine}>{ui.policyLine1}</div>
            <div className={styles.memPolicyLine}>{ui.policyLine2}</div>
          </div>
        ) : null}

        {scope === "active" ? (
          <div className={styles.memAdd}>
            <div className={styles.memAddTop}>
              <div className={styles.memAddTitle}>{ui.addTitle}</div>
              <div className={styles.memAddHint}>{ui.addHint}</div>
            </div>

            <textarea
              ref={newRef}
              className={styles.memAddField}
              value={newText}
              onChange={(e) => setNewText(e.target.value)}
              placeholder={ui.addPlaceholder}
              rows={3}
              onKeyDown={(e) => {
                const ne = e.nativeEvent as any;
                if (ne?.isComposing) return;
                if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
                  e.preventDefault();
                  addNew();
                }
              }}
            />

            {createError ? <div className={styles.memError}>{createError}</div> : null}

            <div className={styles.memAddActions}>
              <button
                className={styles.memPrimary}
                onClick={addNew}
                disabled={creating || !newText.trim()}
                aria-disabled={creating || !newText.trim()}
                title={ui.addHint}
              >
                {ui.addBtn}
              </button>
            </div>
          </div>
        ) : null}

        <div className={styles.memTools}>
          <input
            className={styles.memSearch}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={ui.search}
          />
        </div>

        {error ? <div className={styles.memError}>{error}</div> : null}

        <div className={styles.memList} role="list">
          {loading ? (
            <div className={styles.memLoading}>…</div>
          ) : filtered.length === 0 ? (
            <div className={styles.memEmpty}>{ui.empty}</div>
          ) : (
            filtered.map((m) => {
              const st: RowState = row[m.id] ?? { mode: "view" };

              return (
                <MemoryModalRow
                  key={m.id}
                  item={m}
                  scope={scope}
                  uiLang={uiLang}
                  ui={ui}
                  rowState={st}
                  loading={loading}
                  creating={creating}
                  onBeginEdit={beginEdit}
                  onCancelEdit={cancelEdit}
                  onSaveEdit={saveEdit}
                  onDeleteToTrash={requestDeleteToTrash}
                  onRestoreFromTrash={restoreFromTrash}
                  onHardDeleteFromTrash={hardDeleteFromTrash}
                  onChangeDraft={(id, nextDraft, currentState) => {
                    if (currentState.mode !== "edit") return;
                    setRow((prev) => ({
                      ...prev,
                      [id]: { ...currentState, draft: nextDraft },
                    }));
                  }}
                />
              );
            })
          )}
        </div>

        <MemoryModalToast toast={toast} onDismiss={() => setToast(null)} />
      </div>
    </div>
  );
}