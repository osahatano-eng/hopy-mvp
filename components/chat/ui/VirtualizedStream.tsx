"use client";

import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import DayDivider from "./DayDivider";
import MessageRow from "./MessageRow";

type Lang = "en" | "ja";

type RenderItem =
  | { kind: "divider"; key: string; label: string }
  | { kind: "msg"; key: string; role: "user" | "assistant"; text: string };

type Props = {
  items: RenderItem[];
  uiLang: Lang;
  loading?: boolean;
  composerOffset: number;
  bottomRef: React.RefObject<HTMLDivElement>;
  overscanPx?: number; // どれくらい余分に描画するか（px）
};

const DEFAULT_MSG_H = 64;
const DEFAULT_DIV_H = 34;

function clamp(n: number, a: number, b: number) {
  return Math.max(a, Math.min(b, n));
}

function binarySearchOffsets(offsets: number[], y: number) {
  // offsets[i] = i番目の開始位置。yが入る最大のiを返す
  let lo = 0;
  let hi = offsets.length - 1;
  while (lo < hi) {
    const mid = ((lo + hi + 1) / 2) | 0;
    if (offsets[mid] <= y) lo = mid;
    else hi = mid - 1;
  }
  return lo;
}

function useRafScroll(onTick: () => void) {
  useEffect(() => {
    let raf = 0;
    const tick = () => {
      raf = 0;
      onTick();
    };
    const on = () => {
      if (raf) return;
      raf = requestAnimationFrame(tick);
    };
    window.addEventListener("scroll", on, { passive: true });
    window.addEventListener("resize", on, { passive: true });
    return () => {
      if (raf) cancelAnimationFrame(raf);
      window.removeEventListener("scroll", on);
      window.removeEventListener("resize", on);
    };
  }, [onTick]);
}

function Measure({
  id,
  onSize,
  children,
}: {
  id: string;
  onSize: (id: string, h: number) => void;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDivElement | null>(null);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;

    const push = () => {
      const h = Math.max(1, Math.ceil(el.getBoundingClientRect().height));
      onSize(id, h);
    };

    push();

    const ro = new ResizeObserver(() => push());
    ro.observe(el);

    return () => ro.disconnect();
  }, [id, onSize]);

  return <div ref={ref}>{children}</div>;
}

export default function VirtualizedStream({
  items,
  uiLang,
  loading,
  composerOffset,
  bottomRef,
  overscanPx = 900,
}: Props) {
  const wrapRef = useRef<HTMLDivElement | null>(null);

  // 実測高さ（keyごと）
  const heightsRef = useRef<Record<string, number>>({});
  const [version, setVersion] = useState(0);

  const onSize = useMemo(() => {
    return (id: string, h: number) => {
      const prev = heightsRef.current[id];
      if (prev === h) return;
      heightsRef.current[id] = h;
      // 小刻みに再計算しない（バッチ）
      setVersion((v) => v + 1);
    };
  }, []);

  // 推定/実測から offsets を作る
  const { offsets, totalH } = useMemo(() => {
    const off: number[] = new Array(items.length + 1);
    off[0] = 0;

    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      const h =
        heightsRef.current[it.key] ??
        (it.kind === "divider" ? DEFAULT_DIV_H : DEFAULT_MSG_H);
      off[i + 1] = off[i] + h;
    }
    return { offsets: off, totalH: off[items.length] };
    // version が変わるたびに再構築
  }, [items, version]);

  const [range, setRange] = useState<{ start: number; end: number }>({
    start: 0,
    end: Math.min(items.length - 1, 80),
  });

  const recompute = useMemo(() => {
    return () => {
      const wrap = wrapRef.current;
      if (!wrap) return;

      const rect = wrap.getBoundingClientRect();
      const wrapTop = window.scrollY + rect.top;
      const viewportTop = window.scrollY;
      const viewportBot = viewportTop + window.innerHeight;

      const y0 = Math.max(0, viewportTop - wrapTop - overscanPx);
      const y1 = Math.max(0, viewportBot - wrapTop + overscanPx);

      const s = clamp(binarySearchOffsets(offsets, y0), 0, Math.max(0, items.length - 1));
      const e = clamp(binarySearchOffsets(offsets, y1), 0, Math.max(0, items.length - 1));

      // 変化が小さいときはstate更新しない
      setRange((prev) => {
        if (prev.start === s && prev.end === e) return prev;
        return { start: s, end: e };
      });
    };
  }, [items.length, offsets, overscanPx]);

  // 初回 & items/version変化時
  useEffect(() => {
    recompute();
  }, [recompute, items.length, version]);

  // スクロールで更新（rAF）
  useRafScroll(recompute);

  const start = range.start;
  const end = range.end;

  const topPad = offsets[start] ?? 0;
  const bottomPad = Math.max(0, totalH - (offsets[end + 1] ?? totalH));

  const visible = items.slice(start, end + 1);

  return (
    <div ref={wrapRef}>
      {/* 上スペーサー */}
      <div aria-hidden="true" style={{ height: topPad }} />

      {/* 可視範囲だけ描画 */}
      {visible.map((it) => {
        if (it.kind === "divider") {
          return (
            <Measure key={it.key} id={it.key} onSize={onSize}>
              <DayDivider label={it.label} />
            </Measure>
          );
        }
        return (
          <Measure key={it.key} id={it.key} onSize={onSize}>
            <MessageRow role={it.role} text={it.text} uiLang={uiLang} />
          </Measure>
        );
      })}

      {/* thinking は末尾付近に出るので、バーチャライズ内に置いてOK */}
      {loading ? (
        <div style={{ textAlign: "center", fontSize: 12, color: "var(--muted)", paddingTop: 6 }}>
          Thinking<span aria-hidden="true">...</span>
        </div>
      ) : null}

      {/* 下スペーサー */}
      <div aria-hidden="true" style={{ height: bottomPad }} />

      {/* composer+keyboardぶんのスペーサー（scrollIntoViewで沈まない） */}
      <div aria-hidden="true" style={{ height: composerOffset }} />

      {/* scrollToBottom用 */}
      <div ref={bottomRef} style={{ height: 1, scrollMarginBottom: composerOffset }} />
    </div>
  );
}
