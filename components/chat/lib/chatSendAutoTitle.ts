// /components/chat/lib/chatSendAutoTitle.ts
import type { SupabaseClient } from "@supabase/supabase-js";
import { renameThread } from "./threadApi";
import { buildAutoTitle, isDefaultThreadTitle, logWarn } from "./chatSendShared";
import type { ApiThread } from "./chatSendState";

type RenameGuardSet = Pick<Set<string>, "has" | "add" | "delete">;

export type ResolveSendAutoTitleArgs = {
  supabase: SupabaseClient;
  threadId: string;
  userText: string;
  serverTitle: string;
  renameGuardSet?: RenameGuardSet | null;
};

export type ResolveSendAutoTitleResult = {
  titleForUi: string;
  renamed: boolean;
  thread: ApiThread | null;
};

function buildResolveSendAutoTitleResult(
  titleForUi: string,
  renamed: boolean,
  thread: ApiThread | null,
): ResolveSendAutoTitleResult {
  return {
    titleForUi,
    renamed,
    thread,
  };
}

function releaseRenameGuard(
  renameGuardSet: RenameGuardSet | null | undefined,
  threadId: string,
) {
  try {
    renameGuardSet?.delete(threadId);
  } catch {}
}

function buildRenameFailedResult(
  renameGuardSet: RenameGuardSet | null | undefined,
  threadId: string,
): ResolveSendAutoTitleResult {
  releaseRenameGuard(renameGuardSet, threadId);
  return buildResolveSendAutoTitleResult("", false, null);
}

export async function resolveSendAutoTitle(
  args: ResolveSendAutoTitleArgs,
): Promise<ResolveSendAutoTitleResult> {
  const { supabase, renameGuardSet } = args;

  const threadId = String(args.threadId ?? "").trim();
  const userText = String(args.userText ?? "");
  const serverTitle = String(args.serverTitle ?? "").trim();

  if (!threadId) {
    return buildResolveSendAutoTitleResult(serverTitle, false, null);
  }

  const autoTitle = buildAutoTitle(userText);
  const needsAutoRename =
    Boolean(autoTitle) && isDefaultThreadTitle(serverTitle);

  if (!needsAutoRename) {
    return buildResolveSendAutoTitleResult(serverTitle, false, null);
  }

  try {
    if (renameGuardSet?.has(threadId)) {
      return buildResolveSendAutoTitleResult("", false, null);
    }
  } catch {}

  try {
    renameGuardSet?.add(threadId);
  } catch {}

  try {
    const result = await renameThread({
      supabase,
      threadId,
      nextTitle: autoTitle,
    });

    if (!result.ok) {
      logWarn("[chatSendAutoTitle] auto renameThread failed", {
        threadId,
        reason: result.error,
      });

      return buildRenameFailedResult(renameGuardSet, threadId);
    }

    const thread = (result.thread as ApiThread | null | undefined) ?? null;
    const titleForUi =
      String((thread as any)?.title ?? autoTitle).trim() || autoTitle;

    return buildResolveSendAutoTitleResult(titleForUi, true, thread);
  } catch (e) {
    logWarn("[chatSendAutoTitle] auto title resolve failed", {
      threadId,
      reason: String((e as any)?.message ?? e ?? ""),
    });

    return buildRenameFailedResult(renameGuardSet, threadId);
  }
}

/*
このファイルの正式役割
自動タイトルの専用子ファイル。
入力文から自動タイトル文言を生成し、
既定タイトルのときだけ renameThread を実行して、
UIへ返す最終タイトルを確定する。
*/

/*
【今回このファイルで修正したこと】
1. rename 失敗時に重複していた guard解除と失敗返却を buildRenameFailedResult に統一しました。
2. 戻り値オブジェクトの組み立てを buildResolveSendAutoTitleResult に統一しました。
3. 自動タイトル判定条件、rename 実行条件、HOPY唯一の正である confirmed payload / state_changed / HOPY回答○ / Compass / DB保存 / DB復元 / 1..5 の意味判定には触っていません。
*/

/* /components/chat/lib/chatSendAutoTitle.ts */