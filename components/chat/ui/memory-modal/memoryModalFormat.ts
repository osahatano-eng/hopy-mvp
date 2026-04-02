// /components/chat/ui/memory-modal/memoryModalFormat.ts

import type { Lang } from "../../lib/chatTypes";
import type { MemoryItem } from "../../lib/memoriesApi";
import { getHopyStateVisual, normalizeHopyState } from "../../lib/stateBadge";
import type { MemoryModalUi } from "./types";

export function getMemoryModalUi(uiLang: Lang): MemoryModalUi {
  const isEn = uiLang === "en";
  return {
    title: isEn ? "Memories" : "記憶",
    subtitle: isEn
      ? "World-class memory management: active + trash + restore."
      : "世界基準の記憶管理：一覧・追加・編集・ゴミ箱・復元。",
    active: isEn ? "Active" : "一覧",
    trash: isEn ? "Trash" : "ゴミ箱",
    search: isEn ? "Search…" : "検索…",
    close: isEn ? "Close" : "閉じる",
    reload: isEn ? "Reload" : "再読み込み",
    empty: isEn ? "No memories." : "記憶がありません。",
    edit: isEn ? "Edit" : "編集",
    save: isEn ? "Save" : "保存",
    cancel: isEn ? "Cancel" : "キャンセル",
    del: isEn ? "Delete" : "削除",
    deleteConfirm: isEn
      ? "Move this item to Trash?"
      : "この項目をゴミ箱に移動します。よろしいですか？",
    restore: isEn ? "Restore" : "復元",
    hardDel: isEn ? "Delete forever" : "完全削除",
    hardDelConfirm: isEn
      ? "This will permanently delete the item. Continue?"
      : "この項目を完全に削除します。よろしいですか？",
    failedLoad: isEn ? "Failed to load." : "読み込みに失敗しました。",
    failedSave: isEn ? "Failed to save." : "保存に失敗しました。",
    failedDelete: isEn ? "Failed to delete." : "削除に失敗しました。",
    failedCreate: isEn ? "Failed to add." : "追加に失敗しました。",
    failedRestore: isEn ? "Failed to restore." : "復元に失敗しました。",
    failedHardDelete: isEn ? "Failed to delete forever." : "完全削除に失敗しました。",
    metaCreated: isEn ? "Created" : "作成",
    metaUpdated: isEn ? "Updated" : "更新",
    addTitle: isEn ? "Add new" : "新規追加",
    addPlaceholder: isEn ? "Write a new memory…" : "新しい記憶を書く…",
    addBtn: isEn ? "Add" : "追加",
    addHint: isEn ? "Ctrl+Enter to add" : "Ctrl+Enterで追加",
    saveHint: isEn ? "Ctrl+Enter to save" : "Ctrl+Enterで保存",
    dirtyConfirm: isEn
      ? "You have unsaved changes. Close anyway?"
      : "未保存の変更があります。閉じますか？",
    switchEditConfirm: isEn
      ? "You have unsaved changes. Switch editing to another item?"
      : "未保存の変更があります。別の項目の編集に切り替えますか？",
    undo: isEn ? "Undo" : "元に戻す",
    undoAll: isEn ? "Undo all" : "全部戻す",
    deletedOne: isEn ? "Moved to Trash." : "ゴミ箱に移動しました。",
    deletedMany: (n: number) =>
      isEn ? `${n} items moved to Trash.` : `${n}件をゴミ箱に移動しました。`,
    restoring: isEn ? "Restoring…" : "復元中…",
    deleting: isEn ? "Deleting…" : "削除中…",
    saved: isEn ? "Saved." : "保存しました。",
    added: isEn ? "Added." : "追加しました。",
    undone: isEn ? "Undone." : "取り消しました。",
    restored: isEn ? "Restored." : "復元しました。",
    policyTitle: isEn ? "Trash policy" : "ゴミ箱ポリシー",
    policyLine1: isEn
      ? "Items are automatically organized after 30 days."
      : "ゴミ箱の項目は30日を過ぎると自動的に整理されます。",
    policyLine2: isEn
      ? "Trash keeps up to 200 items (older items are cleaned up first)."
      : "ゴミ箱は最大200件まで保持します（超過分は古い順に整理されます）。",
  };
}

export function clampCount(n: number) {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.floor(n));
}

export function importanceClass(level: number | undefined, styles: Record<string, string>) {
  if (level === 5) return styles.memImp5;
  if (level === 4) return styles.memImp4;
  if (level === 3) return styles.memImp3;
  return "";
}

function memoryStateDotColor(token: "phase1" | "phase2" | "phase3" | "phase4" | "phase5") {
  if (token === "phase1") return "var(--hopy-state-phase1, #8f3b3b)";
  if (token === "phase2") return "var(--hopy-state-phase2, #9a6a2f)";
  if (token === "phase3") return "var(--hopy-state-phase3, #8a8f36)";
  if (token === "phase4") return "var(--hopy-state-phase4, #2f7a59)";
  return "var(--hopy-state-phase5, #2f5f8f)";
}

export function resolveVisualDotColor(
  visual: ReturnType<typeof getHopyStateVisual>,
  fallbackToken: "phase1" | "phase2" | "phase3" | "phase4" | "phase5"
): string {
  const visualAny = visual as any;

  const candidates = [
    visualAny?.dotColor,
    visualAny?.color,
    visualAny?.accentColor,
    visualAny?.stateColor,
    visualAny?.hex,
  ];

  for (const v of candidates) {
    if (typeof v === "string" && v.trim() !== "") return v;
  }

  return memoryStateDotColor(fallbackToken);
}

function readNumeric(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim() !== "") {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function readBool(v: unknown): boolean | null {
  if (typeof v === "boolean") return v;
  if (typeof v === "string") {
    const s = v.trim().toLowerCase();
    if (s === "true" || s === "1") return true;
    if (s === "false" || s === "0") return false;
  }
  if (typeof v === "number") {
    if (v === 1) return true;
    if (v === 0) return false;
  }
  return null;
}

function clampPhase(v: number): number {
  return Math.max(1, Math.min(5, Math.round(v)));
}

function levelToPhase(v: number): number {
  return clampPhase(v);
}

function readPhaseCandidate(v: unknown): number | null {
  const n = readNumeric(v);
  if (n == null) return null;
  if (n >= 1 && n <= 5) return clampPhase(n);
  return null;
}

function readLevelCandidate(v: unknown): number | null {
  const n = readNumeric(v);
  if (n == null) return null;
  if (n >= 1 && n <= 5) return Math.round(n);
  return null;
}

export function resolveMemoryState(item: MemoryItem) {
  const raw = item as any;
  const normalizedState = normalizeHopyState(
    raw?.state ??
      raw?.memory_state ??
      raw?.memoryState ??
      raw?.assistant_state ??
      raw?.assistantState ??
      raw?.reply_state ??
      raw?.replyState ??
      raw?.hopy_state ??
      raw?.hopyState ??
      null
  );

  const phaseCandidates = [
    raw?.current_phase,
    raw?.currentPhase,
    raw?.phase,
    raw?.state_phase,
    raw?.statePhase,
    raw?.memory_phase,
    raw?.memoryPhase,
    raw?.assistant_phase,
    raw?.assistantPhase,
    raw?.reply_phase,
    raw?.replyPhase,
    raw?.state?.current_phase,
    raw?.state?.currentPhase,
    raw?.state?.phase,
    raw?.state?.state_phase,
    raw?.state?.statePhase,
    raw?.memory_state?.current_phase,
    raw?.memory_state?.currentPhase,
    raw?.memory_state?.phase,
    raw?.memory_state?.state_phase,
    raw?.memory_state?.statePhase,
    raw?.memoryState?.current_phase,
    raw?.memoryState?.currentPhase,
    raw?.memoryState?.phase,
    raw?.memoryState?.state_phase,
    raw?.memoryState?.statePhase,
    raw?.assistant_state?.current_phase,
    raw?.assistant_state?.currentPhase,
    raw?.assistant_state?.phase,
    raw?.assistant_state?.state_phase,
    raw?.assistant_state?.statePhase,
    raw?.assistantState?.current_phase,
    raw?.assistantState?.currentPhase,
    raw?.assistantState?.phase,
    raw?.assistantState?.state_phase,
    raw?.assistantState?.statePhase,
    raw?.reply_state?.current_phase,
    raw?.reply_state?.currentPhase,
    raw?.reply_state?.phase,
    raw?.reply_state?.state_phase,
    raw?.reply_state?.statePhase,
    raw?.replyState?.current_phase,
    raw?.replyState?.currentPhase,
    raw?.replyState?.phase,
    raw?.replyState?.state_phase,
    raw?.replyState?.statePhase,
    raw?.hopy_state?.current_phase,
    raw?.hopy_state?.currentPhase,
    raw?.hopy_state?.phase,
    raw?.hopy_state?.state_phase,
    raw?.hopy_state?.statePhase,
    raw?.hopyState?.current_phase,
    raw?.hopyState?.currentPhase,
    raw?.hopyState?.phase,
    raw?.hopyState?.state_phase,
    raw?.hopyState?.statePhase,
    normalizedState?.current_phase,
    normalizedState?.phase,
  ];

  let phase: number | null = null;
  for (const v of phaseCandidates) {
    const p = readPhaseCandidate(v);
    if (p != null) {
      phase = p;
      break;
    }
  }

  const levelCandidates = [
    raw?.state_level,
    raw?.stateLevel,
    raw?.memory_state_level,
    raw?.memoryStateLevel,
    raw?.assistant_state_level,
    raw?.assistantStateLevel,
    raw?.reply_state_level,
    raw?.replyStateLevel,
    raw?.level,
    raw?.state?.state_level,
    raw?.state?.stateLevel,
    raw?.state?.level,
    raw?.memory_state?.state_level,
    raw?.memory_state?.stateLevel,
    raw?.memory_state?.level,
    raw?.memoryState?.state_level,
    raw?.memoryState?.stateLevel,
    raw?.memoryState?.level,
    raw?.assistant_state?.state_level,
    raw?.assistant_state?.stateLevel,
    raw?.assistant_state?.level,
    raw?.assistantState?.state_level,
    raw?.assistantState?.stateLevel,
    raw?.assistantState?.level,
    raw?.reply_state?.state_level,
    raw?.reply_state?.stateLevel,
    raw?.reply_state?.level,
    raw?.replyState?.state_level,
    raw?.replyState?.stateLevel,
    raw?.replyState?.level,
    raw?.hopy_state?.state_level,
    raw?.hopy_state?.stateLevel,
    raw?.hopy_state?.level,
    raw?.hopyState?.state_level,
    raw?.hopyState?.stateLevel,
    raw?.hopyState?.level,
    normalizedState?.state_level,
    normalizedState?.level,
  ];

  let level: number | null = null;
  for (const v of levelCandidates) {
    const l = readLevelCandidate(v);
    if (l != null) {
      level = l;
      break;
    }
  }

  if (phase == null && level != null) phase = levelToPhase(level);
  if (level == null && phase != null) level = phase;

  const prevPhaseCandidates = [
    raw?.prev_phase,
    raw?.prevPhase,
    raw?.previous_phase,
    raw?.previousPhase,
    raw?.memory_prev_phase,
    raw?.memoryPrevPhase,
    raw?.assistant_prev_phase,
    raw?.assistantPrevPhase,
    raw?.reply_prev_phase,
    raw?.replyPrevPhase,
    raw?.state?.prev_phase,
    raw?.state?.prevPhase,
    raw?.state?.previous_phase,
    raw?.state?.previousPhase,
    raw?.state?.memory_prev_phase,
    raw?.state?.memoryPrevPhase,
    raw?.state?.assistant_prev_phase,
    raw?.state?.assistantPrevPhase,
    raw?.state?.reply_prev_phase,
    raw?.state?.replyPrevPhase,
    raw?.memory_state?.prev_phase,
    raw?.memory_state?.prevPhase,
    raw?.memory_state?.previous_phase,
    raw?.memory_state?.previousPhase,
    raw?.memory_state?.memory_prev_phase,
    raw?.memory_state?.memoryPrevPhase,
    raw?.memory_state?.assistant_prev_phase,
    raw?.memory_state?.assistantPrevPhase,
    raw?.memory_state?.reply_prev_phase,
    raw?.memory_state?.replyPrevPhase,
    raw?.memoryState?.prev_phase,
    raw?.memoryState?.prevPhase,
    raw?.memoryState?.previous_phase,
    raw?.memoryState?.previousPhase,
    raw?.memoryState?.memory_prev_phase,
    raw?.memoryState?.memoryPrevPhase,
    raw?.memoryState?.assistant_prev_phase,
    raw?.memoryState?.assistantPrevPhase,
    raw?.memoryState?.reply_prev_phase,
    raw?.memoryState?.replyPrevPhase,
    raw?.assistant_state?.prev_phase,
    raw?.assistant_state?.prevPhase,
    raw?.assistant_state?.previous_phase,
    raw?.assistant_state?.previousPhase,
    raw?.assistant_state?.memory_prev_phase,
    raw?.assistant_state?.memoryPrevPhase,
    raw?.assistant_state?.assistant_prev_phase,
    raw?.assistant_state?.assistantPrevPhase,
    raw?.assistant_state?.reply_prev_phase,
    raw?.assistant_state?.replyPrevPhase,
    raw?.assistantState?.prev_phase,
    raw?.assistantState?.prevPhase,
    raw?.assistantState?.previous_phase,
    raw?.assistantState?.previousPhase,
    raw?.assistantState?.memory_prev_phase,
    raw?.assistantState?.memoryPrevPhase,
    raw?.assistantState?.assistant_prev_phase,
    raw?.assistantState?.assistantPrevPhase,
    raw?.assistantState?.reply_prev_phase,
    raw?.assistantState?.replyPrevPhase,
    raw?.reply_state?.prev_phase,
    raw?.reply_state?.prevPhase,
    raw?.reply_state?.previous_phase,
    raw?.reply_state?.previousPhase,
    raw?.reply_state?.memory_prev_phase,
    raw?.reply_state?.memoryPrevPhase,
    raw?.reply_state?.assistant_prev_phase,
    raw?.reply_state?.assistantPrevPhase,
    raw?.reply_state?.reply_prev_phase,
    raw?.reply_state?.replyPrevPhase,
    raw?.replyState?.prev_phase,
    raw?.replyState?.prevPhase,
    raw?.replyState?.previous_phase,
    raw?.replyState?.previousPhase,
    raw?.replyState?.memory_prev_phase,
    raw?.replyState?.memoryPrevPhase,
    raw?.replyState?.assistant_prev_phase,
    raw?.replyState?.assistantPrevPhase,
    raw?.replyState?.reply_prev_phase,
    raw?.replyState?.replyPrevPhase,
    raw?.hopy_state?.prev_phase,
    raw?.hopy_state?.prevPhase,
    raw?.hopy_state?.previous_phase,
    raw?.hopy_state?.previousPhase,
    raw?.hopy_state?.memory_prev_phase,
    raw?.hopy_state?.memoryPrevPhase,
    raw?.hopy_state?.assistant_prev_phase,
    raw?.hopy_state?.assistantPrevPhase,
    raw?.hopy_state?.reply_prev_phase,
    raw?.hopy_state?.replyPrevPhase,
    raw?.hopyState?.prev_phase,
    raw?.hopyState?.prevPhase,
    raw?.hopyState?.previous_phase,
    raw?.hopyState?.previousPhase,
    raw?.hopyState?.memory_prev_phase,
    raw?.hopyState?.memoryPrevPhase,
    raw?.hopyState?.assistant_prev_phase,
    raw?.hopyState?.assistantPrevPhase,
    raw?.hopyState?.reply_prev_phase,
    raw?.hopyState?.replyPrevPhase,
    normalizedState?.prev_phase,
    normalizedState?.previous_phase,
  ];

  let prevPhase: number | null = null;
  for (const v of prevPhaseCandidates) {
    const p = readPhaseCandidate(v);
    if (p != null) {
      prevPhase = p;
      break;
    }
  }

  const prevLevelCandidates = [
    raw?.prev_state_level,
    raw?.prevStateLevel,
    raw?.previous_state_level,
    raw?.previousStateLevel,
    raw?.memory_prev_state_level,
    raw?.memoryPrevStateLevel,
    raw?.assistant_prev_state_level,
    raw?.assistantPrevStateLevel,
    raw?.reply_prev_state_level,
    raw?.replyPrevStateLevel,
    raw?.state?.prev_state_level,
    raw?.state?.prevStateLevel,
    raw?.state?.previous_state_level,
    raw?.state?.previousStateLevel,
    raw?.state?.memory_prev_state_level,
    raw?.state?.memoryPrevStateLevel,
    raw?.state?.assistant_prev_state_level,
    raw?.state?.assistantPrevStateLevel,
    raw?.state?.reply_prev_state_level,
    raw?.state?.replyPrevStateLevel,
    raw?.memory_state?.prev_state_level,
    raw?.memory_state?.prevStateLevel,
    raw?.memory_state?.previous_state_level,
    raw?.memory_state?.previousStateLevel,
    raw?.memory_state?.memory_prev_state_level,
    raw?.memory_state?.memoryPrevStateLevel,
    raw?.memory_state?.assistant_prev_state_level,
    raw?.memory_state?.assistantPrevStateLevel,
    raw?.memory_state?.reply_prev_state_level,
    raw?.memory_state?.replyPrevStateLevel,
    raw?.memoryState?.prev_state_level,
    raw?.memoryState?.prevStateLevel,
    raw?.memoryState?.previous_state_level,
    raw?.memoryState?.previousStateLevel,
    raw?.memoryState?.memory_prev_state_level,
    raw?.memoryState?.memoryPrevStateLevel,
    raw?.memoryState?.assistant_prev_state_level,
    raw?.memoryState?.assistantPrevStateLevel,
    raw?.memoryState?.reply_prev_state_level,
    raw?.memoryState?.replyPrevStateLevel,
    raw?.assistant_state?.prev_state_level,
    raw?.assistant_state?.prevStateLevel,
    raw?.assistant_state?.previous_state_level,
    raw?.assistant_state?.previousStateLevel,
    raw?.assistant_state?.memory_prev_state_level,
    raw?.assistant_state?.memoryPrevStateLevel,
    raw?.assistant_state?.assistant_prev_state_level,
    raw?.assistant_state?.assistantPrevStateLevel,
    raw?.assistant_state?.reply_prev_state_level,
    raw?.assistant_state?.replyPrevStateLevel,
    raw?.assistantState?.prev_state_level,
    raw?.assistantState?.prevStateLevel,
    raw?.assistantState?.previous_state_level,
    raw?.assistantState?.previousStateLevel,
    raw?.assistantState?.memory_prev_state_level,
    raw?.assistantState?.memoryPrevStateLevel,
    raw?.assistantState?.assistant_prev_state_level,
    raw?.assistantState?.assistantPrevStateLevel,
    raw?.assistantState?.reply_prev_state_level,
    raw?.assistantState?.replyPrevStateLevel,
    raw?.reply_state?.prev_state_level,
    raw?.reply_state?.prevStateLevel,
    raw?.reply_state?.previous_state_level,
    raw?.reply_state?.previousStateLevel,
    raw?.reply_state?.memory_prev_state_level,
    raw?.reply_state?.memoryPrevStateLevel,
    raw?.reply_state?.assistant_prev_state_level,
    raw?.reply_state?.assistantPrevStateLevel,
    raw?.reply_state?.reply_prev_state_level,
    raw?.reply_state?.replyPrevStateLevel,
    raw?.replyState?.prev_state_level,
    raw?.replyState?.prevStateLevel,
    raw?.replyState?.previous_state_level,
    raw?.replyState?.previousStateLevel,
    raw?.replyState?.memory_prev_state_level,
    raw?.replyState?.memoryPrevStateLevel,
    raw?.replyState?.assistant_prev_state_level,
    raw?.replyState?.assistantPrevStateLevel,
    raw?.replyState?.reply_prev_state_level,
    raw?.replyState?.replyPrevStateLevel,
    raw?.hopy_state?.prev_state_level,
    raw?.hopy_state?.prevStateLevel,
    raw?.hopy_state?.previous_state_level,
    raw?.hopy_state?.previousStateLevel,
    raw?.hopy_state?.memory_prev_state_level,
    raw?.hopy_state?.memoryPrevStateLevel,
    raw?.hopy_state?.assistant_prev_state_level,
    raw?.hopy_state?.assistantPrevStateLevel,
    raw?.hopy_state?.reply_prev_state_level,
    raw?.hopy_state?.replyPrevStateLevel,
    raw?.hopyState?.prev_state_level,
    raw?.hopyState?.prevStateLevel,
    raw?.hopyState?.previous_state_level,
    raw?.hopyState?.previousStateLevel,
    raw?.hopyState?.memory_prev_state_level,
    raw?.hopyState?.memoryPrevStateLevel,
    raw?.hopyState?.assistant_prev_state_level,
    raw?.hopyState?.assistantPrevStateLevel,
    raw?.hopyState?.reply_prev_state_level,
    raw?.hopyState?.replyPrevStateLevel,
    normalizedState?.prev_state_level,
    normalizedState?.previous_state_level,
  ];

  let prevLevel: number | null = null;
  for (const v of prevLevelCandidates) {
    const l = readLevelCandidate(v);
    if (l != null) {
      prevLevel = l;
      break;
    }
  }

  if (prevPhase == null && prevLevel != null) prevPhase = levelToPhase(prevLevel);
  if (prevLevel == null && prevPhase != null) prevLevel = prevPhase;

  const changedCandidates = [
    raw?.state_changed,
    raw?.stateChanged,
    raw?.memory_state_changed,
    raw?.memoryStateChanged,
    raw?.assistant_state_changed,
    raw?.assistantStateChanged,
    raw?.reply_state_changed,
    raw?.replyStateChanged,
    raw?.phase_changed,
    raw?.phaseChanged,
    raw?.changed,
    raw?.state?.state_changed,
    raw?.state?.stateChanged,
    raw?.memory_state?.state_changed,
    raw?.memory_state?.stateChanged,
    raw?.memoryState?.state_changed,
    raw?.memoryState?.stateChanged,
    raw?.assistant_state?.state_changed,
    raw?.assistant_state?.stateChanged,
    raw?.assistantState?.state_changed,
    raw?.assistantState?.stateChanged,
    raw?.reply_state?.state_changed,
    raw?.reply_state?.stateChanged,
    raw?.replyState?.state_changed,
    raw?.replyState?.stateChanged,
    raw?.hopy_state?.state_changed,
    raw?.hopy_state?.stateChanged,
    raw?.hopyState?.state_changed,
    raw?.hopyState?.stateChanged,
  ];

  let changed: boolean | null = null;
  for (const v of changedCandidates) {
    const b = readBool(v);
    if (b != null) {
      changed = b;
      break;
    }
  }

  if (changed == null) {
    if (phase != null && prevPhase != null) {
      changed = phase !== prevPhase;
    } else if (level != null && prevLevel != null) {
      changed = level !== prevLevel;
    } else {
      changed = false;
    }
  }

  if (phase == null && normalizedState?.phase != null) {
    phase = clampPhase(normalizedState.phase);
  }
  if (level == null && normalizedState?.level != null) {
    level = clampPhase(normalizedState.level);
  }

  if (phase == null && level != null) phase = levelToPhase(level);
  if (level == null && phase != null) level = phase;

  return {
    level,
    phase,
    prevLevel,
    prevPhase,
    changed,
    normalizedState,
  };
}