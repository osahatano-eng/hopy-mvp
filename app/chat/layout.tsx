// /app/chat/layout.tsx
import React from "react";
import styles from "./chat.layout.module.css";

export default function ChatLayout({ children }: { children: React.ReactNode }) {
  return <div className={styles.chatTheme}>{children}</div>;
}