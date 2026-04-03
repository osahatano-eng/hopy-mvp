// /components/chat/ui/memory-modal/MemoryModalRow.tsx

import React from "react";
import styles from "../MemoryModal.module.css";
import type { Lang } from "../../lib/chatTypes";
import type { MemoryItem, MemoryScope } from "../../lib/memoriesApi";
import { formatMemoryMeta } from "../../lib/memoriesApi";
import { getHopyStateVisual } from "../../lib/stateBadge";
import { importanceClass, resolveMemoryState, resolveVisualDotColor } from "./memoryModalFormat";
import type { MemoryModalUi, RowState } from "./types";

function toPhaseOrUndefined(value: unknown): 1 | 2 | 3 | 4 | 5 | undefined {
  const n = Number(value);
  if (!Number.isFinite(n)) return undefined;
  const r = Math.trunc(n);
  if (r < 1 || r > 5) return undefined;
  return r as 1 | 2 | 3 | 4 | 5;
}

function MemoryStateDot({ item, uiLang }: { item: MemoryItem; uiLang: Lang }) {
  const resolved = resolveMemoryState(item);

  if (resolved.level == null && resolved.phase == null && !resolved.normalizedState) return null;

  const visual = getHopyStateVisual({
    state: resolved.normalizedState ?? undefined,
    level: toPhaseOrUndefined(resolved.level),
    phase: toPhaseOrUndefined(resolved.phase),
    uiLang,
  });

  const size = resolved.changed ? 11 : 9;

  return (
    <span
      aria-label={visual.label}
      title={visual.label}
      style={{
        width: size,
        height: size,
        minWidth: size,
        minHeight: size,
        borderRadius: "999px",
        display: "inline-block",
        backgroundColor: resolveVisualDotColor(visual, visual.dotToken),
        marginTop: 6,
        marginRight: 10,
        flexShrink: 0,
      }}
    />
  );
}

type Props = {
  item: MemoryItem;
  scope: MemoryScope;
  uiLang: Lang;
  ui: MemoryModalUi;
  rowState: RowState;
  loading: boolean;
  creating: boolean;
  onBeginEdit: (item: MemoryItem) => void;
  onCancelEdit: (id: string) => void;
  onSaveEdit: (id: string) => void;
  onDeleteToTrash: (id: string) => void;
  onRestoreFromTrash: (id: string) => void;
  onHardDeleteFromTrash: (id: string) => void;
  onChangeDraft: (id: string, nextDraft: string, currentState: RowState) => void;
};

export default function MemoryModalRow({
  item,
  scope,
  uiLang,
  ui,
  rowState,
  loading,
  creating,
  onBeginEdit,
  onCancelEdit,
  onSaveEdit,
  onDeleteToTrash,
  onRestoreFromTrash,
  onHardDeleteFromTrash,
  onChangeDraft,
}: Props) {
  const created = formatMemoryMeta(item.created_at, uiLang);
  const updated = formatMemoryMeta(item.updated_at, uiLang);

  return (
    <div
      className={`${styles.memItem} ${importanceClass(item.importance, styles)}`}
      role="listitem"
      key={item.id}
    >
      <div
        className={styles.memBody}
        style={{
          display: "flex",
          alignItems: "flex-start",
          minWidth: 0,
        }}
      >
        <MemoryStateDot item={item} uiLang={uiLang} />

        <div style={{ minWidth: 0, flex: 1 }}>
          {scope === "active" && rowState.mode === "edit" ? (
            <>
              <textarea
                className={styles.memEdit}
                data-mem-edit={item.id}
                value={rowState.draft}
                onChange={(e) => onChangeDraft(item.id, e.target.value, rowState)}
                rows={3}
                onKeyDown={(e) => {
                  const ne = e.nativeEvent as any;
                  if (ne?.isComposing) return;
                  if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
                    e.preventDefault();
                    onSaveEdit(item.id);
                  }
                }}
              />
              {rowState.error ? <div className={styles.memRowError}>{rowState.error}</div> : null}
              <div className={styles.memMeta} style={{ marginTop: 8 }}>
                <span>{ui.saveHint}</span>
              </div>
            </>
          ) : (
            <div className={styles.memText}>{item.text}</div>
          )}

          <div className={styles.memMeta}>
            {created ? (
              <span>
                {ui.metaCreated}: {created}
              </span>
            ) : null}
            {updated ? (
              <span>
                {ui.metaUpdated}: {updated}
              </span>
            ) : null}
          </div>
        </div>
      </div>

      <div className={styles.memActions}>
        {scope === "active" ? (
          rowState.mode === "edit" ? (
            <>
              <button
                className={styles.memPrimary}
                onClick={() => onSaveEdit(item.id)}
                disabled={rowState.saving || loading}
                aria-disabled={rowState.saving || loading}
                title={ui.saveHint}
              >
                {ui.save}
              </button>
              <button
                className={styles.memGhost}
                onClick={() => onCancelEdit(item.id)}
                disabled={rowState.saving || loading}
                aria-disabled={rowState.saving || loading}
              >
                {ui.cancel}
              </button>
            </>
          ) : (
            <>
              <button
                className={styles.memGhost}
                onClick={() => onBeginEdit(item)}
                disabled={loading || creating}
                aria-disabled={loading || creating}
              >
                {ui.edit}
              </button>
              <button
                className={styles.memDanger}
                onClick={() => onDeleteToTrash(item.id)}
                disabled={loading || creating}
                aria-disabled={loading || creating}
              >
                {ui.del}
              </button>
            </>
          )
        ) : (
          <>
            <button
              className={styles.memPrimary}
              onClick={() => onRestoreFromTrash(item.id)}
              disabled={loading || creating}
              aria-disabled={loading || creating}
            >
              {ui.restore}
            </button>
            <button
              className={styles.memDanger}
              onClick={() => onHardDeleteFromTrash(item.id)}
              disabled={loading || creating}
              aria-disabled={loading || creating}
            >
              {ui.hardDel}
            </button>
          </>
        )}
      </div>
    </div>
  );
}

/*
このファイルの正式役割
Memory Modal の1行表示責務だけを持ち、メモリー本文・状態ドット・作成更新日時・編集/削除/復元操作を描画するファイル。
状態の唯一の正は作らず、受け取った item と resolveMemoryState の結果を表示に載せるだけに限定する。
*/

/*
【今回このファイルで修正したこと】
1. getHopyStateVisual に渡す前に、level / phase を 1..5 のみへ絞る toPhaseOrUndefined をこのファイル内に追加しました。
2. resolved.level / resolved.phase の broad な number をそのまま渡さないようにしました。
3. Memory Modal の表示構造、編集UI、削除・復元処理には触れていません。
*/