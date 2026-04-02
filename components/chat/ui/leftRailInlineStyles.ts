// /components/chat/ui/leftRailInlineStyles.ts

"use client";

import React from "react";

function useIsMobileRailViewport() {
  const [isMobile, setIsMobile] = React.useState(true);

  React.useEffect(() => {
    if (typeof window === "undefined") return;

    const media = window.matchMedia("(max-width: 1023px)");

    const apply = () => {
      setIsMobile(media.matches);
    };

    apply();

    try {
      media.addEventListener("change", apply);
      return () => media.removeEventListener("change", apply);
    } catch {
      window.addEventListener("resize", apply);
      return () => window.removeEventListener("resize", apply);
    }
  }, []);

  return isMobile;
}

function useLeftRailLayoutStyles() {
  const isMobile = useIsMobileRailViewport();

  const mobileHeaderH = "calc(44px + env(safe-area-inset-top))";
  const mobileRailW = "min(320px, 86vw)";
  const desktopRailW = "288px";

  const overlayStyle = React.useMemo<React.CSSProperties>(
    () =>
      isMobile
        ? {
            position: "fixed",
            inset: 0,
            zIndex: 80,
            backgroundColor: "rgba(0,0,0,0.06)",
            pointerEvents: "auto",
          }
        : {
            display: "none",
            pointerEvents: "none",
          },
    [isMobile]
  );

  const asideStyle = React.useMemo<React.CSSProperties>(
    () =>
      isMobile
        ? {
            position: "fixed",
            left: 0,
            top: mobileHeaderH,
            bottom: 0,
            zIndex: 81,
            width: mobileRailW,
            maxWidth: "100vw",
            backgroundColor: "var(--paper, #ffffff)",
            overflow: "hidden",
            display: "flex",
            flexDirection: "column",
            minHeight: 0,
            pointerEvents: "auto",
          }
        : {
            position: "fixed",
            left: 0,
            top: 0,
            bottom: 0,
            zIndex: 40,
            width: desktopRailW,
            maxWidth: desktopRailW,
            backgroundColor: "var(--paper, #ffffff)",
            overflow: "hidden",
            display: "flex",
            flexDirection: "column",
            minHeight: 0,
            pointerEvents: "auto",
          },
    [isMobile, mobileHeaderH, mobileRailW]
  );

  const innerStyle = React.useMemo<React.CSSProperties>(
    () => ({
      flex: "1 1 auto",
      minHeight: 0,
      overflowY: "auto",
      overflowX: "hidden",
      WebkitOverflowScrolling: "touch" as any,
      overscrollBehavior: "contain",
    }),
    []
  );

  return {
    overlayStyle,
    asideStyle,
    innerStyle,
  };
}

function useLeftRailRowStyles() {
  const iconStyle = React.useMemo<React.CSSProperties>(
    () => ({
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
      lineHeight: 1,
      transform: "translateY(-0.5px)",
      fontWeight: 800,
      opacity: 0.85,
      fontSize: 16,
    }),
    []
  );

  const rightMarkStyle = React.useMemo<React.CSSProperties>(
    () => ({
      marginLeft: "auto",
      fontSize: 18,
      fontWeight: 800,
      opacity: 0.55,
      lineHeight: 1,
      transform: "translateY(-0.5px)",
    }),
    []
  );

  const activeThreadBadgeWrapStyle = React.useMemo<React.CSSProperties>(
    () => ({
      flex: "0 0 auto",
      minWidth: 0,
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "flex-end",
      maxWidth: "100%",
    }),
    []
  );

  return {
    iconStyle,
    rightMarkStyle,
    activeThreadBadgeWrapStyle,
  };
}

function useLeftRailMenuStyles() {
  const activeMenuStyle = React.useMemo<React.CSSProperties>(
    () => ({
      position: "absolute",
      top: "calc(100% + 8px)",
      right: 0,
      minWidth: 184,
      backgroundColor: "var(--paper, #ffffff)",
      border: "1px solid var(--hairline, rgba(216, 222, 230, 0.12))",
      zIndex: 5,
      display: "grid",
      overflow: "hidden",
      boxShadow: "0 10px 30px rgba(0,0,0,0.08)",
    }),
    []
  );

  const activeMenuItemStyle = React.useMemo<React.CSSProperties>(
    () => ({
      display: "flex",
      alignItems: "center",
      gap: 10,
      width: "100%",
      padding: "12px 14px",
      border: 0,
      backgroundColor: "transparent",
      textAlign: "left",
      fontSize: 14,
      fontWeight: 700,
      lineHeight: 1.4,
      cursor: "pointer",
      color: "var(--text, rgba(216, 222, 230, 0.9))",
    }),
    []
  );

  return {
    activeMenuStyle,
    activeMenuItemStyle,
  };
}

export function useLeftRailInlineStyles() {
  const layoutStyles = useLeftRailLayoutStyles();
  const rowStyles = useLeftRailRowStyles();
  const menuStyles = useLeftRailMenuStyles();

  return {
    ...layoutStyles,
    ...rowStyles,
    ...menuStyles,
  };
}