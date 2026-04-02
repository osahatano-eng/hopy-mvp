// /components/chat/view/MobileRailOverlay.tsx
"use client";

import React from "react";
import styles from "../ChatClient.module.css";

import LeftRail from "../ui/LeftRail";
import type { Lang } from "../lib/chatTypes";

export function MobileRailOverlay(props: {
  isMobile: boolean;
  railOpen: boolean;
  setRailOpen: (v: boolean) => void;
  railPanelRef: React.RefObject<HTMLDivElement | null>;

  uiLang: Lang;
  ui: any;

  setMemOpen: (v: boolean) => void;
  userState: any;
  userStateErr: string | null;
}) {
  const { isMobile, railOpen, setRailOpen, railPanelRef, uiLang, ui, setMemOpen, userState, userStateErr } =
    props;

  if (!isMobile) return null;

  return (
    <div className={styles.railOverlay} data-open={railOpen ? "1" : "0"} aria-hidden={!railOpen}>
      <button
        type="button"
        className={styles.railBackdrop}
        onClick={() => setRailOpen(false)}
        aria-label={uiLang === "en" ? "Close panel" : "パネルを閉じる"}
      />

      <div className={styles.railPanel} ref={railPanelRef}>
        <LeftRail
          uiLang={uiLang}
          ui={ui}
          onOpenMem={() => setMemOpen(true)}
          userState={userState as any}
          userStateErr={userStateErr}
          showCloseButton={true}
          onClose={() => setRailOpen(false)}
        />
      </div>
    </div>
  );
}