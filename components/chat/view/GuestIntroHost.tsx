// /components/chat/view/GuestIntroHost.tsx
"use client";

import React from "react";
import GuestIntroMotion from "./GuestIntroMotion";
import type { Lang } from "../lib/chatTypes";

type Props = {
  uiLang: Lang;
};

const GuestIntroHost = React.memo(function GuestIntroHost(props: Props) {
  return (
    <div
      aria-label="logged-out"
      style={{
        width: "100%",
        display: "flex",
        justifyContent: "center",
        alignItems: "flex-start",
        paddingTop: 8,
        paddingBottom: 0,
      }}
    >
      <GuestIntroMotion uiLang={props.uiLang === "en" ? "en" : "ja"} />
    </div>
  );
});

export default GuestIntroHost;