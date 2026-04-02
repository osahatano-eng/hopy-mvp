// /components/chat/view/hooks/useLeftRailSwipeOpen.ts
"use client";

import React from "react";

const SP_MAX_WIDTH_PX = 768;
const SWIPE_OPEN_START_EDGE_PX = 36;
const SWIPE_OPEN_THRESHOLD_PX = 36;
const SWIPE_VERTICAL_TOLERANCE_PX = 20;
const LEFT_RAIL_WIDTH_PX = 288;
const SWIPE_OPEN_MAX_BACKDROP_OPACITY = 0.32;

type Params = {
  railOpen: boolean;
  onOpenRail: () => void;
};

type TouchPoint = {
  x: number;
  y: number;
};

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export function useLeftRailSwipeOpen({ railOpen, onOpenRail }: Params) {
  const [isSpViewport, setIsSpViewport] = React.useState(false);
  const [openingDragOffsetPx, setOpeningDragOffsetPx] = React.useState<number | null>(null);

  const touchStartRef = React.useRef<TouchPoint | null>(null);
  const draggingRef = React.useRef(false);

  React.useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return;

    const media = window.matchMedia(`(max-width: ${SP_MAX_WIDTH_PX}px)`);

    const update = () => {
      setIsSpViewport(media.matches);
    };

    update();

    if (typeof media.addEventListener === "function") {
      media.addEventListener("change", update);
      return () => media.removeEventListener("change", update);
    }

    media.addListener(update);
    return () => media.removeListener(update);
  }, []);

  const resetOpeningDrag = React.useCallback(() => {
    touchStartRef.current = null;
    draggingRef.current = false;
    setOpeningDragOffsetPx(null);
  }, []);

  const handleTouchStart = React.useCallback(
    (e: React.TouchEvent<HTMLElement>) => {
      if (!isSpViewport || railOpen) {
        resetOpeningDrag();
        return;
      }

      const touch = e.touches[0];
      if (!touch) return;

      if (touch.clientX > SWIPE_OPEN_START_EDGE_PX) {
        resetOpeningDrag();
        return;
      }

      touchStartRef.current = {
        x: touch.clientX,
        y: touch.clientY,
      };
      draggingRef.current = true;
      setOpeningDragOffsetPx(-LEFT_RAIL_WIDTH_PX);
    },
    [isSpViewport, railOpen, resetOpeningDrag]
  );

  const handleTouchMove = React.useCallback(
    (e: React.TouchEvent<HTMLElement>) => {
      if (!isSpViewport || railOpen) return;
      if (!draggingRef.current) return;

      const start = touchStartRef.current;
      const touch = e.touches[0];
      if (!start || !touch) return;

      const deltaX = touch.clientX - start.x;
      const deltaY = touch.clientY - start.y;

      if (Math.abs(deltaY) > SWIPE_VERTICAL_TOLERANCE_PX && Math.abs(deltaY) > Math.abs(deltaX)) {
        resetOpeningDrag();
        return;
      }

      const nextOffset = clamp(-LEFT_RAIL_WIDTH_PX + deltaX, -LEFT_RAIL_WIDTH_PX, 0);
      setOpeningDragOffsetPx(nextOffset);
    },
    [isSpViewport, railOpen, resetOpeningDrag]
  );

  const handleTouchEnd = React.useCallback(
    (e: React.TouchEvent<HTMLElement>) => {
      if (!isSpViewport || railOpen) {
        resetOpeningDrag();
        return;
      }

      const start = touchStartRef.current;
      const currentOffset = openingDragOffsetPx;
      const touch = e.changedTouches[0];

      touchStartRef.current = null;
      draggingRef.current = false;
      setOpeningDragOffsetPx(null);

      if (!start || !touch) return;

      const deltaX = touch.clientX - start.x;
      const deltaY = touch.clientY - start.y;

      const draggedEnough =
        currentOffset !== null && Math.abs(currentOffset) <= LEFT_RAIL_WIDTH_PX - SWIPE_OPEN_THRESHOLD_PX;

      const isRightSwipe =
        (deltaX >= SWIPE_OPEN_THRESHOLD_PX || draggedEnough) &&
        Math.abs(deltaY) <= SWIPE_VERTICAL_TOLERANCE_PX &&
        Math.abs(deltaX) > Math.abs(deltaY);

      if (!isRightSwipe) return;
      onOpenRail();
    },
    [isSpViewport, railOpen, openingDragOffsetPx, onOpenRail, resetOpeningDrag]
  );

  const openingRailStyle = React.useMemo<React.CSSProperties>(() => {
    if (openingDragOffsetPx === null) {
      return {};
    }

    return {
      transform: `translateX(${openingDragOffsetPx}px)`,
      transition: "none",
      willChange: "transform",
    };
  }, [openingDragOffsetPx]);

  const openingBackdropStyle = React.useMemo<React.CSSProperties>(() => {
    if (openingDragOffsetPx === null) {
      return {};
    }

    const visibleRatio = 1 - Math.abs(openingDragOffsetPx) / LEFT_RAIL_WIDTH_PX;
    const opacity = clamp(visibleRatio * SWIPE_OPEN_MAX_BACKDROP_OPACITY, 0, SWIPE_OPEN_MAX_BACKDROP_OPACITY);

    return {
      opacity,
      transition: "none",
      willChange: "opacity",
    };
  }, [openingDragOffsetPx]);

  return {
    handleLeftRailSwipeOpenTouchStart: handleTouchStart,
    handleLeftRailSwipeOpenTouchMove: handleTouchMove,
    handleLeftRailSwipeOpenTouchEnd: handleTouchEnd,
    isLeftRailOpeningDrag: openingDragOffsetPx !== null,
    leftRailOpeningStyle: openingRailStyle,
    leftRailOpeningBackdropStyle: openingBackdropStyle,
    resetLeftRailSwipeOpenDrag: resetOpeningDrag,
  };
}