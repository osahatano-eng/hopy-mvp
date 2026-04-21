// /app/api/chat/_lib/system/persona.ts
/**
 * HOPY PERSONA (Conversation Layer)
 * --------------------------------
 * 目的:
 * - SYSTEM_CORE（憲法）とは別に、“会話で人を整える”ための人格・口調・振る舞いを固定する。
 * - route.ts が参照する persona layer の唯一の入口にする（変更時は明示的に管理する）。
 *
 * 注意:
 * - ここは安全・安定の最上位ではない（それは system.ts）。
 * - ただし、ユーザー体験の一貫性（HOPYの魅力）はここで担保する。
 * - タスク管理/将棋/ゲーム的な誘導ノリは禁止。会話の中に自然に溶かす。
 */

import { createHash } from "crypto";
import { hopyPersonaPrompt } from "../hopy/prompt/hopyPersonaPrompt";
import type { Lang } from "../router/simpleRouter";

/**
 * PERSONA_VERSION
 * - hopyPersonaSystem の内容が変わったら必ず上げる（破壊的変更でなくても）。
 * - BUILD_SIG / intervention_log の差分追跡に使える。
 */
export const PERSONA_VERSION = "1.2.0";

/**
 * personaPromptDigest
 * - persona を「意味ある固定値」にするための digest
 * - 監査・再現性のために利用できる。
 */
export function personaPromptDigest(uiLang: Lang): string {
  return sha256(`${PERSONA_VERSION}\n${hopyPersonaSystem(uiLang)}`);
}

/**
 * hopyPersonaSystem
 * - persona layer の唯一の入口。
 * - 人格文言そのものは hopyPersonaPrompt.ts に集約する。
 * - このファイルでは、文言を直接持たず、参照と digest 管理だけを担当する。
 */
export function hopyPersonaSystem(uiLang: Lang): string {
  return hopyPersonaPrompt(uiLang === "en" ? "en" : "ja");
}

/* ---------------- internal ---------------- */

function sha256(input: string) {
  return createHash("sha256").update(input, "utf8").digest("hex");
}

/*
このファイルの正式役割
HOPYの会話人格・口調・温度感・応答姿勢を固定する persona layer の唯一の入口。
人格文言そのものは /app/api/chat/_lib/hopy/prompt/hopyPersonaPrompt.ts に集約し、このファイルは参照・digest・version 管理だけを担当する。
DB、state_changed、state_level/current_phase、Compass、phase判定、response builder、保存復元処理は担当しない。
*/

/*
【今回このファイルで修正したこと】
- PERSONA_VERSION を 1.2.0 に更新した。
- persona.ts から人格文言の直書きを削除した。
- hopyPersonaPrompt.ts を参照する形に変更し、persona.ts を persona layer の入口責務だけへ戻した。
- HOPY人格文言を安全に編集できるよう、文言責務と入口責務を分離した。
*/

/* /app/api/chat/_lib/system/persona.ts */