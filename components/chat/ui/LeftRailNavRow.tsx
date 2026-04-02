// /components/chat/ui/LeftRailNavRow.tsx

"use client";

import React from "react";
import styles from "./LeftRail.module.css";

type Props = {
  as?: "button" | "a";
  href?: string;
  onClick?: (e?: any) => void;
  disabled?: boolean;
  title?: string;
  ariaLabel?: string;
  leftIcon?: string;
  text: string;
  rightMark?: string;
  className?: string;
  childrenRight?: React.ReactNode;
  iconStyle: React.CSSProperties;
  rightMarkStyle: React.CSSProperties;
};

type LeftRailNavRowContentProps = {
  disabled?: boolean;
  leftIcon?: string;
  text: string;
  rightMark?: string;
  childrenRight?: React.ReactNode;
  iconStyle: React.CSSProperties;
  rightMarkStyle: React.CSSProperties;
};

function LeftRailNavRowContent({
  disabled,
  leftIcon,
  text,
  rightMark = "›",
  childrenRight,
  iconStyle,
  rightMarkStyle,
}: LeftRailNavRowContentProps) {
  return (
    <>
      <span
        aria-hidden="true"
        style={{ ...iconStyle, opacity: disabled ? 0.5 : iconStyle.opacity }}
      >
        {leftIcon ?? ""}
      </span>

      <span
        className={styles.itemText}
        style={{ flex: "1 1 auto", minWidth: 0 }}
      >
        {text}
      </span>

      {childrenRight ? (
        childrenRight
      ) : (
        <span
          aria-hidden="true"
          style={{
            ...rightMarkStyle,
            opacity: disabled ? 0.3 : rightMarkStyle.opacity,
          }}
        >
          {rightMark}
        </span>
      )}
    </>
  );
}

export default function LeftRailNavRow({
  as = "button",
  href,
  onClick,
  disabled,
  title,
  ariaLabel,
  leftIcon,
  text,
  rightMark = "›",
  className,
  childrenRight,
  iconStyle,
  rightMarkStyle,
}: Props) {
  const resolvedClassName = className ?? styles.item;
  const resolvedAriaLabel = ariaLabel ?? text;
  const resolvedTitle = title ?? text;

  const content = React.useMemo(() => {
    return (
      <LeftRailNavRowContent
        disabled={disabled}
        leftIcon={leftIcon}
        text={text}
        rightMark={rightMark}
        childrenRight={childrenRight}
        iconStyle={iconStyle}
        rightMarkStyle={rightMarkStyle}
      />
    );
  }, [disabled, leftIcon, text, rightMark, childrenRight, iconStyle, rightMarkStyle]);

  const handleAnchorClick = React.useCallback(
    (e: React.MouseEvent<HTMLAnchorElement>) => {
      if (disabled) {
        e.preventDefault();
        return;
      }
      onClick?.(e);
    },
    [disabled, onClick]
  );

  const handleButtonClick = React.useCallback(
    (e: React.MouseEvent<HTMLButtonElement>) => {
      if (disabled) return;
      onClick?.(e);
    },
    [disabled, onClick]
  );

  if (as === "a") {
    return (
      <a
        className={resolvedClassName}
        href={disabled ? undefined : href}
        aria-disabled={disabled ? "true" : undefined}
        onClick={handleAnchorClick}
        title={resolvedTitle}
        aria-label={resolvedAriaLabel}
        tabIndex={disabled ? -1 : undefined}
      >
        {content}
      </a>
    );
  }

  return (
    <button
      type="button"
      className={resolvedClassName}
      onClick={handleButtonClick}
      disabled={disabled}
      aria-disabled={disabled}
      title={resolvedTitle}
      aria-label={resolvedAriaLabel}
    >
      {content}
    </button>
  );
}

/*
このファイルの正式役割
LeftRail 内の共通ナビ行を描画する表示専用ファイル。
New Chat / Memories などの1行導線のアイコン、文字、右端記号を同じ構造で描画し、状態の唯一の正には一切触れない。
*/

/*
【今回このファイルで修正したこと】
1. ariaLabel 未指定時に text を使うようにして、共通導線のアクセシビリティを安定化しました。
2. title 未指定時に text を使うようにして、共通導線の表示補助を揃えました。
3. a 要素が disabled のとき href を外し、tabIndex=-1 にして、押せない導線を自然にしました。
4. New Chat / Memories などの共通行の構造はそのままに保ち、格合わせを壊さない最小修正だけに留めました。
5. state の再判定、state_changed の再計算、0..4 前提への変換は一切追加していません。
*/