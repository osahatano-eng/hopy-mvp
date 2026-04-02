// /components/memories/MemoryToolbar.tsx
"use client";

import React from "react";

export type MemoryToolbarTab = "active" | "trash";

export type MemoryToolbarProps = {
  searchText: string;
  onSearchTextChange: (value: string) => void;
  currentTab: MemoryToolbarTab;
  onTabChange: (tab: MemoryToolbarTab) => void;
  onReload?: () => void;
  onAdd?: () => void;
  reloading?: boolean;
  addDisabled?: boolean;
};

export default function MemoryToolbar(props: MemoryToolbarProps) {
  const {
    searchText,
    onSearchTextChange,
    currentTab,
    onTabChange,
    onReload,
    onAdd,
    reloading = false,
    addDisabled = false,
  } = props;

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-white/10 bg-white/5 p-4 shadow-sm">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => onTabChange("active")}
            className={`rounded-xl px-3 py-2 text-sm transition ${
              currentTab === "active"
                ? "bg-white text-black"
                : "border border-white/10 bg-white/10 text-white hover:bg-white/15"
            }`}
          >
            Active
          </button>

          <button
            type="button"
            onClick={() => onTabChange("trash")}
            className={`rounded-xl px-3 py-2 text-sm transition ${
              currentTab === "trash"
                ? "bg-white text-black"
                : "border border-white/10 bg-white/10 text-white hover:bg-white/15"
            }`}
          >
            Trash
          </button>
        </div>

        <div className="flex flex-wrap gap-2">
          {onReload ? (
            <button
              type="button"
              onClick={onReload}
              disabled={reloading}
              className="rounded-xl border border-white/10 bg-white/10 px-3 py-2 text-sm text-white transition hover:bg-white/15 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {reloading ? "Reloading..." : "Reload"}
            </button>
          ) : null}

          {onAdd ? (
            <button
              type="button"
              onClick={onAdd}
              disabled={addDisabled}
              className="rounded-xl border border-white/10 bg-white/10 px-3 py-2 text-sm text-white transition hover:bg-white/15 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Add
            </button>
          ) : null}
        </div>
      </div>

      <label className="block">
        <span className="mb-1 block text-xs text-white/60">Search</span>
        <input
          type="text"
          value={searchText}
          onChange={(e) => onSearchTextChange(e.target.value)}
          placeholder="Search memories"
          className="w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm text-white outline-none placeholder:text-white/35"
        />
      </label>
    </div>
  );
}