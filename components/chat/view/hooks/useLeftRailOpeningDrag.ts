// /components/chat/view/hooks/useLeftRailOpeningDrag.ts
"use client";

import React from "react";

const LEFT_RAIL_WIDTH_PX = 288;
const DRAG_START_EDGE_PX = 36;
const SWIPE_OPEN_THRESHOLD_PX = 36;
const VERTICAL_GUARD_PX = 28;
const MAX_BACKDROP_OPACITY = 0.24;
const BACKDROP_START_RATIO = 0.08;
const BACKDROP_EASE_IN_RATIO = 1.2;

type TouchPoint = {
  x: number;
  y: number;
};

type Params = {
  railOpen: boolean;
  enabled: boolean;
  panelWidthPx?: number;
};

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export function useLeftRailOpeningDrag({
  railOpen,
  enabled,
  panelWidthPx = LEFT_RAIL_WIDTH_PX,
}: Params) {
  const [dragOffsetPx, setDragOffsetPx] = React.useState<number | null>(null);

  const touchStartRef = React.useRef<TouchPoint | null>(null);
  const draggingRef = React.useRef(false);

  const resetOpeningDrag = React.useCallback(() => {
    touchStartRef.current = null;
    draggingRef.current = false;
    setDragOffsetPx(null);
  }, []);

  const handleOpeningDragTouchStart = React.useCallback(
    (e: React.TouchEvent<HTMLElement>) => {
      if (!enabled || railOpen) {
        resetOpeningDrag();
        return;
      }

      const touch = e.touches[0];
      if (!touch) return;

      if (touch.clientX > DRAG_START_EDGE_PX) {
        resetOpeningDrag();
        return;
      }

      touchStartRef.current = {
        x: touch.clientX,
        y: touch.clientY,
      };
      draggingRef.current = true;
      setDragOffsetPx(-panelWidthPx);
    },
    [enabled, railOpen, panelWidthPx, resetOpeningDrag]
  );

  const handleOpeningDragTouchMove = React.useCallback(
    (e: React.TouchEvent<HTMLElement>) => {
      if (!enabled || railOpen) return;
      if (!draggingRef.current) return;

      const start = touchStartRef.current;
      const touch = e.touches[0];
      if (!start || !touch) return;

      const deltaX = touch.clientX - start.x;
      const deltaY = touch.clientY - start.y;

      if (Math.abs(deltaY) > VERTICAL_GUARD_PX && Math.abs(deltaY) > Math.abs(deltaX)) {
        resetOpeningDrag();
        return;
      }

      if (deltaX > 0 && Math.abs(deltaX) > Math.abs(deltaY)) {
        try {
          e.preventDefault();
        } catch {}
      }

      const nextOffset = clamp(-panelWidthPx + deltaX, -panelWidthPx, 0);
      setDragOffsetPx(nextOffset);
    },
    [enabled, railOpen, panelWidthPx, resetOpeningDrag]
  );

  const handleOpeningDragTouchEnd = React.useCallback(() => {
    resetOpeningDrag();
  }, [resetOpeningDrag]);

  const shouldOpenByDrag = React.useMemo(() => {
    if (dragOffsetPx === null) return false;
    return Math.abs(dragOffsetPx) <= panelWidthPx - SWIPE_OPEN_THRESHOLD_PX;
  }, [dragOffsetPx, panelWidthPx]);

  const openingRailStyle = React.useMemo<React.CSSProperties>(() => {
    if (dragOffsetPx === null) return {};

    return {
      transform: `translateX(${dragOffsetPx}px)`,
      transition: "none",
      willChange: "transform",
    };
  }, [dragOffsetPx]);

  const openingBackdropStyle = React.useMemo<React.CSSProperties>(() => {
    if (dragOffsetPx === null) return {};

    const visibleRatio = clamp(1 - Math.abs(dragOffsetPx) / panelWidthPx, 0, 1);
    const normalizedRatio = clamp(
      (visibleRatio - BACKDROP_START_RATIO) / (1 - BACKDROP_START_RATIO),
      0,
      1
    );
    const easedRatio = Math.pow(normalizedRatio, BACKDROP_EASE_IN_RATIO);
    const opacity = clamp(easedRatio * MAX_BACKDROP_OPACITY, 0, MAX_BACKDROP_OPACITY);

    return {
      opacity,
      transition: "none",
      willChange: "opacity",
      pointerEvents: "none",
    };
  }, [dragOffsetPx, panelWidthPx]);

  return {
    isLeftRailOpeningDrag: dragOffsetPx !== null,
    shouldOpenByDrag,
    leftRailOpeningStyle: openingRailStyle,
    leftRailOpeningBackdropStyle: openingBackdropStyle,
    handleOpeningDragTouchStart,
    handleOpeningDragTouchMove,
    handleOpeningDragTouchEnd,
    resetOpeningDrag,
  };
}