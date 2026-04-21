// /components/chat/view/ChatComposer.tsx
"use client";

import React, { useCallback, useRef, useEffect, useMemo } from "react";
import styles from "../ChatClient.module.css";
import type { Lang } from "../lib/chatTypes";
import type { FailedSend } from "../lib/useChatSend";
import type { Thread } from "../lib/chatTypes";

export const ChatComposer = React.memo(function ChatComposer(props: {
  uiLang: Lang;
  ui: {
    placeholder: string;
    enterHint: string;
    privacy: string;
    failed: string;
    retry: string;
    sending: string;
    login: string;
  };

  loggedIn: boolean;
  loading: boolean;
  threadBusy: boolean;

  threads: Thread[];
  activeThreadId: string | null;

  input: string;
  setInput: (v: string) => void;

  inputRef: React.RefObject<HTMLTextAreaElement | null>;
  composerRef: React.RefObject<HTMLDivElement | null>;

  composing: boolean;
  canSendNow: boolean;

  lastFailed: FailedSend | null;
  retryLastFailed: () => void;

  softWarn: string | null;

  isMobile: boolean;
  sendLabel: string;

  onArmFocusGuard: () => void;
  onRunFocusGuard: () => void;
  onFocusScrollBottom: () => void;

  onTrySend: () => void;
}) {
  const {
    uiLang,
    ui,
    loading,
    threadBusy,
    input,
    setInput,
    inputRef,
    composerRef,
    composing,
    canSendNow,
    lastFailed,
    retryLastFailed,
    isMobile,
    sendLabel,
    onArmFocusGuard,
    onRunFocusGuard,
    onTrySend,
    loggedIn,
    softWarn,
  } = props;

  void uiLang;

  const armRef = useRef(onArmFocusGuard);
  const runRef = useRef(onRunFocusGuard);
  const trySendRef = useRef(onTrySend);
  const sendPressLockRef = useRef(false);
  const sendPressUnlockTimerRef = useRef<number>(0);

  useEffect(() => {
    armRef.current = onArmFocusGuard;
    runRef.current = onRunFocusGuard;
    trySendRef.current = onTrySend;
  }, [onArmFocusGuard, onRunFocusGuard, onTrySend]);

  const canSendFromHero = Boolean(canSendNow);
  const canRetryLastFailed = Boolean(lastFailed) && !loading && !threadBusy;

  const composerPlaceholder = String(ui.placeholder ?? "").trim();
  const hasTypedInput = String(input ?? "").trim().length > 0;

  const desktopComposerFrameStyle = useMemo<React.CSSProperties>(() => {
    return {
      width: "100%",
      maxWidth: "100%",
      minWidth: 0,
      boxSizing: "border-box",
    };
  }, []);

  const desktopComposerContentStyle = useMemo<React.CSSProperties>(() => {
    return {
      width: "min(100%, var(--pcContentMax))",
      maxWidth: "var(--pcContentMax)",
      marginLeft: "auto",
      marginRight: "auto",
      minWidth: 0,
      boxSizing: "border-box",
    };
  }, []);

  const onPointerDownCapture = useCallback(() => {
    try {
      armRef.current?.();
    } catch {}
  }, []);

  const blurAfterSend = useCallback(() => {
    if (!isMobile) return;
    try {
      inputRef.current?.blur();
    } catch {}
  }, [isMobile, inputRef]);

  const unlockSendPress = useCallback(() => {
    sendPressLockRef.current = false;
    try {
      if (sendPressUnlockTimerRef.current) {
        window.clearTimeout(sendPressUnlockTimerRef.current);
      }
    } catch {}
    sendPressUnlockTimerRef.current = 0;
  }, []);

  const lockSendPressBriefly = useCallback(() => {
    sendPressLockRef.current = true;
    try {
      if (sendPressUnlockTimerRef.current) {
        window.clearTimeout(sendPressUnlockTimerRef.current);
      }
      sendPressUnlockTimerRef.current = window.setTimeout(() => {
        sendPressLockRef.current = false;
        sendPressUnlockTimerRef.current = 0;
      }, 320);
    } catch {
      sendPressLockRef.current = false;
      sendPressUnlockTimerRef.current = 0;
    }
  }, []);

  const doSend = useCallback(() => {
    if (!canSendFromHero) return;

    try {
      trySendRef.current?.();
    } catch {}

    blurAfterSend();
  }, [canSendFromHero, blurAfterSend]);

  const doSendFromPress = useCallback(
    (e?: React.SyntheticEvent) => {
      try {
        e?.preventDefault?.();
      } catch {}
      try {
        e?.stopPropagation?.();
      } catch {}

      if (!canSendFromHero) return;
      if (sendPressLockRef.current) return;

      lockSendPressBriefly();
      doSend();
    },
    [canSendFromHero, lockSendPressBriefly, doSend]
  );

  const syncInputFromChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      try {
        const el = e.currentTarget as HTMLTextAreaElement;
        setInput(String(el?.value ?? ""));
      } catch {
        setInput("");
      }
    },
    [setInput]
  );

  const syncInputFromComposeEnd = useCallback(
    (e: React.CompositionEvent<HTMLTextAreaElement>) => {
      try {
        const el = e.currentTarget as HTMLTextAreaElement;
        setInput(String(el?.value ?? ""));
      } catch {
        setInput("");
      }
    },
    [setInput]
  );

  const onFocus = useCallback(() => {
    try {
      runRef.current?.();
    } catch {}
  }, []);

  useEffect(() => {
    return () => {
      try {
        if (sendPressUnlockTimerRef.current) {
          window.clearTimeout(sendPressUnlockTimerRef.current);
        }
      } catch {}
      sendPressUnlockTimerRef.current = 0;
      sendPressLockRef.current = false;
    };
  }, []);

  const onKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      const ne = (e as any).nativeEvent as any;

      if (ne?.isComposing) return;
      if (composing) return;

      if (e.key !== "Enter") return;
      if (e.shiftKey) return;

      const allowSendOnThisEnter = !isMobile || e.ctrlKey || e.metaKey;
      if (!allowSendOnThisEnter) return;

      if (!canSendFromHero) return;

      e.preventDefault();
      doSend();
    },
    [composing, isMobile, canSendFromHero, doSend]
  );

  const sendBtnTitle = (() => {
    if (composing) {
      return uiLang === "en" ? "Confirm text before sending" : "確定してから送信できます";
    }
    if (!canSendFromHero || threadBusy || loading) {
      return "";
    }
    return "";
  })();

  const onSendButtonClick = useCallback(
    (e: React.MouseEvent<HTMLButtonElement>) => {
      doSendFromPress(e);
      unlockSendPress();
    },
    [doSendFromPress, unlockSendPress]
  );

  const onLoginClick = useCallback(() => {
    if (loggedIn) return;
    try {
      trySendRef.current?.();
    } catch {}
  }, [loggedIn]);

  return (
    <div
      className={styles.composer}
      ref={composerRef}
      aria-label="composer"
      data-loading={loading ? "1" : "0"}
    >
      {lastFailed ? (
        <div style={desktopComposerFrameStyle}>
          <div className={styles.composerTopRow} style={desktopComposerContentStyle}>
            <button
              className={`${styles.memBtn} ${styles.retryBtn}`}
              onClick={retryLastFailed}
              type="button"
              disabled={!canRetryLastFailed}
              aria-disabled={!canRetryLastFailed}
              title={lastFailed.errorText}
            >
              {ui.failed} {ui.retry}
            </button>
          </div>
        </div>
      ) : null}

      <div style={desktopComposerFrameStyle}>
        <div className={styles.composerInner} style={desktopComposerContentStyle}>
          <div className={styles.fieldWrap}>
            <textarea
              id="hopy-composer"
              name="message"
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="none"
              spellCheck={false}
              ref={inputRef}
              value={input}
              onChange={syncInputFromChange}
              placeholder={composerPlaceholder}
              className={styles.field}
              rows={1}
              onMouseDownCapture={onPointerDownCapture}
              onPointerDownCapture={onPointerDownCapture}
              onFocus={onFocus}
              onCompositionStart={undefined}
              onCompositionEnd={syncInputFromComposeEnd}
              onKeyDown={onKeyDown}
            />

            <button
              className={styles.sendInField}
              onClick={onSendButtonClick}
              disabled={!canSendFromHero}
              aria-disabled={!canSendFromHero}
              title={sendBtnTitle}
              type="button"
            >
              <span className={styles.srOnly}>{sendLabel}</span>
            </button>
          </div>

          {!loggedIn && softWarn && hasTypedInput ? (
            <div className={styles.composerTopRow} style={desktopComposerContentStyle}>
              <button className={styles.memBtn} onClick={onLoginClick} type="button">
                {ui.login}
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
});

export default ChatComposer;

/*
【このファイルの正式役割】
チャット入力欄の表示と、入力・フォーカス・送信操作を安全に受け持つ責務のファイルです。
*/

/*
【今回このファイルで修正したこと】
1. desktopComposerFrameStyle が isMobile によって undefined になる分岐を削除しました。
2. desktopComposerContentStyle が isMobile によって undefined になる分岐を削除しました。
3. SSR と client 初回描画で style 属性の有無がズレないようにしました。
4. 送信条件、再送条件、HOPY回答○、Compass、state_changed、DB には触っていません。
*/

/* /components/chat/view/ChatComposer.tsx */