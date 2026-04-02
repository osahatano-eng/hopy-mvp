// /components/chat/view/hooks/useRailOpen.ts
"use client";

import { useCallback, useEffect, useRef, useState } from "react";

function readRailOpenNow(): boolean {
  if (typeof window === "undefined") return false;

  try {
    const v = String(window.localStorage.getItem("hopy_rail_open") ?? "").trim().toLowerCase();
    return v === "1" || v === "true";
  } catch {
    return false;
  }
}

export function useRailOpen(args: { loggedIn: boolean }) {
  const { loggedIn } = args;

  const [railOpenState, setRailOpenState] = useState<boolean>(() => readRailOpenNow());

  const didHydrateRef = useRef(false);
  const userTouchedRef = useRef(false);
  const lastPersistedRef = useRef<boolean | null>(null);

  const setRailOpen = useCallback((next: boolean | ((prev: boolean) => boolean)) => {
    userTouchedRef.current = true;

    setRailOpenState((prev) => {
      const resolved = typeof next === "function" ? (next as (prev: boolean) => boolean)(prev) : next;
      const normalized = Boolean(resolved);
      return prev === normalized ? prev : normalized;
    });
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!loggedIn) return;

    if (userTouchedRef.current) {
      didHydrateRef.current = true;
      return;
    }

    if (didHydrateRef.current) return;
    didHydrateRef.current = true;

    try {
      const next = readRailOpenNow();
      setRailOpenState((prev) => (prev === next ? prev : next));
    } catch {
      setRailOpenState((prev) => (prev === false ? prev : false));
    }
  }, [loggedIn]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!loggedIn) return;

    if (lastPersistedRef.current === railOpenState) return;
    lastPersistedRef.current = railOpenState;

    try {
      window.localStorage.setItem("hopy_rail_open", railOpenState ? "1" : "0");
    } catch {}
  }, [loggedIn, railOpenState]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!loggedIn) return;

    const onToggle = () => {
      userTouchedRef.current = true;
      setRailOpenState((prev) => !prev);
    };

    try {
      window.addEventListener("hopy:toggle-left-rail", onToggle as any);
    } catch {}

    return () => {
      try {
        window.removeEventListener("hopy:toggle-left-rail", onToggle as any);
      } catch {}
    };
  }, [loggedIn]);

  return { railOpen: railOpenState, setRailOpen };
}