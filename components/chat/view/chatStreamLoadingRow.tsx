// /components/chat/view/chatStreamLoadingRow.tsx
"use client";

import React from "react";
import MessageRow from "../ui/MessageRow";
import type { Lang } from "../lib/chatTypes";

type Props = {
  loading: boolean;
  hasTrailingAssistantMessage: boolean;
  sendingText: string;
  uiLang: Lang;
};

export function ChatStreamLoadingRow(props: Props) {
  const { loading, hasTrailingAssistantMessage, sendingText, uiLang } = props;

  if (!loading) return null;
  if (hasTrailingAssistantMessage) return null;

  return (
    <MessageRow
      key="assistant-loading-row"
      role="assistant"
      text={sendingText}
      uiLang={uiLang}
      msgKey="assistant-loading-row"
      dataRole="assistant"
      isLastUser={false}
    />
  );
}

export default ChatStreamLoadingRow;