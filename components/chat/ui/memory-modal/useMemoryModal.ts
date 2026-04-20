// /components/chat/ui/memory-modal/useMemoryModal.ts

import { useEffect, useMemo, useRef, useState } from "react";
import type { MemoryItem, MemoryScope } from "../../lib/memoriesApi";
import {
  createMemory,
  deleteMemory,
  hardDeleteMemory,
  listMemoriesWithTotal,
  restoreMemory,
  updateMemory,
} from "../../lib/memoriesApi";
import { clampCount } from "./memoryModalFormat";
import type { MemoryModalUi, PendingDelete, RowState, ToastState } from "./types";

function getFocusable(container: HTMLElement | null): HTMLElement[] {
  if (!container) return [];
  const nodes = Array.from(
    container.querySelectorAll<HTMLElement>(
      [
        'a[href]',
        'button:not([disabled])',
        'textarea:not([disabled])',
        'input:not([disabled])',
        'select:not([disabled])',
        '[tabindex]:not([tabindex="-1"])',
      ].join(",")
    )
  );
  return nodes.filter((el) => {
    const style = window.getComputedStyle(el);
    if (style.display === "none" || style.visibility === "hidden") return false;
    return true;
  });
}

type Params = {
  open: boolean;
  onClose: () => void;
  ui: MemoryModalUi;
  panelRef: React.MutableRefObject<HTMLDivElement | null>;
  newRef: React.MutableRefObject<HTMLTextAreaElement | null>;
};

export function useMemoryModal({ open, onClose, ui, panelRef, newRef }: Params) {
  const [scope, setScope] = useState<MemoryScope>("active");

  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<MemoryItem[]>([]);
  const [error, setError] = useState<string>("");
  const [q, setQ] = useState("");

  const [row, setRow] = useState<Record<string, RowState>>({});
  const [editingId, setEditingId] = useState<string | null>(null);

  const [newText, setNewText] = useState("");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState("");

  const [toast, setToast] = useState<ToastState>(null);
  const toastTimerRef = useRef<number | null>(null);

  const [activeCount, setActiveCount] = useState(0);
  const [trashCount, setTrashCount] = useState(0);

  const pendingRef = useRef<PendingDelete[]>([]);
  const [pendingCount, setPendingCount] = useState(0);

  const prevFocusRef = useRef<HTMLElement | null>(null);

  function clearToastTimer() {
    if (toastTimerRef.current) {
      window.clearTimeout(toastTimerRef.current);
      toastTimerRef.current = null;
    }
  }

  function showToast(next: ToastState) {
    clearToastTimer();
    setToast(next);
    if (next?.ttlMs && next.ttlMs > 0) {
      toastTimerRef.current = window.setTimeout(() => {
        setToast(null);
        toastTimerRef.current = null;
      }, next.ttlMs);
    }
  }

  function updatePendingCount() {
    setPendingCount(pendingRef.current.length);
  }

  function findCurrentEditingId(map: Record<string, RowState>) {
    for (const id of Object.keys(map)) {
      const st = map[id];
      if (st?.mode === "edit") return id;
    }
    return null;
  }

  function isRowDirty(id: string, map: Record<string, RowState>) {
    const st = map[id];
    if (!st || st.mode !== "edit") return false;
    const original = items.find((m) => m.id === id)?.text ?? "";
    return String(st.draft ?? "").trim() !== String(original ?? "").trim();
  }

  const isDirty = useMemo(() => {
    if (newText.trim().length > 0) return true;
    for (const id of Object.keys(row)) {
      if (isRowDirty(id, row)) return true;
    }
    return false;
  }, [newText, row, items]);

  async function syncCounts() {
    try {
      const [a, t] = await Promise.all([
        listMemoriesWithTotal("active").catch(() => ({ items: [] as MemoryItem[], total: 0 })),
        listMemoriesWithTotal("trash").catch(() => ({ items: [] as MemoryItem[], total: 0 })),
      ]);
      setActiveCount(clampCount(a.total));
      setTrashCount(clampCount(t.total));
    } catch {}
  }

  async function refresh(
    nextScope: MemoryScope = scope,
    opts?: { keepError?: boolean; syncCounts?: boolean }
  ) {
    setLoading(true);
    if (!opts?.keepError) setError("");
    try {
      const result = await listMemoriesWithTotal(nextScope);
      const list = result.items;
      setItems(list);

      if (nextScope === "active") setActiveCount(clampCount(result.total));
      if (nextScope === "trash") setTrashCount(clampCount(result.total));

      setRow((prev) => {
        const next: Record<string, RowState> = { ...prev };
        const ids = new Set(list.map((x) => x.id));
        for (const k of Object.keys(next)) {
          if (!ids.has(k)) delete next[k];
        }
        return next;
      });
    } catch {
      setError(ui.failedLoad);
    } finally {
      setLoading(false);
      if (opts?.syncCounts !== false) {
        await syncCounts();
      }
    }
  }

  function renderDeleteToast() {
    const n = pendingRef.current.length;
    if (n <= 0) {
      showToast(null);
      return;
    }

    const msg = n === 1 ? ui.deletedOne : ui.deletedMany(n);
    const ttlLeft = Math.max(
      1000,
      Math.min(8000, pendingRef.current[pendingRef.current.length - 1].expiresAt - Date.now())
    );

    showToast({
      id: `undo-queue-${n}`,
      message: msg,
      ttlMs: ttlLeft,
      actionLabel: ui.undo,
      onAction: () => undoLastDelete(),
      action2Label: n > 1 ? ui.undoAll : undefined,
      onAction2: n > 1 ? () => undoAllDeletes() : undefined,
    });
  }

  function dropPendingById(id: string) {
    const list = pendingRef.current;
    const idx = list.findIndex((p) => p.item.id === id);
    if (idx === -1) return;
    const p = list[idx];
    window.clearTimeout(p.timer);
    pendingRef.current = list.filter((x) => x.item.id !== id);
    updatePendingCount();
  }

  function undoLastDelete() {
    const list = pendingRef.current;
    if (list.length === 0) return;

    const last = list[list.length - 1];
    window.clearTimeout(last.timer);
    pendingRef.current = list.slice(0, -1);
    updatePendingCount();

    setActiveCount((c) => clampCount(c + 1));
    setTrashCount((c) => clampCount(c - 1));

    setItems((prev) => {
      const next = prev.slice();
      const exists = next.some((x) => x.id === last.item.id);
      if (!exists) next.splice(Math.min(last.index, next.length), 0, last.item);
      return next;
    });

    restoreMemory(last.item.id).catch(() => {});
    showToast({ id: `undone-${last.item.id}`, message: ui.undone, ttlMs: 1200 });

    queueMicrotask(() => {
      if (pendingRef.current.length > 0) renderDeleteToast();
    });
  }

  function undoAllDeletes() {
    const list = pendingRef.current;
    if (list.length === 0) return;

    for (const p of list) window.clearTimeout(p.timer);
    pendingRef.current = [];
    updatePendingCount();

    setActiveCount((c) => clampCount(c + list.length));
    setTrashCount((c) => clampCount(c - list.length));

    const sorted = list.slice().sort((a, b) => a.index - b.index);
    setItems((prev) => {
      const next = prev.slice();
      for (const p of sorted) {
        const exists = next.some((x) => x.id === p.item.id);
        if (!exists) next.splice(Math.min(p.index, next.length), 0, p.item);
      }
      return next;
    });

    for (const p of list) restoreMemory(p.item.id).catch(() => {});
    showToast({ id: "undone-all", message: ui.undone, ttlMs: 1200 });
  }

  async function flushAllPendingDeletes() {
    const list = pendingRef.current;
    if (list.length === 0) return;

    for (const p of list) window.clearTimeout(p.timer);
    pendingRef.current = [];
    updatePendingCount();

    showToast(null);
    await syncCounts();
  }

  function beginEdit(m: MemoryItem) {
    if (loading || creating) return;

    setRow((prev) => {
      const current = findCurrentEditingId(prev);
      if (current && current === m.id) return prev;

      if (current && isRowDirty(current, prev)) {
        const ok = confirm(ui.switchEditConfirm);
        if (!ok) return prev;
      }

      const next: Record<string, RowState> = {};
      for (const k of Object.keys(prev)) next[k] = { mode: "view" };
      next[m.id] = { mode: "edit", draft: m.text ?? "", saving: false };
      return next;
    });

    setEditingId(m.id);
  }

  function cancelEdit(id: string) {
    setRow((prev) => ({ ...prev, [id]: { mode: "view" } }));
    setEditingId((cur) => (cur === id ? null : cur));
  }

  async function addNew() {
    const t = newText.trim();
    if (!t) return;

    setCreateError("");
    setCreating(true);
    try {
      const created = await createMemory(t);
      if (!created) {
        setCreateError(ui.failedCreate);
        return;
      }

      setNewText("");

      await refresh("active", { keepError: true, syncCounts: true });

      if (scope !== "active") {
        setScope("active");
        setQ("");
        setRow({});
        setEditingId(null);
      }

      queueMicrotask(() => newRef.current?.focus());
      showToast({ id: "added", message: ui.added, ttlMs: 1200 });
    } catch {
      setCreateError(ui.failedCreate);
    } finally {
      setCreating(false);
    }
  }

  async function saveEdit(id: string) {
    const st = row[id];
    if (!st || st.mode !== "edit") return;

    const draft = String(st.draft ?? "").trim();
    setRow((prev) => ({ ...prev, [id]: { ...st, saving: true, error: "" } }));

    const ok = await updateMemory(id, draft).catch(() => false);
    if (!ok) {
      setRow((prev) => ({
        ...prev,
        [id]: { ...st, saving: false, error: ui.failedSave },
      }));
      return;
    }

    setRow((prev) => ({ ...prev, [id]: { mode: "view" } }));
    setEditingId((cur) => (cur === id ? null : cur));

    await refresh(scope, { keepError: true, syncCounts: true });
    showToast({ id: "saved", message: ui.saved, ttlMs: 1200 });
  }

  async function requestDeleteToTrash(id: string) {
    if (scope !== "active") return;
    if (loading || creating) return;

    const okConfirm = confirm(ui.deleteConfirm);
    if (!okConfirm) return;

    const item = items.find((m) => m.id === id);
    if (!item) return;

    const index = items.findIndex((m) => m.id === id);

    setItems((prev) => prev.filter((m) => m.id !== id));
    setActiveCount((c) => clampCount(c - 1));
    setTrashCount((c) => clampCount(c + 1));

    setRow((prev) => {
      const next = { ...prev };
      if (next[id]?.mode === "edit") next[id] = { mode: "view" };
      return next;
    });
    setEditingId((cur) => (cur === id ? null : cur));

    const ok = await deleteMemory(id).catch(() => false);
    if (!ok) {
      setItems((prev) => {
        const next = prev.slice();
        const exists = next.some((x) => x.id === item.id);
        if (!exists) next.splice(Math.min(index, next.length), 0, item);
        return next;
      });
      setActiveCount((c) => clampCount(c + 1));
      setTrashCount((c) => clampCount(c - 1));
      showToast({
        id: `del-fail-${id}`,
        message: ui.failedDelete,
        tone: "danger",
        ttlMs: 2200,
      });
      return;
    }

    const ttl = 6000;
    const expiresAt = Date.now() + ttl;

    const timer = window.setTimeout(() => {
      dropPendingById(id);
      if (pendingRef.current.length > 0) renderDeleteToast();
      else showToast(null);
    }, ttl);

    pendingRef.current = pendingRef.current.filter((p) => p.item.id !== id);
    pendingRef.current = [...pendingRef.current, { item, index, timer, expiresAt }];
    updatePendingCount();
    renderDeleteToast();
  }

  async function restoreFromTrash(id: string) {
    if (scope !== "trash") return;
    if (loading || creating) return;

    const snapshot = items.slice();
    setItems((prev) => prev.filter((m) => m.id !== id));
    setTrashCount((c) => clampCount(c - 1));
    setActiveCount((c) => clampCount(c + 1));

    showToast({ id: `restoring-${id}`, message: ui.restoring, ttlMs: 900 });
    const ok = await restoreMemory(id).catch(() => false);
    if (!ok) {
      setItems(snapshot);
      setTrashCount((c) => clampCount(c + 1));
      setActiveCount((c) => clampCount(c - 1));
      showToast({
        id: `restore-fail-${id}`,
        message: ui.failedRestore,
        tone: "danger",
        ttlMs: 2200,
      });
      return;
    }

    await refresh("trash", { keepError: true, syncCounts: true });
    showToast({ id: `restored-${id}`, message: ui.restored, ttlMs: 1200 });
  }

  async function hardDeleteFromTrash(id: string) {
    if (scope !== "trash") return;
    if (loading || creating) return;

    const okConfirm = confirm(ui.hardDelConfirm);
    if (!okConfirm) return;

    const snapshot = items.slice();
    setItems((prev) => prev.filter((m) => m.id !== id));
    setTrashCount((c) => clampCount(c - 1));

    showToast({ id: `harddel-${id}`, message: ui.deleting, ttlMs: 900 });
    const ok = await hardDeleteMemory(id).catch(() => false);

    if (!ok) {
      setItems(snapshot);
      setTrashCount((c) => clampCount(c + 1));
      showToast({
        id: `harddel-fail-${id}`,
        message: ui.failedHardDelete,
        tone: "danger",
        ttlMs: 2200,
      });
      return;
    }

    await refresh("trash", { keepError: true, syncCounts: true });
    showToast(null);
  }

  async function switchScope(next: MemoryScope) {
    if (next === scope) return;

    if (isDirty) {
      const ok = confirm(ui.dirtyConfirm);
      if (!ok) return;
    }

    if (pendingRef.current.length > 0) {
      await flushAllPendingDeletes();
    }

    setScope(next);
    setQ("");
    setRow({});
    setEditingId(null);

    await refresh(next, { syncCounts: true });
    queueMicrotask(() => panelRef.current?.focus?.());
  }

  async function requestCloseWorld() {
    if (creating) return;

    if (isDirty) {
      const ok = confirm(ui.dirtyConfirm);
      if (!ok) return;
    }

    if (pendingRef.current.length > 0) {
      await flushAllPendingDeletes();
    }

    onClose();
  }

  useEffect(() => {
    if (!open) return;

    prevFocusRef.current = document.activeElement as HTMLElement | null;

    setScope("active");
    setQ("");
    setError("");
    setCreateError("");
    setCreating(false);
    setEditingId(null);
    setRow({});
    showToast(null);

    setActiveCount(0);
    setTrashCount(0);

    for (const p of pendingRef.current) window.clearTimeout(p.timer);
    pendingRef.current = [];
    setPendingCount(0);

    refresh("active", { syncCounts: true });

    queueMicrotask(() => {
      panelRef.current?.focus?.();
      newRef.current?.focus();
    });

    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = prev;
      clearToastTimer();
      queueMicrotask(() => prevFocusRef.current?.focus?.());
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    if (!editingId) return;

    const raf = requestAnimationFrame(() => {
      const panel = panelRef.current;
      if (!panel) return;
      const ta = panel.querySelector<HTMLTextAreaElement>(
        `textarea[data-mem-edit="${CSS.escape(editingId)}"]`
      );
      if (!ta) return;

      try {
        ta.scrollIntoView({ block: "nearest", inline: "nearest" });
      } catch {}

      ta.focus();
      try {
        const len = ta.value?.length ?? 0;
        ta.setSelectionRange(len, len);
      } catch {}
    });

    return () => cancelAnimationFrame(raf);
  }, [open, editingId, panelRef]);

  useEffect(() => {
    if (!open) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        requestCloseWorld();
        return;
      }

      if (e.key !== "Tab") return;

      const panel = panelRef.current;
      if (!panel) return;

      const focusables = getFocusable(panel);
      if (focusables.length === 0) {
        e.preventDefault();
        panel.focus();
        return;
      }

      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      const active = document.activeElement as HTMLElement | null;

      const isInside = active ? panel.contains(active) : false;
      if (!isInside) {
        e.preventDefault();
        first.focus();
        return;
      }

      if (e.shiftKey) {
        if (active === first) {
          e.preventDefault();
          last.focus();
        }
      } else {
        if (active === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };

    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, [open, loading, creating, pendingCount, scope, isDirty, panelRef]);

  useEffect(() => {
    if (!open) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (!isDirty) return;
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [open, isDirty]);

  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) return items;
    return items.filter((m) => (m.text || "").toLowerCase().includes(t));
  }, [items, q]);

  return {
    scope,
    setScope,
    loading,
    items,
    error,
    q,
    setQ,
    row,
    setRow,
    editingId,
    newText,
    setNewText,
    creating,
    createError,
    toast,
    setToast,
    activeCount,
    trashCount,
    pendingCount,
    isDirty,
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
  };
}

/*
このファイルの正式役割
MEMORIES モーダル内の状態管理と操作処理を担当する hook。
一覧取得、件数取得、追加、編集、削除、復元、完全削除、検索、タブ切替、閉じる処理を管理する。
表示そのものは MemoryModal.tsx と行コンポーネントへ渡し、このファイルは UI 描画本体を持たない。
*/

/*
【今回このファイルで修正したこと】
1. requestCloseWorld() が loading 中に即 return して、MEMORIES の閉じる操作まで止める処理を削除しました。
2. MEMORIES 一覧取得が一時的に戻らない場合でも、閉じる操作だけは通せるようにしました。
3. 送信、スレッド切り替え、ChatClient の loading / threadBusy、HOPY唯一の正、confirmed payload、state_changed、HOPY回答○、Compass、状態値 1..5 / 5段階、DB保存・復元には触っていません。
*/

/* /components/chat/ui/memory-modal/useMemoryModal.ts */