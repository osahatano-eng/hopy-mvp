// /components/chat/view/ChatLayout.tsx
"use client";

import React from "react";
import styles from "../ChatClient.module.css";
import ChatHeader from "../ui/ChatHeader";
import type { Lang } from "../lib/chatTypes";

type Props = {
  guestMode: boolean;
  uiLang: Lang;
  email: string;
  railOpen: boolean;
  onToggleRail: () => void;
  onChangeLang?: (next: Lang) => void;
  headerWrapperStyle?: React.CSSProperties;
  children: React.ReactNode;
};

const PC_RAIL_BREAKPOINT_PX = 1024;
const PC_RAIL_WIDTH_PX = 288;
const PC_RAIL_SCROLLBAR_GAP_PX = 14;
const PC_CONTENT_RIGHT_GAP_PX = 20;

export const ChatLayout = React.memo(function ChatLayout(props: Props) {
  const {
    guestMode,
    uiLang,
    email,
    railOpen,
    onToggleRail,
    onChangeLang,
    headerWrapperStyle,
    children,
  } = props;

  const ChatHeaderAny = ChatHeader as any;

  const [isDesktop, setIsDesktop] = React.useState(false);

  React.useEffect(() => {
    if (typeof window === "undefined") return;

    const apply = () => {
      try {
        setIsDesktop(window.innerWidth >= PC_RAIL_BREAKPOINT_PX);
      } catch {
        setIsDesktop(false);
      }
    };

    apply();

    try {
      window.addEventListener("resize", apply);
      return () => window.removeEventListener("resize", apply);
    } catch {
      return;
    }
  }, []);

  const shellStyle = React.useMemo<React.CSSProperties>(() => {
    if (guestMode) return {};
    if (!isDesktop) return {};
    if (!railOpen) return {};

    return {
      paddingLeft: `${PC_RAIL_WIDTH_PX + PC_RAIL_SCROLLBAR_GAP_PX}px`,
      paddingRight: `${PC_CONTENT_RIGHT_GAP_PX}px`,
      boxSizing: "border-box",
    };
  }, [guestMode, isDesktop, railOpen]);

  return (
    <section className={styles.shell} aria-label="chat" style={shellStyle}>
      <div aria-hidden={headerWrapperStyle ? "true" : undefined} style={headerWrapperStyle}>
        <ChatHeaderAny
          uiLang={uiLang}
          railOpen={railOpen}
          onToggleRail={onToggleRail}
          email={email}
          onChangeLang={onChangeLang}
        />
      </div>

      {children}
    </section>
  );
});

export default ChatLayout;