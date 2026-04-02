// /components/chat/ui/LeftRailAccountSection.tsx

"use client";

import React from "react";
import { supabase } from "@/lib/supabaseClient";

type Props = {
  userState: unknown;
};

function readObject(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object") return null;
  return value as Record<string, unknown>;
}

function readString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function normalizePlanLabel(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return "";

  const lower = trimmed.toLowerCase();

  if (lower === "free") return "Free";
  if (lower === "plus") return "Plus";
  if (lower === "pro") return "Pro";

  return "";
}

function resolveFallbackUserDisplayInfo(userState: unknown): {
  displayName: string;
  avatarUrl: string;
  fallbackLetter: string;
} {
  const root = readObject(userState);
  const nestedUser = readObject(root?.user);
  const nestedProfile = readObject(root?.profile);

  const session = readObject(root?.session);
  const sessionUser = readObject(session?.user);
  const userMetadata = readObject(sessionUser?.user_metadata);

  const displayName =
    readString(userMetadata?.full_name) ||
    readString(userMetadata?.name) ||
    readString(userMetadata?.user_name) ||
    readString(userMetadata?.preferred_username) ||
    readString(sessionUser?.email) ||
    readString(root?.user_name) ||
    readString(root?.displayName) ||
    readString(root?.display_name) ||
    readString(root?.name) ||
    readString(root?.full_name) ||
    readString(root?.email) ||
    readString(nestedUser?.displayName) ||
    readString(nestedUser?.display_name) ||
    readString(nestedUser?.name) ||
    readString(nestedUser?.full_name) ||
    readString(nestedUser?.email) ||
    readString(nestedProfile?.displayName) ||
    readString(nestedProfile?.display_name) ||
    readString(nestedProfile?.name) ||
    readString(nestedProfile?.full_name) ||
    "";

  const avatarUrl =
    readString(userMetadata?.avatar_url) ||
    readString(userMetadata?.picture) ||
    readString(root?.user_image_url) ||
    readString(root?.avatarUrl) ||
    readString(root?.avatar_url) ||
    readString(root?.picture) ||
    readString(nestedUser?.user_image_url) ||
    readString(nestedUser?.avatarUrl) ||
    readString(nestedUser?.avatar_url) ||
    readString(nestedUser?.picture) ||
    readString(nestedProfile?.user_image_url) ||
    readString(nestedProfile?.avatarUrl) ||
    readString(nestedProfile?.avatar_url) ||
    readString(nestedProfile?.picture) ||
    "";

  const initialSource = displayName || "U";
  const fallbackLetter = initialSource.charAt(0).toUpperCase() || "U";

  return {
    displayName,
    avatarUrl,
    fallbackLetter,
  };
}

function buildAccountInfoFromSession(session: unknown): {
  displayName: string;
  avatarUrl: string;
  fallbackLetter: string;
  userId: string;
} {
  const sessionObj = readObject(session);
  const user = readObject(sessionObj?.user);
  const userMetadata = readObject(user?.user_metadata);

  const userId = readString(user?.id);
  const email = readString(user?.email);

  const displayName =
    readString(userMetadata?.full_name) ||
    readString(userMetadata?.name) ||
    readString(userMetadata?.user_name) ||
    readString(userMetadata?.preferred_username) ||
    email ||
    "";

  const avatarUrl =
    readString(userMetadata?.avatar_url) ||
    readString(userMetadata?.picture) ||
    "";

  const initialSource = displayName || "U";
  const fallbackLetter = initialSource.charAt(0).toUpperCase() || "U";

  return {
    displayName,
    avatarUrl,
    fallbackLetter,
    userId,
  };
}

export default function LeftRailAccountSection({ userState }: Props) {
  const fallbackUserDisplayInfo = React.useMemo(
    () => resolveFallbackUserDisplayInfo(userState),
    [userState]
  );

  const [accountInfo, setAccountInfo] = React.useState<{
    displayName: string;
    avatarUrl: string;
    fallbackLetter: string;
  }>(() => fallbackUserDisplayInfo);

  const [userPlanLabel, setUserPlanLabel] = React.useState<string>("");

  React.useEffect(() => {
    let mounted = true;

    async function syncBottomUserInfo() {
      try {
        const { data } = await supabase.auth.getSession();
        if (!mounted) return;

        const session = data?.session ?? null;
        const sessionAccount = buildAccountInfoFromSession(session);

        if (sessionAccount.displayName || sessionAccount.avatarUrl) {
          setAccountInfo({
            displayName: sessionAccount.displayName,
            avatarUrl: sessionAccount.avatarUrl,
            fallbackLetter: sessionAccount.fallbackLetter,
          });
        } else {
          setAccountInfo(fallbackUserDisplayInfo);
        }

        if (!sessionAccount.userId) {
          setUserPlanLabel("");
          return;
        }

        const { data: profileRow } = await supabase
          .from("profiles")
          .select("plan")
          .eq("user_id", sessionAccount.userId)
          .maybeSingle();

        if (!mounted) return;

        const nextPlan = normalizePlanLabel(readString(profileRow?.plan));
        setUserPlanLabel(nextPlan);
      } catch {
        if (!mounted) return;
        setAccountInfo(fallbackUserDisplayInfo);
        setUserPlanLabel("");
      }
    }

    syncBottomUserInfo();

    const { data: sub } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (!mounted) return;

      const sessionAccount = buildAccountInfoFromSession(session);

      if (sessionAccount.displayName || sessionAccount.avatarUrl) {
        setAccountInfo({
          displayName: sessionAccount.displayName,
          avatarUrl: sessionAccount.avatarUrl,
          fallbackLetter: sessionAccount.fallbackLetter,
        });
      } else {
        setAccountInfo(fallbackUserDisplayInfo);
      }

      if (!sessionAccount.userId) {
        setUserPlanLabel("");
        return;
      }

      try {
        const { data: profileRow } = await supabase
          .from("profiles")
          .select("plan")
          .eq("user_id", sessionAccount.userId)
          .maybeSingle();

        if (!mounted) return;

        const nextPlan = normalizePlanLabel(readString(profileRow?.plan));
        setUserPlanLabel(nextPlan);
      } catch {
        if (!mounted) return;
        setUserPlanLabel("");
      }
    });

    return () => {
      mounted = false;
      try {
        sub?.subscription?.unsubscribe();
      } catch {}
    };
  }, [fallbackUserDisplayInfo]);

  const userInfoWrapStyle = React.useMemo<React.CSSProperties>(
    () => ({
      marginTop: "auto",
      paddingTop: 10,
    }),
    []
  );

  const userInfoCardStyle = React.useMemo<React.CSSProperties>(
    () => ({
      display: "flex",
      flexDirection: "column",
      gap: 8,
      width: "100%",
      minWidth: 0,
      boxSizing: "border-box",
    }),
    []
  );

  const userInfoRowStyle = React.useMemo<React.CSSProperties>(
    () => ({
      display: "flex",
      alignItems: "center",
      gap: 10,
      width: "100%",
      minWidth: 0,
      borderRadius: 14,
      boxSizing: "border-box",
    }),
    []
  );

  const avatarWrapStyle = React.useMemo<React.CSSProperties>(
    () => ({
      width: 28,
      height: 28,
      minWidth: 28,
      borderRadius: "999px",
      overflow: "hidden",
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
      fontSize: 12,
      lineHeight: 1,
      fontWeight: 600,
      background: "rgba(15, 23, 42, 0.08)",
      color: "rgba(15, 23, 42, 0.82)",
      flexShrink: 0,
    }),
    []
  );

  const avatarImageStyle = React.useMemo<React.CSSProperties>(
    () => ({
      width: "100%",
      height: "100%",
      objectFit: "cover",
      display: "block",
    }),
    []
  );

  const userMetaStyle = React.useMemo<React.CSSProperties>(
    () => ({
      minWidth: 0,
      flex: "1 1 auto",
      display: "flex",
      alignItems: "center",
      gap: 8,
    }),
    []
  );

  const userNameStyle = React.useMemo<React.CSSProperties>(
    () => ({
      minWidth: 0,
      flex: "1 1 auto",
      overflow: "hidden",
      textOverflow: "ellipsis",
      whiteSpace: "nowrap",
    }),
    []
  );

  const userPlanStyle = React.useMemo<React.CSSProperties>(
    () => ({
      flexShrink: 0,
      opacity: 0.72,
      fontSize: 12,
      marginLeft: "auto",
    }),
    []
  );

  const betaNoticeStyle = React.useMemo<React.CSSProperties>(
    () => ({
      display: "flex",
      flexDirection: "column",
      gap: 2,
      paddingLeft: 38,
      lineHeight: 1.45,
      fontSize: 11,
      color: "rgba(15, 23, 42, 0.62)",
      wordBreak: "break-word",
    }),
    []
  );

  return (
    <div style={userInfoWrapStyle}>
      <div style={userInfoCardStyle}>
        <div style={userInfoRowStyle}>
          <div style={avatarWrapStyle} aria-hidden="true">
            {accountInfo.avatarUrl ? (
              <img src={accountInfo.avatarUrl} alt="" style={avatarImageStyle} />
            ) : (
              <span>{accountInfo.fallbackLetter}</span>
            )}
          </div>

          <div style={userMetaStyle}>
            <div style={userNameStyle} title={accountInfo.displayName || ""}>
              {accountInfo.displayName || ""}
            </div>
            <div style={userPlanStyle}>{userPlanLabel}</div>
          </div>
        </div>

        <div aria-label="Beta notice" style={betaNoticeStyle}>
          <div>HOPY is currently in beta.</div>
          <div>HOPYは現在β版です。改善を続けています。</div>
        </div>
      </div>
    </div>
  );
}

/*
このファイルの正式役割
LeftRail 最下部のアカウント表示責務だけを持ち、ユーザー名・アイコン・実プラン名の取得同期と表示を担当する。
状態の唯一の正は作らず、LeftRail 本体から受け取った userState を表示補助の fallback として使うだけに限定する。
*/

/*
【今回このファイルで修正したこと】
1. ユーザーアカウント行の下にβ版表記を追加しました。
2. 1行固定だった最下部表示を縦積み構造にして、少し高さが出るようにしました。
3. ユーザー名・アイコン・プラン取得同期の既存責務は変えていません。
*/