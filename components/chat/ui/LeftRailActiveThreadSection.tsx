// /components/chat/ui/LeftRailActiveThreadSection.tsx
"use client";

import React from "react";
import styles from "./LeftRail.module.css";
import stateBadgeStyles from "./StateBadge.module.css";
import type { Lang } from "../lib/chatTypes";
import { normalizeHopyState, type HopyState } from "../lib/stateBadge";
import StateBadge from "./StateBadge";

type Props = {
  uiLang: Lang;
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
  label: string;
  activeActionsLabel: string;
  activeThreadId: string;
  activeThreadTitle: string;
  activeThreadState: HopyState | null;
  activeMenuOpen: boolean;
  activeMenuRef: React.RefObject<HTMLDivElement | null>;
  activeThreadBadgeWrapStyle: React.CSSProperties;
  activeMenuStyle: React.CSSProperties;
  activeMenuItemStyle: React.CSSProperties;
  onToggleMenu: () => void;
  onRename: () => void;
  onDelete: () => void;
  moreLabel: string;
  renameLabel: string;
  deleteLabel: string;
};

type ActiveThreadBadgeProps = {
  uiLang: Lang;
  ui: Props["ui"];
  activeThreadState: HopyState | null;
  activeThreadBadgeWrapStyle: React.CSSProperties;
};

function ActiveThreadBadge({
  uiLang,
  ui,
  activeThreadState,
  activeThreadBadgeWrapStyle,
}: ActiveThreadBadgeProps) {
  const normalizedActiveThreadState = React.useMemo(() => {
    return normalizeHopyState(activeThreadState);
  }, [activeThreadState]);

  const hasResolvedPhase = React.useMemo(() => {
    const current = Number(normalizedActiveThreadState?.current_phase);
    const level = Number(normalizedActiveThreadState?.state_level);

    const currentOk = Number.isFinite(current) && current >= 1 && current <= 5;
    const levelOk = Number.isFinite(level) && level >= 1 && level <= 5;

    return currentOk || levelOk;
  }, [normalizedActiveThreadState]);

  const badgeUi = React.useMemo(() => {
    return {
      stateTitle: ui.stateTitle,
      stateUnknownShort: ui.stateUnknownShort,
      statePhase1: ui.statePhase1,
      statePhase2: ui.statePhase2,
      statePhase3: ui.statePhase3,
      statePhase4: ui.statePhase4,
      statePhase5: ui.statePhase5,
    };
  }, [
    ui.stateTitle,
    ui.stateUnknownShort,
    ui.statePhase1,
    ui.statePhase2,
    ui.statePhase3,
    ui.statePhase4,
    ui.statePhase5,
  ]);

  const statusAriaLabel = uiLang === "ja" ? "現在のチャット状態" : "Current chat status";

  if (!hasResolvedPhase) {
    return (
      <div
        className={styles.stateWrap}
        style={{
          ...activeThreadBadgeWrapStyle,
          alignSelf: "flex-start",
          minWidth: 0,
          maxWidth: "100%",
        }}
        aria-label={statusAriaLabel}
      >
        <span
          className={stateBadgeStyles.compact}
          style={{
            display: "inline-flex",
            alignItems: "center",
            minHeight: 24,
            opacity: 0.76,
            whiteSpace: "nowrap",
            maxWidth: "100%",
          }}
        >
          {ui.stateUnknownShort}
        </span>
      </div>
    );
  }

  return (
    <div
      className={styles.stateWrap}
      style={{
        ...activeThreadBadgeWrapStyle,
        alignSelf: "flex-start",
        minWidth: 0,
        maxWidth: "100%",
      }}
      aria-label={statusAriaLabel}
    >
      <StateBadge
        className={stateBadgeStyles.compact}
        state={normalizedActiveThreadState as any}
        err={null}
        uiLang={uiLang as any}
        ui={badgeUi as any}
      />
    </div>
  );
}

type ActiveThreadMenuProps = {
  activeMenuOpen: boolean;
  activeActionsLabel: string;
  activeMenuStyle: React.CSSProperties;
  activeMenuItemStyle: React.CSSProperties;
  onRename: () => void;
  onDelete: () => void;
  renameLabel: string;
  deleteLabel: string;
};

function ActiveThreadMenu({
  activeMenuOpen,
  activeActionsLabel,
  activeMenuStyle,
  activeMenuItemStyle,
  onRename,
  onDelete,
  renameLabel,
  deleteLabel,
}: ActiveThreadMenuProps) {
  if (!activeMenuOpen) return null;

  return (
    <div role="menu" aria-label={activeActionsLabel} style={activeMenuStyle}>
      <button
        type="button"
        role="menuitem"
        onClick={onRename}
        style={{
          ...activeMenuItemStyle,
          borderBottom: "1px solid var(--hairline, rgba(0, 0, 0, 0.08))",
        }}
      >
        <span aria-hidden="true" style={{ width: 16, opacity: 0.72 }}>
          ✎
        </span>
        <span>{renameLabel}</span>
      </button>

      <button
        type="button"
        role="menuitem"
        onClick={onDelete}
        style={activeMenuItemStyle}
      >
        <span aria-hidden="true" style={{ width: 16, opacity: 0.72 }}>
          ⌫
        </span>
        <span>{deleteLabel}</span>
      </button>
    </div>
  );
}

function normalizeParentLabel(label: string): string {
  return String(label ?? "").replace(/^[^\p{L}\p{N}ぁ-んァ-ヶ一-龠]+/u, "").trim();
}

export default function LeftRailActiveThreadSection(props: Props) {
  const {
    uiLang,
    ui,
    label,
    activeActionsLabel,
    activeThreadId,
    activeThreadTitle,
    activeThreadState,
    activeMenuOpen,
    activeMenuRef,
    activeThreadBadgeWrapStyle,
    activeMenuStyle,
    activeMenuItemStyle,
    onToggleMenu,
    onRename,
    onDelete,
    moreLabel,
    renameLabel,
    deleteLabel,
  } = props;

  const displayLabel = React.useMemo(() => {
    return normalizeParentLabel(label);
  }, [label]);

  const parentRowStyle = React.useMemo<React.CSSProperties>(
    () => ({
      display: "flex",
      alignItems: "center",
      gap: 6,
      width: "100%",
      minWidth: 0,
      minHeight: 36,
      padding: "5px 9px",
      boxSizing: "border-box",
    }),
    []
  );

  const parentIconStyle = React.useMemo<React.CSSProperties>(
    () => ({
      width: "var(--railIconW)",
      minWidth: "var(--railIconW)",
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
      opacity: 0.44,
      flex: "0 0 var(--railIconW)",
    }),
    []
  );

  const hiddenRightMarkStyle = React.useMemo<React.CSSProperties>(
    () => ({
      opacity: 0,
      flex: "0 0 auto",
    }),
    []
  );

  const childBlockStyle = React.useMemo<React.CSSProperties>(
    () => ({
      position: "relative",
      marginLeft: 34,
      width: "calc(100% - 34px)",
      maxWidth: "calc(100% - 34px)",
      boxSizing: "border-box",
    }),
    []
  );

  if (!activeThreadId) return null;

  return (
    <>
      <div className={styles.item} style={parentRowStyle}>
        <span aria-hidden="true" style={parentIconStyle}>
          ◉
        </span>
        <span className={styles.itemText} style={{ flex: "1 1 auto", minWidth: 0 }}>
          {displayLabel}
        </span>
        <span aria-hidden="true" style={hiddenRightMarkStyle}>
          ›
        </span>
      </div>

      <div
        className={styles.activeRow}
        ref={activeMenuRef}
        style={childBlockStyle}
      >
        <div
          style={{
            minWidth: 0,
            maxWidth: "100%",
            overflow: "hidden",
            display: "flex",
            flexDirection: "column",
            alignItems: "flex-start",
            width: "100%",
          }}
        >
          <div
            className={styles.activeTitleInline}
            title={activeThreadTitle}
            style={{
              width: "100%",
              maxWidth: "100%",
              overflow: "hidden",
            }}
          >
            {activeThreadTitle}
          </div>

          <ActiveThreadBadge
            uiLang={uiLang}
            ui={ui}
            activeThreadState={activeThreadState}
            activeThreadBadgeWrapStyle={activeThreadBadgeWrapStyle}
          />
        </div>

        <button
          type="button"
          className={styles.activeMenuBtn}
          aria-label={moreLabel}
          aria-haspopup="menu"
          aria-expanded={activeMenuOpen ? "true" : "false"}
          onClick={onToggleMenu}
        >
          <span
            aria-hidden="true"
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 18,
              fontWeight: 700,
              lineHeight: 1,
              transform: "translateY(-1px)",
            }}
          >
            …
          </span>
        </button>

        <ActiveThreadMenu
          activeMenuOpen={activeMenuOpen}
          activeActionsLabel={activeActionsLabel}
          activeMenuStyle={activeMenuStyle}
          activeMenuItemStyle={activeMenuItemStyle}
          onRename={onRename}
          onDelete={onDelete}
          renameLabel={renameLabel}
          deleteLabel={deleteLabel}
        />
      </div>
    </>
  );
}

/*
このファイルの正式役割
Current Chat セクションの表示責務だけを持ち、見出し、タイトル、状態、三点メニューを静かに表示するファイル。
状態の唯一の正は作らず、受け取った確定済み state をそのまま表示するだけに限定する。
*/

/*
【今回このファイルで修正したこと】
1. 「現在のチャット」見出し行だけが別基準になっていたため、親リンクの icon 幅・gap・padding を他見出しと同じ基準へ合わせました。
2. 状態表示、タイトル表示、三点メニューの既存責務は維持し、状態の唯一の正には触れていません。
3. state の再判定、state_changed の再計算、0..4 前提への変換は一切追加していません。
*/