// /components/memories/lib/buildMemoryListViewModel.ts

import type {
  MemorySourceType,
  MemoryStatus,
  MemoryType,
} from "../../../app/api/chat/_lib/memories/types";

export type MemoryListItemInput = {
  id: string;
  body: string;
  source_type: MemorySourceType;
  memory_type: MemoryType;
  status: MemoryStatus;
  created_at: string;
  updated_at: string;
  source_message_id?: string | null;
  source_thread_id?: string | null;
};

export type MemoryListItemViewModel = {
  id: string;
  body: string;
  sourceType: MemorySourceType;
  sourceTypeLabel: string;
  memoryType: MemoryType;
  memoryTypeLabel: string;
  status: MemoryStatus;
  statusLabel: string;
  createdAt: string;
  updatedAt: string;
  sourceMessageId: string | null;
  sourceThreadId: string | null;
};

type BuildMemoryListViewModelParams = {
  items: MemoryListItemInput[];
  uiLang?: "ja" | "en";
};

function normalizeText(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeOptionalText(value: unknown): string | null {
  const normalized = normalizeText(value);
  return normalized ? normalized : null;
}

function normalizeSourceType(value: unknown): MemorySourceType {
  return value === "manual" ? "manual" : "auto";
}

function normalizeMemoryType(value: unknown): MemoryType {
  switch (value) {
    case "trait":
    case "theme":
    case "support_context":
    case "dashboard_signal":
    case "manual_note":
      return value;
    default:
      return "theme";
  }
}

function normalizeStatus(value: unknown): MemoryStatus {
  return value === "trash" ? "trash" : "active";
}

function buildSourceTypeLabel(
  value: MemorySourceType,
  uiLang: "ja" | "en",
): string {
  if (uiLang === "en") {
    return value === "manual" ? "Manual" : "Auto";
  }

  return value === "manual" ? "手動" : "自動";
}

function buildMemoryTypeLabel(
  value: MemoryType,
  uiLang: "ja" | "en",
): string {
  if (uiLang === "en") {
    switch (value) {
      case "trait":
        return "Trait";
      case "theme":
        return "Theme";
      case "support_context":
        return "Support Context";
      case "dashboard_signal":
        return "Dashboard Signal";
      case "manual_note":
        return "Manual Note";
    }
  }

  switch (value) {
    case "trait":
      return "特性";
    case "theme":
      return "テーマ";
    case "support_context":
      return "支援文脈";
    case "dashboard_signal":
      return "ダッシュボード信号";
    case "manual_note":
      return "手動メモ";
  }
}

function buildStatusLabel(
  value: MemoryStatus,
  uiLang: "ja" | "en",
): string {
  if (uiLang === "en") {
    return value === "trash" ? "Trash" : "Active";
  }

  return value === "trash" ? "ゴミ箱" : "有効";
}

export function buildMemoryListViewModel(
  params: BuildMemoryListViewModelParams,
): MemoryListItemViewModel[] {
  const uiLang = params.uiLang === "en" ? "en" : "ja";
  const items = Array.isArray(params.items) ? params.items : [];

  return items.map((item) => {
    const sourceType = normalizeSourceType(item?.source_type);
    const memoryType = normalizeMemoryType(item?.memory_type);
    const status = normalizeStatus(item?.status);

    return {
      id: normalizeText(item?.id),
      body: normalizeText(item?.body),
      sourceType,
      sourceTypeLabel: buildSourceTypeLabel(sourceType, uiLang),
      memoryType,
      memoryTypeLabel: buildMemoryTypeLabel(memoryType, uiLang),
      status,
      statusLabel: buildStatusLabel(status, uiLang),
      createdAt: normalizeText(item?.created_at),
      updatedAt: normalizeText(item?.updated_at),
      sourceMessageId: normalizeOptionalText(item?.source_message_id),
      sourceThreadId: normalizeOptionalText(item?.source_thread_id),
    };
  });
}