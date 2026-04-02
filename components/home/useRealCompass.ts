// /components/home/useRealCompass.ts
"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  getShortestAngleDelta,
  isReliableHeading,
  normalizeHeading,
  smoothHeading,
} from "./compassMath";

export type CompassStatus = "idle" | "requesting" | "active" | "fallback";

export type UseRealCompassResult = {
  status: CompassStatus;
  rawHeading: number | null;
  smoothedHeading: number;
  degreeText: string;
  isSupported: boolean;
  canRequestPermission: boolean;
  activateCompass: () => Promise<void>;
};

type DeviceOrientationEventWithPermission = typeof DeviceOrientationEvent & {
  requestPermission?: () => Promise<"granted" | "denied">;
};

type DeviceOrientationData = {
  alpha?: number | null;
  webkitCompassHeading?: number | null;
};

const SMOOTHING_FACTOR = 0.14;
const SENSOR_TARGET_BLEND_FACTOR = 0.28;
const MIN_TARGET_UPDATE_DELTA = 1.2;
const FALLBACK_BASE_HEADING = 18;
const FALLBACK_SWAY_AMPLITUDE = 6;
const FALLBACK_SWAY_SPEED = 0.0008;
const ORIENTATION_WAIT_TIMEOUT_MS = 1800;

function toNeedleHeading(deviceHeading: number): number {
  return normalizeHeading(360 - deviceHeading);
}

export function useRealCompass(): UseRealCompassResult {
  const [status, setStatus] = useState<CompassStatus>("idle");
  const [rawHeading, setRawHeading] = useState<number | null>(null);
  const [smoothedHeadingState, setSmoothedHeadingState] = useState<number>(0);
  const [isSupported, setIsSupported] = useState<boolean>(false);
  const [canRequestPermission, setCanRequestPermission] =
    useState<boolean>(false);

  const animationFrameRef = useRef<number | null>(null);
  const orientationTimeoutRef = useRef<number | null>(null);
  const smoothedHeadingRef = useRef<number>(0);
  const targetHeadingRef = useRef<number>(0);
  const mountedRef = useRef<boolean>(false);
  const hasReceivedHeadingRef = useRef<boolean>(false);

  const stopAnimation = useCallback(() => {
    if (animationFrameRef.current == null) return;
    window.cancelAnimationFrame(animationFrameRef.current);
    animationFrameRef.current = null;
  }, []);

  const clearOrientationTimeout = useCallback(() => {
    if (orientationTimeoutRef.current == null) return;
    window.clearTimeout(orientationTimeoutRef.current);
    orientationTimeoutRef.current = null;
  }, []);

  const animate = useCallback(() => {
    stopAnimation();

    const tick = (time: number) => {
      if (status === "fallback") {
        const sway =
          Math.sin(time * FALLBACK_SWAY_SPEED) * FALLBACK_SWAY_AMPLITUDE;
        targetHeadingRef.current = FALLBACK_BASE_HEADING + sway;
      }

      const next = smoothHeading(
        smoothedHeadingRef.current,
        targetHeadingRef.current,
        SMOOTHING_FACTOR,
      );

      smoothedHeadingRef.current = next;
      setSmoothedHeadingState(next);
      animationFrameRef.current = window.requestAnimationFrame(tick);
    };

    animationFrameRef.current = window.requestAnimationFrame(tick);
  }, [status, stopAnimation]);

  const moveToFallback = useCallback(() => {
    clearOrientationTimeout();
    hasReceivedHeadingRef.current = false;
    setStatus("fallback");
    setRawHeading(null);
    targetHeadingRef.current = FALLBACK_BASE_HEADING;
  }, [clearOrientationTimeout]);

  const applyHeading = useCallback(
    (value: number) => {
      if (!isReliableHeading(value)) return;

      clearOrientationTimeout();
      hasReceivedHeadingRef.current = true;

      const normalized = normalizeHeading(value);
      const needleHeading = toNeedleHeading(normalized);

      setRawHeading(normalized);

      if (status !== "active") {
        smoothedHeadingRef.current = needleHeading;
        setSmoothedHeadingState(needleHeading);
        targetHeadingRef.current = needleHeading;
        setStatus("active");
        return;
      }

      const delta = Math.abs(
        getShortestAngleDelta(targetHeadingRef.current, needleHeading),
      );

      if (delta < MIN_TARGET_UPDATE_DELTA) {
        return;
      }

      targetHeadingRef.current = smoothHeading(
        targetHeadingRef.current,
        needleHeading,
        SENSOR_TARGET_BLEND_FACTOR,
      );

      setStatus("active");
    },
    [clearOrientationTimeout, status],
  );

  const handleOrientation = useCallback(
    (event: Event) => {
      const data = event as DeviceOrientationEvent & DeviceOrientationData;

      if (typeof data.webkitCompassHeading === "number") {
        applyHeading(data.webkitCompassHeading);
        return;
      }

      if (typeof data.alpha === "number") {
        applyHeading(360 - data.alpha);
        return;
      }

      moveToFallback();
    },
    [applyHeading, moveToFallback],
  );

  useEffect(() => {
    mountedRef.current = true;

    const orientationSupported =
      typeof window !== "undefined" && "DeviceOrientationEvent" in window;

    setIsSupported(orientationSupported);

    if (!orientationSupported) {
      setCanRequestPermission(false);
      targetHeadingRef.current = 0;
      return () => {
        mountedRef.current = false;
        clearOrientationTimeout();
        stopAnimation();
      };
    }

    const eventCtor =
      window.DeviceOrientationEvent as DeviceOrientationEventWithPermission;

    setCanRequestPermission(typeof eventCtor.requestPermission === "function");

    return () => {
      mountedRef.current = false;
      clearOrientationTimeout();
      window.removeEventListener(
        "deviceorientation",
        handleOrientation as EventListener,
      );
      stopAnimation();
    };
  }, [clearOrientationTimeout, handleOrientation, stopAnimation]);

  useEffect(() => {
    animate();
    return () => {
      stopAnimation();
    };
  }, [animate, stopAnimation]);

  const subscribeOrientation = useCallback(() => {
    hasReceivedHeadingRef.current = false;

    window.removeEventListener(
      "deviceorientation",
      handleOrientation as EventListener,
    );
    window.addEventListener(
      "deviceorientation",
      handleOrientation as EventListener,
      true,
    );

    clearOrientationTimeout();
    orientationTimeoutRef.current = window.setTimeout(() => {
      if (!mountedRef.current) return;
      if (hasReceivedHeadingRef.current) return;
      moveToFallback();
    }, ORIENTATION_WAIT_TIMEOUT_MS);
  }, [clearOrientationTimeout, handleOrientation, moveToFallback]);

  const activateCompass = useCallback(async () => {
    if (typeof window === "undefined") return;
    if (!mountedRef.current) return;
    if (!isSupported) {
      moveToFallback();
      return;
    }

    const eventCtor =
      window.DeviceOrientationEvent as DeviceOrientationEventWithPermission;

    try {
      setStatus("requesting");

      if (typeof eventCtor.requestPermission === "function") {
        const permission = await eventCtor.requestPermission();

        if (permission !== "granted") {
          moveToFallback();
          return;
        }
      }

      subscribeOrientation();
    } catch {
      moveToFallback();
    }
  }, [isSupported, moveToFallback, subscribeOrientation]);

  const degreeText = useMemo(() => {
    if (status !== "active" || rawHeading == null) return "";
    return `${Math.round(rawHeading)}°`;
  }, [rawHeading, status]);

  return {
    status,
    rawHeading,
    smoothedHeading: smoothedHeadingState,
    degreeText,
    isSupported,
    canRequestPermission,
    activateCompass,
  };
}