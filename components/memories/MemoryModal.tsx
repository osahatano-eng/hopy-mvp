// /components/memories/MemoryModal.tsx
"use client";

import React, { useEffect, useState } from "react";

export type MemoryModalProps = {
  open: boolean;
  title?: string;
  initialBody?: string;
  saving?: boolean;
  onClose: () => void;
  onSave: (body: string) => void;
};

export default function MemoryModal(props: MemoryModalProps) {
  const {
    open,
    title = "メモを追加",
    initialBody = "",
    saving = false,
    onClose,
    onSave,
  } = props;

  const [body, setBody] = useState(initialBody);

  useEffect(() => {
    if (open) {
      setBody(initialBody);
    }
  }, [open, initialBody]);

  if (!open) return null;

  const trimmedBody = body.trim();
  const disabled = saving || !trimmedBody;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-lg rounded-2xl border border-white/10 bg-[#111111] p-5 shadow-xl">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-white">{title}</h2>
            <p className="mt-1 text-sm text-white/60">
              Manual memory の本文だけを入力します。
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="rounded-xl border border-white/10 bg-white/10 px-3 py-2 text-sm text-white transition hover:bg-white/15 disabled:cursor-not-allowed disabled:opacity-50"
          >
            閉じる
          </button>
        </div>

        <label className="block">
          <span className="mb-2 block text-sm text-white/75">本文</span>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={8}
            placeholder="残しておきたい内容を入力"
            className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm leading-6 text-white outline-none placeholder:text-white/35"
          />
        </label>

        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="rounded-xl border border-white/10 bg-white/10 px-4 py-2 text-sm text-white transition hover:bg-white/15 disabled:cursor-not-allowed disabled:opacity-50"
          >
            キャンセル
          </button>

          <button
            type="button"
            onClick={() => onSave(trimmedBody)}
            disabled={disabled}
            className="rounded-xl bg-white px-4 py-2 text-sm text-black transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {saving ? "保存中..." : "保存"}
          </button>
        </div>
      </div>
    </div>
  );
}