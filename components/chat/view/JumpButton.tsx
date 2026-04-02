// /components/chat/view/JumpButton.tsx
"use client";

import React from "react";
import styles from "../ChatClient.module.css";

const JUMP_PRESS_ANIMATION_MS = 220;

type Props = {
  ariaLabel: string;
  onClick: () => void;
};

const JumpButton = React.memo(function JumpButton(props: Props) {
  const [pressed, setPressed] = React.useState(false);

  React.useEffect(() => {
    if (!pressed) return;
    const timer = window.setTimeout(() => setPressed(false), JUMP_PRESS_ANIMATION_MS);
    return () => window.clearTimeout(timer);
  }, [pressed]);

  const handleClick = React.useCallback(() => {
    setPressed(true);
    props.onClick();
  }, [props]);

  return (
    <button
      type="button"
      className={styles.jump}
      aria-label={props.ariaLabel}
      onClick={handleClick}
      style={{
        transform: pressed ? "translateX(-50%) scale(0.92)" : "translateX(-50%) scale(1)",
        opacity: pressed ? 0.92 : 1,
        transition:
          "transform 180ms cubic-bezier(0.22, 1, 0.36, 1), opacity 180ms cubic-bezier(0.22, 1, 0.36, 1)",
        willChange: "transform, opacity",
      }}
    >
      <svg
        className={styles.jumpIcon}
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        aria-hidden="true"
      >
        <path
          d="M6 9l6 6 6-6"
          stroke="currentColor"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </button>
  );
});

export default JumpButton;