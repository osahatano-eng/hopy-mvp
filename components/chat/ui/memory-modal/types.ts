// /components/chat/ui/memory-modal/types.ts
import type { Lang } from "../../lib/chatTypes";
import type { MemoryItem } from "../../lib/memoriesApi";

export type MemoryModalProps = {
  open: boolean;
  onClose: () => void;
  uiLang: Lang;
};

export type RowState =
  | { mode: "view" }
  | { mode: "edit"; draft: string; saving: boolean; error?: string };

export type ToastState =
  | null
  | {
      id: string;
      message: string;
      tone?: "default" | "danger";
      ttlMs?: number;
      actionLabel?: string;
      onAction?: () => void;
      action2Label?: string;
      onAction2?: () => void;
    };

export type PendingDelete = {
  item: MemoryItem;
  index: number;
  timer: number;
  expiresAt: number;
};

export type MemoryModalUi = {
  title: string;
  subtitle: string;
  active: string;
  trash: string;
  search: string;
  close: string;
  reload: string;
  empty: string;
  edit: string;
  save: string;
  cancel: string;
  del: string;
  deleteConfirm: string;
  restore: string;
  hardDel: string;
  hardDelConfirm: string;
  failedLoad: string;
  failedSave: string;
  failedDelete: string;
  failedCreate: string;
  failedRestore: string;
  failedHardDelete: string;
  metaCreated: string;
  metaUpdated: string;
  addTitle: string;
  addPlaceholder: string;
  addBtn: string;
  addHint: string;
  saveHint: string;
  dirtyConfirm: string;
  switchEditConfirm: string;
  undo: string;
  undoAll: string;
  deletedOne: string;
  deletedMany: (n: number) => string;
  restoring: string;
  deleting: string;
  saved: string;
  added: string;
  undone: string;
  restored: string;
  policyTitle: string;
  policyLine1: string;
  policyLine2: string;
};