// /app/api/chat/_lib/route/hopyConfirmedPayload/buildMemoryCandidates.ts

import type { ConfirmedMemoryCandidate } from "../authenticatedHelpers";

type MemoryWriteDebug = {
  mem_extract_preview?: unknown;
};

export type HopyMemoryCandidate = {
  source_type: "auto" | "manual";
  memory_type:
    | "trait"
    | "theme"
    | "support_context"
    | "dashboard_signal"
    | "manual_note";
  body: string;
  savable: boolean;
  thread_id: string | null;
  source_message_id: string | null;
};

type BuildMemoryCandidatesParams = {
  memoryWrite: MemoryWriteDebug;
};

function normalizeMemoryType(
  value: unknown,
): HopyMemoryCandidate["memory_type"] | null {
  return value === "trait" ||
    value === "theme" ||
    value === "support_context" ||
    value === "dashboard_signal" ||
    value === "manual_note"
    ? value
    : null;
}

function normalizeBody(value: unknown): string {
  return String(value ?? "")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeSavable(value: unknown): boolean {
  return value === true;
}

function normalizeOptionalId(value: unknown): string | null {
  const s = String(value ?? "").trim();
  return s ? s : null;
}

function parseConfirmedMemoryPreviewItems(
  preview: unknown,
): Array<Record<string, unknown>> {
  if (!preview) return [];

  if (typeof preview === "string") {
    try {
      const parsed = JSON.parse(preview);
      return parseConfirmedMemoryPreviewItems(parsed);
    } catch {
      return [];
    }
  }

  if (Array.isArray(preview)) {
    return preview.filter(
      (item): item is Record<string, unknown> =>
        !!item && typeof item === "object" && !Array.isArray(item),
    );
  }

  if (preview && typeof preview === "object") {
    const source = String((preview as { source?: unknown }).source ?? "").trim();
    const items = (preview as { items?: unknown[] }).items;

    if (source !== "confirmed_memory_candidates") {
      return [];
    }

    if (!Array.isArray(items)) {
      return [];
    }

    return items.filter(
      (item): item is Record<string, unknown> =>
        !!item && typeof item === "object" && !Array.isArray(item),
    );
  }

  return [];
}

function normalizePreviewItemToMemoryCandidate(
  item: Record<string, unknown>,
): HopyMemoryCandidate | null {
  const sourceType: HopyMemoryCandidate["source_type"] =
    item.source_type === "manual" ? "manual" : "auto";

  const memoryType = normalizeMemoryType(item.memory_type);
  const body = normalizeBody(item.body ?? item.content);
  const savable = normalizeSavable(item.savable);
  const thread_id = normalizeOptionalId(item.thread_id);
  const source_message_id = normalizeOptionalId(
    item.source_message_id ?? item.latest_reply_id ?? item.message_id,
  );

  if (!memoryType || !body) return null;

  return {
    source_type: sourceType,
    memory_type: memoryType,
    body,
    savable,
    thread_id,
    source_message_id,
  };
}

function buildMemoryCandidateDedupeKey(
  candidate: Pick<
    ConfirmedMemoryCandidate,
    "source_type" | "memory_type" | "body"
  >,
): string {
  return `${candidate.source_type}::${candidate.memory_type}::${candidate.body}`;
}

export function buildMemoryCandidates(
  params: BuildMemoryCandidatesParams,
): HopyMemoryCandidate[] {
  const previewItems = parseConfirmedMemoryPreviewItems(
    params.memoryWrite.mem_extract_preview,
  );
  const seen = new Set<string>();

  return previewItems.flatMap((item) => {
    const candidate = normalizePreviewItemToMemoryCandidate(item);
    if (!candidate) return [];

    const dedupeKey = buildMemoryCandidateDedupeKey(candidate);
    if (seen.has(dedupeKey)) return [];

    seen.add(dedupeKey);
    return [candidate];
  });
}

/*
このファイルの正式役割
confirmed memory preview から HOPY 用 memory_candidates を復元する専用ファイル。
mem_extract_preview を読み、正規化・重複除去して HopyMemoryCandidate[] を返す。
*/

/*
【今回このファイルで修正したこと】
- authenticatedHelpers.ts から export されていない MemoryWriteDebug の import を削除した。
- このファイル内で必要最小限の MemoryWriteDebug 型を定義した。
- memory candidate の正規化・重複除去ロジック自体は変えていない。
*/
// このファイルの正式役割: confirmed memory preview から HOPY 用 memory_candidates を復元する専用ファイル