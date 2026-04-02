// /components/chat/ui/StateBadge.tsx
"use client";

import React, { useEffect, useId, useMemo, useRef, useState } from "react";
import styles from "./StateBadge.module.css";
import type { HopyPhaseValue } from "../lib/chatTypes";
import type { HopyState } from "../lib/stateBadge";
import { buildStateBadge, normalizeHopyState } from "../lib/stateBadge";

type Props = {
  state: HopyState;
  uiLang: "ja" | "en";
  ui: {
    stateTitle: string;
    stateUnknownShort: string;
    statePhase1?: string;
    statePhase2?: string;
    statePhase3?: string;
    statePhase4?: string;
    statePhase5?: string;
    statePhase0?: string;
  };
  err?: string | null;
  className?: string;
};

function joinClass(...xs: Array<string | undefined | null | false>) {
  return xs.filter(Boolean).join(" ");
}

function safePhase1to5(v: unknown): HopyPhaseValue | null {
  const n = Number(v);
  if (!Number.isFinite(n)) return null;
  const i = Math.round(n);
  if (i < 1 || i > 5) return null;
  if (i === 1) return 1;
  if (i === 2) return 2;
  if (i === 3) return 3;
  if (i === 4) return 4;
  return 5;
}

function resolvedPhaseFromState(state: HopyState): HopyPhaseValue | null {
  const normalized = normalizeHopyState(state);
  if (!normalized) return null;

  return (
    safePhase1to5(normalized.state_level) ??
    safePhase1to5(normalized.current_phase) ??
    null
  );
}

function phaseClassFromState(state: HopyState, err?: string | null) {
  if (err || !state) return styles.pending;

  const p = resolvedPhaseFromState(state);
  if (p == null) return styles.pending;
  if (p === 1) return styles.phase0;
  if (p === 2) return styles.phase1;
  if (p === 3) return styles.phase2;
  if (p === 4) return styles.phase3;
  return styles.phase4;
}

function isTouchDevice() {
  if (typeof window === "undefined") return false;
  return (
    "ontouchstart" in window ||
    (navigator as any)?.maxTouchPoints > 0 ||
    window.matchMedia?.("(hover: none)").matches
  );
}

function isProbablyCssColor(x: string) {
  try {
    const s = String(x ?? "").trim();
    if (!s) return false;

    if (s.startsWith("#")) return true;
    if (/^rgba?\(/i.test(s)) return true;
    if (/^hsla?\(/i.test(s)) return true;
    if (/^var\(--/i.test(s)) return true;
    if (/^[a-zA-Z]+$/.test(s)) return true;

    return false;
  } catch {
    return false;
  }
}

function normalizeStateKey(x: string): string {
  return String(x ?? "")
    .trim()
    .toLowerCase()
    .replace(/^--/, "")
    .replace(/^var\(/, "")
    .replace(/\)$/, "")
    .replace(/^state[_-]?/, "")
    .replace(/[_\s]+/g, "-")
    .replace(/-+/g, "-")
    .trim();
}

function extractSemanticLabelFromBadgeLabel(label: string): string {
  const raw = String(label ?? "").trim();
  if (!raw) return "";

  return raw.replace(/^状態\s*:\s*/i, "").replace(/^state\s*:\s*/i, "").trim();
}

function phaseToSemanticKey(
  phaseLike: unknown
): "noise" | "explore" | "organize" | "converge" | "decide" | null {
  const p = safePhase1to5(phaseLike);

  if (p === 1) return "noise";
  if (p === 2) return "explore";
  if (p === 3) return "organize";
  if (p === 4) return "converge";
  if (p === 5) return "decide";
  return null;
}

function semanticKeyToDotVar(x: "noise" | "explore" | "organize" | "converge" | "decide"): string {
  return `var(--state-${x}-dot)`;
}

function stateSemanticToDotVar(x: string): string | undefined {
  const s = normalizeStateKey(x);

  if (s === "noise" || s === "混線") return "var(--state-noise-dot)";
  if (s === "explore" || s === "模索") return "var(--state-explore-dot)";
  if (s === "organize" || s === "整理") return "var(--state-organize-dot)";
  if (s === "converge" || s === "収束") return "var(--state-converge-dot)";
  if (s === "decide" || s === "決定") return "var(--state-decide-dot)";

  if (s === "s1") return "var(--state-noise-dot)";
  if (s === "s2") return "var(--state-explore-dot)";
  if (s === "s3") return "var(--state-organize-dot)";
  if (s === "s4") return "var(--state-converge-dot)";
  if (s === "s5") return "var(--state-decide-dot)";

  if (s === "chaos" || s === "noisy") return "var(--state-noise-dot)";
  if (s === "search" || s === "searching" || s === "discovery") return "var(--state-explore-dot)";
  if (s === "structure" || s === "structured" || s === "sorting") return "var(--state-organize-dot)";
  if (s === "focus" || s === "focusing" || s === "narrowing") return "var(--state-converge-dot)";
  if (s === "decision" || s === "decided" || s === "final") return "var(--state-decide-dot)";

  return undefined;
}

function stateTokenToDotVar(token: string): string | undefined {
  try {
    const raw = String(token ?? "").trim();
    if (!raw) return undefined;

    const semantic = stateSemanticToDotVar(raw);
    if (semantic) return semantic;

    const s = normalizeStateKey(raw);

    if (s === "noise" || s === "explore" || s === "organize" || s === "converge" || s === "decide") {
      return `var(--state-${s}-dot)`;
    }

    if (/^(noise|explore|organize|converge|decide)-dot$/.test(s)) {
      return `var(--state-${s})`;
    }

    if (/^(noise|explore|organize|converge|decide)-(text|border|bg|soft-bg)$/.test(s)) {
      return `var(--state-${s})`;
    }

    return undefined;
  } catch {
    return undefined;
  }
}

function normalizeColorTokenToCssVar(token: string): string | undefined {
  try {
    const s = String(token ?? "").trim();
    if (!s) return undefined;

    const asStateVar = stateTokenToDotVar(s);
    if (asStateVar) return asStateVar;

    if (/^var\(--[a-zA-Z0-9_-]+\)$/i.test(s)) return s;

    if (s.startsWith("--")) return `var(${s})`;

    if (/^[a-zA-Z0-9_-]+$/.test(s)) return `var(--${s})`;

    return undefined;
  } catch {
    return undefined;
  }
}

function pickStateColorLike(state: HopyState): string | undefined {
  try {
    const normalized = normalizeHopyState(state);
    if (!normalized) return undefined;

    const s: any = normalized as any;

    const candidates = [
      s?.color_token,
      s?.colorToken,
      s?.state_color_token,
      s?.stateColorToken,

      s?.state_dot_token,
      s?.stateDotToken,
      s?.dot_color_token,
      s?.dotColorToken,

      s?.state_color,
      s?.stateColor,
      s?.badge_color,
      s?.badgeColor,
      s?.dot_color,
      s?.dotColor,
      s?.color,
      s?.bg,
      s?.background,

      s?.code,
      s?.state_code,
      s?.stateCode,
      s?.key,
      s?.name,
      s?.label,
      s?.label_ja,
      s?.labelJa,
      s?.label_en,
      s?.labelEn,
    ]
      .map((v) => (v == null ? "" : String(v).trim()))
      .filter(Boolean);

    for (const c of candidates) {
      const semantic = stateSemanticToDotVar(c);
      if (semantic) return semantic;

      if (isProbablyCssColor(c)) return c;

      const asVar = normalizeColorTokenToCssVar(c);
      if (asVar) return asVar;
    }

    return undefined;
  } catch {
    return undefined;
  }
}

function fallbackDotColorFromLabel(args: {
  label: string;
  uiLang: "ja" | "en";
  ui: Props["ui"];
  state: HopyState;
}): string | undefined {
  const { label, ui, state } = args;

  const txt = String(label ?? "").trim();
  const semanticLabel = extractSemanticLabelFromBadgeLabel(txt);

  if (semanticLabel) {
    const byLabel = stateSemanticToDotVar(semanticLabel);
    if (byLabel) return byLabel;
  }

  const aliases: Array<[string, string]> = [
    [String(ui.statePhase1 ?? "").trim(), "var(--state-noise-dot)"],
    [String(ui.statePhase2 ?? "").trim(), "var(--state-explore-dot)"],
    [String(ui.statePhase3 ?? "").trim(), "var(--state-organize-dot)"],
    [String(ui.statePhase4 ?? "").trim(), "var(--state-converge-dot)"],
    [String(ui.statePhase5 ?? "").trim(), "var(--state-decide-dot)"],

    ["Noise", "var(--state-noise-dot)"],
    ["Explore", "var(--state-explore-dot)"],
    ["Organize", "var(--state-organize-dot)"],
    ["Converge", "var(--state-converge-dot)"],
    ["Decide", "var(--state-decide-dot)"],

    ["混線", "var(--state-noise-dot)"],
    ["模索", "var(--state-explore-dot)"],
    ["整理", "var(--state-organize-dot)"],
    ["収束", "var(--state-converge-dot)"],
    ["決定", "var(--state-decide-dot)"],
  ];

  for (const [name, color] of aliases) {
    if (name && semanticLabel === name) return color;
  }

  const semanticKey = phaseToSemanticKey(resolvedPhaseFromState(state));
  if (!semanticKey) return undefined;
  return semanticKeyToDotVar(semanticKey);
}

function dotColorFromState(args: {
  state: HopyState;
  err?: string | null;
  label: string;
  uiLang: "ja" | "en";
  ui: Props["ui"];
}): string | undefined {
  const { state, err, label, uiLang, ui } = args;

  if (err || !state) return undefined;

  const phase = resolvedPhaseFromState(state);
  if (phase == null) return undefined;

  const direct = pickStateColorLike(state);
  if (direct) return direct;

  return fallbackDotColorFromLabel({ label, uiLang, ui, state });
}

function isCompactBadge(className?: string): boolean {
  const s = String(className ?? "").trim();
  if (!s) return false;
  return s.split(/\s+/).includes(styles.compact);
}

function compactLabelFromState(args: {
  state: HopyState;
  uiLang: "ja" | "en";
  ui: Props["ui"];
  fallbackLabel: string;
  err?: string | null;
}): string {
  const { state, uiLang, ui, fallbackLabel, err } = args;

  if (err || !state) {
    return String(fallbackLabel ?? "").trim() || String(ui.stateUnknownShort ?? "").trim();
  }

  const phase = resolvedPhaseFromState(state);
  if (phase != null) {
    if (uiLang === "ja") {
      if (phase === 1) return "混線";
      if (phase === 2) return "模索";
      if (phase === 3) return "整理";
      if (phase === 4) return "収束";
      return "決定";
    }

    if (phase === 1) return "Noise";
    if (phase === 2) return "Explore";
    if (phase === 3) return "Organize";
    if (phase === 4) return "Converge";
    return "Decide";
  }

  return String(ui.stateUnknownShort ?? "").trim() || String(fallbackLabel ?? "").trim();
}

const COMPACT_PHASE1_HOLD_MS = 220;

function useDisplayedState(params: {
  normalizedState: HopyState;
  compact: boolean;
  err?: string | null;
}) {
  const { normalizedState, compact, err } = params;

  const currentPhase = useMemo(() => resolvedPhaseFromState(normalizedState), [normalizedState]);
  const [displayedState, setDisplayedState] = useState<HopyState>(normalizedState);
  const holdTimerRef = useRef<number | null>(null);
  const lastStableNonPhase1Ref = useRef<HopyState>(normalizedState);

  useEffect(() => {
    const phase = resolvedPhaseFromState(normalizedState);

    if (!err && phase != null && phase !== 1) {
      lastStableNonPhase1Ref.current = normalizedState;
    }
  }, [normalizedState, err]);

  useEffect(() => {
    if (holdTimerRef.current != null) {
      try {
        window.clearTimeout(holdTimerRef.current);
      } catch {}
      holdTimerRef.current = null;
    }

    if (err) {
      setDisplayedState(normalizedState);
      return;
    }

    if (!compact) {
      setDisplayedState(normalizedState);
      return;
    }

    if (currentPhase !== 1) {
      setDisplayedState(normalizedState);
      return;
    }

    const fallback = lastStableNonPhase1Ref.current;
    const fallbackPhase = resolvedPhaseFromState(fallback);

    if (fallback && fallbackPhase != null && fallbackPhase !== 1) {
      setDisplayedState(fallback);

      try {
        holdTimerRef.current = window.setTimeout(() => {
          setDisplayedState(normalizedState);
          holdTimerRef.current = null;
        }, COMPACT_PHASE1_HOLD_MS);
        return;
      } catch {}
    }

    setDisplayedState(normalizedState);

    return () => {
      if (holdTimerRef.current != null) {
        try {
          window.clearTimeout(holdTimerRef.current);
        } catch {}
        holdTimerRef.current = null;
      }
    };
  }, [normalizedState, compact, err, currentPhase]);

  useEffect(() => {
    return () => {
      if (holdTimerRef.current != null) {
        try {
          window.clearTimeout(holdTimerRef.current);
        } catch {}
        holdTimerRef.current = null;
      }
    };
  }, []);

  return displayedState;
}

export default function StateBadge(props: Props) {
  const { state, uiLang, ui, err, className } = props;

  const normalizedState = useMemo(() => normalizeHopyState(state), [state]);

  const normalizedUi = useMemo(
    () => ({
      stateTitle: ui.stateTitle,
      stateUnknownShort: ui.stateUnknownShort,
      statePhase1: ui.statePhase1,
      statePhase2: ui.statePhase2,
      statePhase3: ui.statePhase3,
      statePhase4: ui.statePhase4,
      statePhase5: ui.statePhase5,
    }),
    [
      ui.stateTitle,
      ui.stateUnknownShort,
      ui.statePhase1,
      ui.statePhase2,
      ui.statePhase3,
      ui.statePhase4,
      ui.statePhase5,
    ]
  );

  const compact = useMemo(() => isCompactBadge(className), [className]);
  const displayedState = useDisplayedState({
    normalizedState,
    compact,
    err,
  });

  const rawBadge = useMemo(
    () => buildStateBadge({ state: displayedState, uiLang, ui: normalizedUi as any, err }),
    [displayedState, uiLang, normalizedUi, err]
  );

  const phase = useMemo(() => resolvedPhaseFromState(displayedState), [displayedState]);

  const badge = useMemo(() => {
    if (err) return rawBadge;
    if (!displayedState) return rawBadge;

    if (phase != null) {
      const label = compactLabelFromState({
        state: displayedState,
        uiLang,
        ui: normalizedUi,
        fallbackLabel: rawBadge.label,
        err,
      });

      return {
        ...rawBadge,
        label,
        titleText: uiLang === "ja" ? `状態: ${label}` : `State: ${label}`,
      };
    }

    const unknownShort =
      String(normalizedUi.stateUnknownShort ?? "").trim() || (uiLang === "ja" ? "不明" : "Unknown");

    return {
      ...rawBadge,
      label: compactLabelFromState({
        state: displayedState,
        uiLang,
        ui: normalizedUi,
        fallbackLabel: rawBadge.label,
        err,
      }),
      titleText: uiLang === "ja" ? `状態: ${unknownShort}` : `State: ${unknownShort}`,
    };
  }, [rawBadge, err, displayedState, phase, normalizedUi, uiLang]);

  const [open, setOpen] = useState(false);
  const tipId = useId();

  const safeTipId = useMemo(
    () => `hopy-state-tip-${String(tipId).replace(/[^a-zA-Z0-9_-]/g, "")}`,
    [tipId]
  );

  const rootRef = useRef<HTMLSpanElement | null>(null);
  const touch = useMemo(() => isTouchDevice(), []);

  const openTip = () => setOpen(true);
  const closeTip = () => setOpen(false);
  const toggleTip = () => setOpen((v) => !v);

  const dotColor = useMemo(
    () =>
      dotColorFromState({
        state: displayedState,
        err,
        label: badge.label,
        uiLang,
        ui: normalizedUi,
      }),
    [displayedState, err, badge.label, uiLang, normalizedUi]
  );

  const visibleLabel = useMemo(() => {
    if (!compact) return badge.label;
    return compactLabelFromState({
      state: displayedState,
      uiLang,
      ui: normalizedUi,
      fallbackLabel: badge.label,
      err,
    });
  }, [compact, displayedState, uiLang, normalizedUi, badge.label, err]);

  const dotStyle = useMemo<React.CSSProperties>(() => {
    const baseSize = compact ? 6 : 9;
    const c = String(dotColor ?? "").trim();

    if (!c) {
      return {
        width: baseSize,
        height: baseSize,
        borderRadius: 9999,
        border: compact ? "1.1px solid currentColor" : "1.5px solid currentColor",
        opacity: compact ? 0.3 : 0.35,
        display: "inline-block",
        transform: compact ? "translateY(0)" : "translateY(-0.5px)",
        flex: "0 0 auto",
      };
    }

    return {
      width: baseSize,
      height: baseSize,
      borderRadius: 9999,
      background: c,
      display: "inline-block",
      transform: compact ? "translateY(0)" : "translateY(-0.5px)",
      flex: "0 0 auto",
    };
  }, [dotColor, compact]);

  const contentWrapStyle = useMemo<React.CSSProperties>(() => {
    return {
      display: "inline-flex",
      alignItems: "center",
      gap: compact ? 4 : 8,
      lineHeight: 1,
      minWidth: 0,
      maxWidth: "100%",
    };
  }, [compact]);

  useEffect(() => {
    if (!open) return;

    const onDocClick = (e: MouseEvent | TouchEvent) => {
      const el = rootRef.current;
      if (!el) return;
      if (!e.target || !(e.target instanceof Node)) return;

      if (!el.contains(e.target)) {
        closeTip();
      }
    };

    const onEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeTip();
    };

    const onScroll = () => {
      closeTip();
    };

    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("touchstart", onDocClick);
    document.addEventListener("keydown", onEsc);
    window.addEventListener("scroll", onScroll, { passive: true });

    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("touchstart", onDocClick);
      document.removeEventListener("keydown", onEsc);
      window.removeEventListener("scroll", onScroll as any);
    };
  }, [open]);

  const onBlur = (e: React.FocusEvent<HTMLSpanElement>) => {
    const root = rootRef.current;
    const next = e.relatedTarget as Node | null;
    if (!root) return closeTip();
    if (next && root.contains(next)) return;
    closeTip();
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLSpanElement>) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      toggleTip();
      return;
    }
    if (e.key === "Escape") {
      e.preventDefault();
      closeTip();
      return;
    }
  };

  return (
    <span
      ref={rootRef}
      className={joinClass(styles.badge, phaseClassFromState(displayedState, err), className)}
      tabIndex={0}
      role="button"
      aria-label={badge.titleText}
      aria-haspopup="dialog"
      aria-expanded={open ? "true" : "false"}
      aria-controls={open ? safeTipId : undefined}
      aria-describedby={open ? safeTipId : undefined}
      onMouseEnter={!touch ? openTip : undefined}
      onMouseLeave={!touch ? closeTip : undefined}
      onFocus={openTip}
      onBlur={onBlur}
      onKeyDown={onKeyDown}
      onClick={touch ? toggleTip : undefined}
    >
      <span aria-hidden="true" style={contentWrapStyle}>
        <span aria-hidden="true" style={dotStyle} />
        <span className={styles.label}>{visibleLabel}</span>
      </span>

      {open && (
        <span id={safeTipId} role="tooltip" className={styles.tip}>
          <span className={styles.tipTitle}>{normalizedUi.stateTitle}</span>
          <span className={styles.tipGrid}>
            {badge.tooltipLines.map((line, i) => (
              <span key={`${safeTipId}-${i}`} className={styles.tipLine}>
                {line}
              </span>
            ))}
          </span>
        </span>
      )}
    </span>
  );
}