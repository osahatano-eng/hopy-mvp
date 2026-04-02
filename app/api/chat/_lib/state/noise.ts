// /app/api/chat/_lib/state/noise.ts
import type { Lang } from "../text";
import { envInt } from "../env";

/**
 * 短文でも意味がある「ACK系」をノイズ扱いしない
 * - UI/運用上よく出る: OK / はい / 了解 / ありがとう / thx / lol など
 */
function isAckMessage(noSpaceLower: string, uiLang: Lang) {
  if (!noSpaceLower) return false;

  if (uiLang === "ja") {
    const ackJa = [
      "ok",
      "おけ",
      "おっけー",
      "了解",
      "りょうかい",
      "承知",
      "はい",
      "うん",
      "そう",
      "それ",
      "よし",
      "助かる",
      "ありがとう",
      "ありがと",
      "感謝",
      "なるほど",
      "わかった",
      "わかりました",
      "お願いします",
    ];
    return ackJa.some((k) => noSpaceLower.includes(k));
  } else {
    const ackEn = [
      "ok",
      "okay",
      "k",
      "kk",
      "yes",
      "yep",
      "yeah",
      "sure",
      "thanks",
      "thx",
      "ty",
      "gotit",
      "roger",
      "understood",
      "makesense",
      "lol",
      "lmao",
      "nice",
    ];
    return ackEn.some((k) => noSpaceLower === k || noSpaceLower.includes(k));
  }
}

/**
 * 短くても意味がある「操作/コマンド/コード断片」をノイズ扱いしない
 * - `pnpmdev`, `npmrun`, `git...`, `route.ts`, `()` `{}` `=>` など
 */
function isShortButMeaningfulTech(noSpace: string) {
  const s = String(noSpace ?? "");
  if (!s) return false;

  // ファイル名/拡張子
  if (/\.(ts|tsx|js|jsx|json|css|md|env|sql|yml|yaml)$/i.test(s)) return true;

  // ありがちな短いコマンド断片
  const hints = [
    "npm",
    "pnpm",
    "yarn",
    "npx",
    "git",
    "node",
    "next",
    "bun",
    "dev",
    "build",
    "start",
    "run",
    "route",
  ];
  if (hints.some((h) => s.toLowerCase().includes(h))) return true;

  // 記号が多い＝コード/式の可能性
  const symbols = (s.match(/[{}()[\];<>:=+\-*/\\|&!?.,`"'@#$%^~]/g) ?? []).length;
  const nonSpace = s.length || 1;
  const symbolRatio = symbols / nonSpace;
  if (symbolRatio >= 0.25) return true;

  return false;
}

function hasJapaneseChars(s: string) {
  return /[ぁ-んァ-ン一-龠]/.test(String(s ?? ""));
}

/**
 * ✅ Phase1: 短い日本語でも「実体語っぽい」ものはノイズ扱いしない
 * - 例: 奈良公園 / 渋谷 / 転職 / 離婚 / 眠い など
 * - ACK系は除外（それは isAckMessage で処理）
 * - 記号だけ/数字だけは除外
 *
 * NOTE:
 * 形態素解析は入れない。Phase1は安定・軽量優先でヒューリスティック。
 */
function isShortMeaningfulJa(noSpace: string) {
  const s = String(noSpace ?? "");
  if (!s) return false;

  if (!hasJapaneseChars(s)) return false;

  // 数字だけは除外
  if (/^[0-9]+$/.test(s)) return false;

  // 記号だけは除外
  try {
    if (/^[\p{P}\p{S}]+$/u.test(s)) return false;
  } catch {
    if (/^[\-\+\=\*\#\@\!\?\.\,\:\;\(\)\[\]\{\}\/\\]+$/.test(s)) return false;
  }

  // 2文字以下は誤爆しやすいので除外（例: はい/うん等はACKで救済済み）
  if (s.length <= 2) return false;

  // 3〜5文字くらいの固有名詞/名詞が多いレンジを救済（奈良公園=4）
  // ただし長文は通常判定で十分なのでここでは短文だけ見る
  if (s.length <= 6) return true;

  return false;
}

export function noiseReason(text: string, uiLang: Lang): string | null {
  const s = String(text ?? "").trim();
  if (!s) return "empty";

  const noSpace = s.replace(/\s/g, "");
  const lower = noSpace.toLowerCase();

  // ✅ 短文でも意味があるケースは先に救済
  if (isAckMessage(lower, uiLang)) return null;
  if (isShortButMeaningfulTech(noSpace)) return null;

  // ✅ Phase1: 日本語の短い実体語救済（奈良公園など）
  if (uiLang === "ja" && isShortMeaningfulJa(noSpace)) return null;

  const minJa = envInt("HOPY_STATE_MIN_LEN_JA", 6);
  const minEn = envInt("HOPY_STATE_MIN_LEN_EN", 8);
  const minLen = uiLang === "ja" ? minJa : minEn;

  if (noSpace.length < minLen) return `too_short_${noSpace.length}`;

  // 記号だけ
  try {
    if (/^[\p{P}\p{S}]+$/u.test(noSpace)) return "punct_only";
  } catch {
    if (/^[\-\+\=\*\#\@\!\?\.\,\:\;\(\)\[\]\{\}\/\\]+$/.test(noSpace))
      return "punct_only";
  }

  // 同一文字の連打
  const repMin = envInt("HOPY_STATE_REPEAT_MIN", 4);
  if (repMin >= 2) {
    const m = noSpace.match(/(.)\1+/g);
    if (m && m.some((run) => run.length >= repMin)) return "repeated_char";
  }

  // vvvvvv みたいなやつ
  if (/^v+$/.test(lower)) return "v_only";

  return null;
}

export function isNoiseInput(text: string, uiLang: Lang) {
  const r = noiseReason(text, uiLang);
  return { noisy: !!r, reason: r };
}
