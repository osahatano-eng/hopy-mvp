"use client";

import { useEffect, useRef } from "react";

function isTouchDevice() {
  if (typeof window === "undefined") return false;
  return (
    "ontouchstart" in window ||
    navigator.maxTouchPoints > 0 ||
    window.matchMedia?.("(pointer: coarse)")?.matches
  );
}

export default function CursorGlow() {
  const dotRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (isTouchDevice()) return; // スマホは標準カーソル/UIでOK

    const dot = dotRef.current;
    if (!dot) return;

    let raf = 0;
    let x = -100,
      y = -100;
    let tx = -100,
      ty = -100;

    const setVars = (cx: number, cy: number) => {
      const mx = `${(cx / window.innerWidth) * 100}%`;
      const my = `${(cy / window.innerHeight) * 100}%`;
      document.body.style.setProperty("--mx", mx);
      document.body.style.setProperty("--my", my);
    };

    const tick = () => {
      raf = 0;
      x += (tx - x) * 0.14;
      y += (ty - y) * 0.14;
      dot.style.transform = `translate3d(${x}px, ${y}px, 0)`;
      setVars(x, y);
    };

    const onMove = (e: MouseEvent) => {
      tx = e.clientX;
      ty = e.clientY;
      if (!raf) raf = requestAnimationFrame(tick);
    };

    window.addEventListener("mousemove", onMove, { passive: true });

    // 初期位置
    setVars(window.innerWidth * 0.5, window.innerHeight * 0.3);

    return () => {
      window.removeEventListener("mousemove", onMove);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  // タッチ端末は何も描画しない
  if (typeof window !== "undefined" && isTouchDevice()) return null;

  return (
    <>
      <div className="cursor-dot" ref={dotRef} aria-hidden />
      <div className="cursor-ring" aria-hidden />
    </>
  );
}
