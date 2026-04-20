// /components/chat/ui/LeftRail.tsx

"use client";

import React from "react";
import styles from "./LeftRail.module.css";
import { buildLeftRailLabels } from "./leftRailLabels";
import LeftRailActiveThreadSection from "./LeftRailActiveThreadSection";
import LeftRailThreadList from "./LeftRailThreadList";
import LeftRailNavRow from "./LeftRailNavRow";
import LeftRailAccountSection from "./LeftRailAccountSection";
import { useLeftRailController } from "./useLeftRailController";
import { useLeftRailInlineStyles } from "./leftRailInlineStyles";
import { useLeftRailDragStyle } from "./useLeftRailDragStyle";
import type { LeftRailProps } from "./leftRailTypes";
import type { HopyState } from "../lib/stateBadge";

const APP_HEADER_HEIGHT_PX = 44;
const SP_MAX_WIDTH_PX = 768;
const LEFT_RAIL_WIDTH_PX = 288;
const OPENING_BACKDROP_RGB = "15, 23, 42";

function getRailText(uiLang: string) {
  if (uiLang === "ja") {
    return {
      newChatSection: "新しいチャット",
      currentChatSection: "現在のチャット",
      threadsSection: "スレッド",
      memoriesSection: "メモリーズ",
      accountSection: "アカウント",
      memoriesAria: "メモリーズを開く",
    };
  }

  return {
    newChatSection: "New Chat",
    currentChatSection: "Current Chat",
    threadsSection: "Threads",
    memoriesSection: "Memories",
    accountSection: "Account",
    memoriesAria: "Open Memories",
  };
}

function resolveConfirmedThreadState(
  value: LeftRailProps["activeThreadState"]
): LeftRailProps["activeThreadState"] {
  if (!value || typeof value !== "object") {
    return undefined;
  }

  const currentPhase = (value as { current_phase?: unknown }).current_phase;

  if (
    currentPhase === 1 ||
    currentPhase === 2 ||
    currentPhase === 3 ||
    currentPhase === 4 ||
    currentPhase === 5
  ) {
    return value;
  }

  return undefined;
}

function resolveDisplayActiveThreadState(
  value: LeftRailProps["activeThreadState"]
): HopyState | undefined {
  if (!value || typeof value !== "object") {
    return undefined;
  }

  const currentPhase = (value as { current_phase?: unknown }).current_phase;

  if (
    currentPhase === 1 ||
    currentPhase === 2 ||
    currentPhase === 3 ||
    currentPhase === 4 ||
    currentPhase === 5
  ) {
    return { current_phase: currentPhase } as HopyState;
  }

  return undefined;
}

export default function LeftRail(props: LeftRailProps) {
  const extendedProps = props as LeftRailProps & {
    isLeftRailOpeningDrag?: boolean;
    leftRailOpeningStyle?: React.CSSProperties;
    leftRailOpeningBackdropStyle?: React.CSSProperties;
  };

  const {
    uiLang,
    ui,
    userStateErr,
    activeThreadId,
    onOpenMemories,
    userState,
    onClose,
    railOpen,
    threads,
    activeThread,
    activeThreadState,
    onSelectThread,
    onCreateThread,
    onRenameThread,
    disableNewChat,
  } = extendedProps;

  const {
    isLeftRailOpeningDrag = false,
    leftRailOpeningStyle = {},
    leftRailOpeningBackdropStyle = {},
  } = extendedProps;

  const t = React.useMemo(() => buildLeftRailLabels(uiLang), [uiLang]);
  const railText = React.useMemo(() => getRailText(uiLang), [uiLang]);

  const resolvedDirectActiveThreadState = React.useMemo<LeftRailProps["activeThreadState"]>(() => {
    return resolveConfirmedThreadState(activeThreadState);
  }, [activeThreadState]);

  const controllerProps = React.useMemo<LeftRailProps>(
    () => ({
      uiLang,
      ui,
      onOpenMemories,
      userState,
      userStateErr,
      onClose,
      railOpen,
      threads,
      activeThreadId,
      activeThread,
      activeThreadState: resolvedDirectActiveThreadState,
      onSelectThread,
      onCreateThread,
      onRenameThread,
      disableNewChat,
    }),
    [
      uiLang,
      ui,
      onOpenMemories,
      userState,
      userStateErr,
      onClose,
      railOpen,
      threads,
      activeThreadId,
      activeThread,
      resolvedDirectActiveThreadState,
      onSelectThread,
      onCreateThread,
      onRenameThread,
      disableNewChat,
    ]
  );

  const {
    isOpen,
    closeLayer,
    closeLayerNextFrame,
    openLayer,
    showRecover,
    threadsSafe,
    hasThreads,
    activeIdSafe,
    activeThreadTitle,
    disableNewChat: disableNewChatSafe,
    activeMenuOpen,
    activeMenuRef,
    setActiveMenuOpen,
    titleCountMap,
    emitSelectThread,
    promptRename,
    confirmDelete,
    handleReset,
    showCloseBtn,
  } = useLeftRailController({
    props: controllerProps,
    labels: t,
  });

  void hasThreads;
  void closeLayer;
  void openLayer;
  void showCloseBtn;

  const displayActiveThreadState = React.useMemo<HopyState | undefined>(() => {
    return resolveDisplayActiveThreadState(resolvedDirectActiveThreadState);
  }, [resolvedDirectActiveThreadState]);

  const {
    overlayStyle,
    asideStyle,
    innerStyle,
    iconStyle,
    activeThreadBadgeWrapStyle,
    activeMenuStyle,
    activeMenuItemStyle,
  } = useLeftRailInlineStyles();

  const [isSpViewport, setIsSpViewport] = React.useState(false);

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

  const railOpenSafe = railOpen ?? false;

  const panelWidthPx =
    typeof window !== "undefined" && isSpViewport ? window.innerWidth : LEFT_RAIL_WIDTH_PX;

  const {
    railStyle,
    backdropStyle,
    isDragging,
    handleCloseTouchStart,
    handleCloseTouchMove,
    handleCloseTouchEnd,
  } = useLeftRailDragStyle({
    railOpen: railOpenSafe,
    enabled: isSpViewport,
    panelWidthPx,
  });

  const mergedRailStyle = React.useMemo<React.CSSProperties>(() => {
    if (isLeftRailOpeningDrag) {
      return {
        ...railStyle,
        visibility: "visible",
        opacity: 1,
        pointerEvents: "auto",
        ...leftRailOpeningStyle,
      };
    }

    return railStyle;
  }, [isLeftRailOpeningDrag, railStyle, leftRailOpeningStyle]);

  const mergedBackdropStyle = React.useMemo<React.CSSProperties>(() => {
    if (isLeftRailOpeningDrag) {
      const openingOpacity =
        typeof leftRailOpeningBackdropStyle.opacity === "number"
          ? leftRailOpeningBackdropStyle.opacity
          : 0;

      const { opacity: _ignoredOpacity, ...openingBackdropRest } = leftRailOpeningBackdropStyle;

      return {
        visibility: "visible",
        pointerEvents: "none",
        transition: "none",
        willChange: "background-color",
        backgroundColor: `rgba(${OPENING_BACKDROP_RGB}, ${openingOpacity})`,
        ...openingBackdropRest,
      };
    }

    return backdropStyle;
  }, [isLeftRailOpeningDrag, backdropStyle, leftRailOpeningBackdropStyle]);

  const safeAsideStyle = React.useMemo<React.CSSProperties>(
    () => ({
      ...asideStyle,
      ...mergedRailStyle,
      top: `calc(${APP_HEADER_HEIGHT_PX}px + env(safe-area-inset-top, 0px))`,
      width: isSpViewport ? "100vw" : `min(100vw, ${LEFT_RAIL_WIDTH_PX}px)`,
      maxWidth: isSpViewport ? "100vw" : `min(100vw, ${LEFT_RAIL_WIDTH_PX}px)`,
      minWidth: 0,
      overflowX: "hidden",
      boxSizing: "border-box",
    }),
    [asideStyle, mergedRailStyle, isSpViewport]
  );

  const safeInnerStyle = React.useMemo<React.CSSProperties>(
    () => ({
      ...innerStyle,
      width: "100%",
      maxWidth: "100%",
      minWidth: 0,
      overflowX: "hidden",
      boxSizing: "border-box",
      display: "flex",
      flexDirection: "column",
      minHeight: "100%",
    }),
    [innerStyle]
  );

  const safeOverlayStyle = React.useMemo<React.CSSProperties>(
    () => ({
      ...overlayStyle,
      ...mergedBackdropStyle,
    }),
    [overlayStyle, mergedBackdropStyle]
  );

  const hiddenRightMarkStyle = React.useMemo<React.CSSProperties>(
    () => ({
      opacity: 0,
    }),
    []
  );

  const threadsParentRowStyle = React.useMemo<React.CSSProperties>(
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

  const shouldUseOverlay = isSpViewport;
  const shouldRenderOverlay = shouldUseOverlay && !isLeftRailOpeningDrag;
  const shouldCloseAfterAction = false;

  if (!isOpen && !isDragging && !isLeftRailOpeningDrag) return null;

  return (
    <>
      {shouldRenderOverlay ? (
        <div
          role="presentation"
          aria-hidden="true"
          onMouseDown={(e) => {
            e.preventDefault();
            closeLayer();
          }}
          onTouchStart={(e) => {
            try {
              e.preventDefault();
            } catch {}
            closeLayer();
          }}
          style={safeOverlayStyle}
        />
      ) : null}

      <aside
        className={styles.rail}
        aria-label={t.railAria}
        style={safeAsideStyle}
        onTouchStart={handleCloseTouchStart}
        onTouchMove={handleCloseTouchMove}
        onTouchEnd={() => handleCloseTouchEnd(closeLayer)}
      >
        <div className={styles.inner} style={safeInnerStyle}>
          <div className={styles.block}>
            <LeftRailNavRow
              as="button"
              onClick={() => {
                onOpenMemories?.();
                if (shouldCloseAfterAction) {
                  closeLayerNextFrame();
                }
              }}
              ariaLabel={railText.memoriesAria}
              leftIcon="✦"
              text={railText.memoriesSection}
              rightMark=""
              rightMarkStyle={hiddenRightMarkStyle}
              className={styles.item}
              iconStyle={iconStyle}
            />
          </div>

          <div className={styles.block}>
            <LeftRailNavRow
              as="button"
              disabled={disableNewChatSafe}
              onClick={() => {
                if (disableNewChatSafe) return;
                onCreateThread?.();
                if (shouldCloseAfterAction) {
                  closeLayer();
                }
              }}
              title={disableNewChatSafe ? t.newChatDisabled : t.newChat}
              ariaLabel={t.newChat}
              leftIcon="＋"
              text={railText.newChatSection}
              rightMark=""
              rightMarkStyle={hiddenRightMarkStyle}
              className={`${styles.item} ${disableNewChatSafe ? styles.itemDisabled : ""}`}
              iconStyle={iconStyle}
            />
          </div>

          {activeIdSafe && displayActiveThreadState !== undefined ? (
            <div className={styles.block}>
              <LeftRailActiveThreadSection
                uiLang={uiLang}
                ui={ui}
                label={`◉ ${railText.currentChatSection}`}
                activeActionsLabel={t.activeActions}
                activeThreadId={activeIdSafe}
                activeThreadTitle={activeThreadTitle}
                activeThreadState={displayActiveThreadState}
                activeMenuOpen={activeMenuOpen}
                activeMenuRef={activeMenuRef}
                activeThreadBadgeWrapStyle={activeThreadBadgeWrapStyle}
                activeMenuStyle={activeMenuStyle}
                activeMenuItemStyle={activeMenuItemStyle}
                onToggleMenu={() => setActiveMenuOpen((v) => !v)}
                onRename={() => {
                  if (!activeIdSafe) return;
                  promptRename(activeIdSafe, activeThreadTitle);
                }}
                onDelete={() => {
                  if (!activeIdSafe) return;
                  confirmDelete(activeIdSafe, activeThreadTitle);
                }}
                moreLabel={t.more}
                renameLabel={t.rename}
                deleteLabel={t.delete}
              />
            </div>
          ) : null}

          <div className={styles.block}>
            <div className={styles.item} style={threadsParentRowStyle}>
              <span aria-hidden="true" style={iconStyle}>
                ☰
              </span>
              <span className={styles.itemText} style={{ flex: "1 1 auto", minWidth: 0 }}>
                {railText.threadsSection}
              </span>
              <span aria-hidden="true" style={hiddenRightMarkStyle}>
                ›
              </span>
            </div>

            <LeftRailThreadList
              threads={threadsSafe}
              activeThreadId={activeIdSafe}
              untitled={t.untitled}
              invalidThreadId={t.invalidThreadId}
              noThreads={t.noThreads}
              iconStyle={iconStyle}
              titleCountMap={titleCountMap}
              onSelectThread={(threadId, threadTitle) => {
                emitSelectThread(threadId, threadTitle);
                if (shouldCloseAfterAction) {
                  closeLayerNextFrame();
                }
              }}
            />
          </div>

          {showRecover ? (
            <div className={styles.block}>
              <div
                className={styles.label}
                style={styles.recoverLabel ? undefined : undefined}
                title={String(userStateErr ?? "")}
              >
                {t.recoverTitle}
              </div>

              <LeftRailNavRow
                as="button"
                onClick={() => {
                  if (shouldCloseAfterAction) {
                    closeLayer();
                  }
                  handleReset();
                }}
                ariaLabel={t.recover}
                leftIcon="↻"
                text={t.recover}
                rightMark=""
                rightMarkStyle={hiddenRightMarkStyle}
                className={styles.item}
                iconStyle={iconStyle}
              />
            </div>
          ) : null}

          <div className={styles.block}>
            <LeftRailAccountSection userState={userState} />
          </div>

          <button
            type="button"
            onClick={openLayer}
            style={{
              position: "absolute",
              left: -9999,
              width: 1,
              height: 1,
              overflow: "hidden",
            }}
            aria-hidden="true"
            tabIndex={-1}
          />
        </div>
      </aside>
    </>
  );
}

/*
このファイルの正式役割
左カラムの表示責務だけを持ち、New Chat / Current Chat / Threads / Memories / ユーザー情報 + 実プラン名 の並びを描画するファイル。
状態の唯一の正は作らず、受け取った確定済み state を表示するだけに限定する。
*/

/*
【今回このファイルで修正したこと】
1. スレッド選択押下時の処理を、親から受け取った onSelectThread() の直接実行ではなく、useLeftRailController の emitSelectThread() 経由へ戻しました。
2. emitSelectThread() の fallback dispatch 経路を復活させ、親側の onSelectThread が不安定な場合でも hopy:select-thread へ流れる余地を戻しました。
3. New Chat、状態表示、メモリーズ、Recover、左下アカウント表示、HOPY唯一の正、state_changed、Compass、DB保存・復元には触っていません。
*/

/* /components/chat/ui/LeftRail.tsx */