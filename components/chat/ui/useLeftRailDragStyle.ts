// /components/chat/ui/useLeftRailDragStyle.ts
"use client";

import React from "react";

type Params = {
  railOpen: boolean;
  enabled: boolean;
  panelWidthPx?: number;
};

type TouchPoint = {
  x: number;
  y: number;
};

const DEFAULT_PANEL_WIDTH_PX = 320;
const DRAG_START_EDGE_PX = 96;
const DRAG_CLOSE_THRESHOLD_RATIO = 0.35;
const VERTICAL_GUARD_PX = 32;

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export function useLeftRailDragStyle({
  railOpen,
  enabled,
  panelWidthPx = DEFAULT_PANEL_WIDTH_PX,
}: Params) {
  const [dragOffsetPx, setDragOffsetPx] = React.useState<number | null>(null);

  const openStartRef = React.useRef<TouchPoint | null>(null);
  const closeStartRef = React.useRef<TouchPoint | null>(null);
  const draggingModeRef = React.useRef<"opening" | "closing" | null>(null);

  const resetDrag = React.useCallback(() => {
    openStartRef.current = null;
    closeStartRef.current = null;
    draggingModeRef.current = null;
    setDragOffsetPx(null);
  }, []);

  const handleOpenTouchStart = React.useCallback(
    (e: React.TouchEvent<HTMLElement>) => {
      if (!enabled || railOpen) {
        openStartRef.current = null;
        draggingModeRef.current = null;
        return;
      }

      const touch = e.touches[0];
      if (!touch) return;

      if (touch.clientX > DRAG_START_EDGE_PX) {
        openStartRef.current = null;
        draggingModeRef.current = null;
        return;
      }

      openStartRef.current = {
        x: touch.clientX,
        y: touch.clientY,
      };
      draggingModeRef.current = "opening";
      setDragOffsetPx(-panelWidthPx);
    },
    [enabled, railOpen, panelWidthPx]
  );

  const handleOpenTouchMove = React.useCallback(
    (e: React.TouchEvent<HTMLElement>) => {
      if (!enabled || railOpen) return;
      if (draggingModeRef.current !== "opening") return;

      const start = openStartRef.current;
      const touch = e.touches[0];
      if (!start || !touch) return;

      const deltaX = touch.clientX - start.x;
      const deltaY = touch.clientY - start.y;

      if (Math.abs(deltaY) > VERTICAL_GUARD_PX && Math.abs(deltaY) > Math.abs(deltaX)) {
        resetDrag();
        return;
      }

      const nextOffset = clamp(-panelWidthPx + deltaX, -panelWidthPx, 0);
      setDragOffsetPx(nextOffset);
    },
    [enabled, railOpen, panelWidthPx, resetDrag]
  );

  const handleOpenTouchEnd = React.useCallback(() => {
    if (draggingModeRef.current !== "opening") return;
    resetDrag();
  }, [resetDrag]);

  const handleCloseTouchStart = React.useCallback(
    (e: React.TouchEvent<HTMLElement>) => {
      if (!enabled || !railOpen) {
        closeStartRef.current = null;
        draggingModeRef.current = null;
        return;
      }

      const touch = e.touches[0];
      if (!touch) return;

      closeStartRef.current = {
        x: touch.clientX,
        y: touch.clientY,
      };
      draggingModeRef.current = "closing";
      setDragOffsetPx(0);
    },
    [enabled, railOpen]
  );

  const handleCloseTouchMove = React.useCallback(
    (e: React.TouchEvent<HTMLElement>) => {
      if (!enabled || !railOpen) return;
      if (draggingModeRef.current !== "closing") return;

      const start = closeStartRef.current;
      const touch = e.touches[0];
      if (!start || !touch) return;

      const deltaX = touch.clientX - start.x;
      const deltaY = touch.clientY - start.y;

      if (Math.abs(deltaY) > VERTICAL_GUARD_PX && Math.abs(deltaY) > Math.abs(deltaX)) {
        resetDrag();
        return;
      }

      const nextOffset = clamp(deltaX, -panelWidthPx, 0);
      setDragOffsetPx(nextOffset);
    },
    [enabled, railOpen, panelWidthPx, resetDrag]
  );

  const handleCloseTouchEnd = React.useCallback(
    (onCloseRail?: () => void) => {
      if (draggingModeRef.current !== "closing") {
        resetDrag();
        return;
      }

      const currentOffset = dragOffsetPx ?? 0;
      const shouldClose = Math.abs(currentOffset) >= panelWidthPx * DRAG_CLOSE_THRESHOLD_RATIO;

      resetDrag();

      if (shouldClose && onCloseRail) {
        onCloseRail();
      }
    },
    [dragOffsetPx, panelWidthPx, resetDrag]
  );

  const railStyle = React.useMemo<React.CSSProperties>(() => {
    const offsetPx = railOpen ? dragOffsetPx ?? 0 : dragOffsetPx ?? -panelWidthPx;
    const visibleRatio = 1 - Math.abs(offsetPx) / panelWidthPx;
    const opacity = clamp(visibleRatio, 0, 1);

    return {
      transform: `translateX(${offsetPx}px)`,
      transition: dragOffsetPx === null ? "transform 220ms ease" : "none",
      willChange: "transform",
      opacity,
    };
  }, [dragOffsetPx, railOpen, panelWidthPx]);

  const backdropStyle = React.useMemo<React.CSSProperties>(() => {
    const offsetPx = railOpen ? dragOffsetPx ?? 0 : dragOffsetPx ?? -panelWidthPx;
    const visibleRatio = 1 - Math.abs(offsetPx) / panelWidthPx;
    const opacity = clamp(visibleRatio * 0.32, 0, 0.32);

    return {
      opacity,
      transition: dragOffsetPx === null ? "opacity 220ms ease" : "none",
      willChange: "opacity",
    };
  }, [dragOffsetPx, railOpen, panelWidthPx]);

  return {
    railStyle,
    backdropStyle,
    isDragging: dragOffsetPx !== null,
    handleOpenTouchStart,
    handleOpenTouchMove,
    handleOpenTouchEnd,
    handleCloseTouchStart,
    handleCloseTouchMove,
    handleCloseTouchEnd,
    resetDrag,
  };
}