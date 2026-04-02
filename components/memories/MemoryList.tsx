// /components/memories/MemoryList.tsx
"use client";

import React from "react";
import type { MemoryListItemViewModel } from "./lib/buildMemoryListViewModel";

export type MemoryListProps = {
  items: MemoryListItemViewModel[];
  emptyText?: string;
  onDelete?: (id: string) => void;
  onRestore?: (id: string) => void;
  onEdit?: (id: string) => void;
  busyId?: string | null;
};

function formatDateTime(value: string): string {
  const text = typeof value === "string" ? value.trim() : "";
  if (!text) return "";

  const date = new Date(text);
  if (Number.isNaN(date.getTime())) {
    return text;
  }

  return date.toLocaleString("ja-JP", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function MemoryList(props: MemoryListProps) {
  const {
    items,
    emptyText = "MEMORIES はまだありません。",
    onDelete,
    onRestore,
    onEdit,
    busyId = null,
  } = props;

  const safeItems = Array.isArray(items) ? items : [];

  if (!safeItems.length) {
    return (
      <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-white/70">
        {emptyText}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {safeItems.map((item) => {
        const isBusy = busyId === item.id;
        const isTrash = item.status === "trash";

        return (
          <article
            key={item.id}
            className="rounded-2xl border border-white/10 bg-white/5 p-4 shadow-sm"
          >
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0 flex-1">
                <div className="mb-2 flex flex-wrap items-center gap-2 text-xs">
                  <span className="rounded-full border border-white/10 bg-white/10 px-2 py-1 text-white/80">
                    {item.sourceTypeLabel}
                  </span>
                  <span className="rounded-full border border-white/10 bg-white/10 px-2 py-1 text-white/80">
                    {item.memoryTypeLabel}
                  </span>
                  <span className="rounded-full border border-white/10 bg-white/10 px-2 py-1 text-white/80">
                    {item.statusLabel}
                  </span>
                </div>

                <p className="whitespace-pre-wrap break-words text-sm leading-6 text-white">
                  {item.body}
                </p>

                <dl className="mt-3 grid gap-1 text-xs text-white/55">
                  <div className="flex flex-wrap gap-2">
                    <dt>作成:</dt>
                    <dd>{formatDateTime(item.createdAt)}</dd>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <dt>更新:</dt>
                    <dd>{formatDateTime(item.updatedAt)}</dd>
                  </div>

                  {item.sourceThreadId ? (
                    <div className="flex flex-wrap gap-2">
                      <dt>Thread:</dt>
                      <dd className="break-all">{item.sourceThreadId}</dd>
                    </div>
                  ) : null}

                  {item.sourceMessageId ? (
                    <div className="flex flex-wrap gap-2">
                      <dt>Message:</dt>
                      <dd className="break-all">{item.sourceMessageId}</dd>
                    </div>
                  ) : null}
                </dl>
              </div>

              <div className="flex shrink-0 flex-wrap gap-2 sm:justify-end">
                {onEdit ? (
                  <button
                    type="button"
                    onClick={() => onEdit(item.id)}
                    disabled={isBusy}
                    className="rounded-xl border border-white/10 bg-white/10 px-3 py-2 text-xs text-white transition hover:bg-white/15 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    編集
                  </button>
                ) : null}

                {isTrash ? (
                  onRestore ? (
                    <button
                      type="button"
                      onClick={() => onRestore(item.id)}
                      disabled={isBusy}
                      className="rounded-xl border border-white/10 bg-white/10 px-3 py-2 text-xs text-white transition hover:bg-white/15 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      復元
                    </button>
                  ) : null
                ) : onDelete ? (
                  <button
                    type="button"
                    onClick={() => onDelete(item.id)}
                    disabled={isBusy}
                    className="rounded-xl border border-white/10 bg-white/10 px-3 py-2 text-xs text-white transition hover:bg-white/15 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    削除
                  </button>
                ) : null}
              </div>
            </div>
          </article>
        );
      })}
    </div>
  );
}