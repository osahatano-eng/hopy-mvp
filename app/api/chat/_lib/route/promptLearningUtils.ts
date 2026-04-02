// /app/api/chat/_lib/route/promptLearningUtils.ts
import { buildLearningInjectionBlock } from "../hopy/learning/buildLearningInjectionBlock";
import type { LearningPromptContext } from "../hopy/learning/buildLearningPromptContext";
import {
  normalizePromptBlock,
  compactPromptBlock,
} from "./promptBlockUtils";

const LEARNING_BLOCK_MAX_LINES = 18;
const LEARNING_BLOCK_MAX_CHARS = 1400;

type LearningLineCategory =
  | "avoid"
  | "support"
  | "closing"
  | "concreteness"
  | "temperature"
  | "effective"
  | "promote";

type LearningSectionSpec = {
  title: string;
  category: LearningLineCategory;
  limit: number;
};

const LEARNING_SECTION_SPECS: LearningSectionSpec[] = [
  {
    title: "避ける表現傾向:",
    category: "avoid",
    limit: 5,
  },
  {
    title: "優先する表現傾向:",
    category: "promote",
    limit: 5,
  },
  {
    title: "今の状態で有効な支え方:",
    category: "support",
    limit: 2,
  },
  {
    title: "締め方の好み:",
    category: "closing",
    limit: 2,
  },
  {
    title: "具体化の強さ:",
    category: "concreteness",
    limit: 1,
  },
  {
    title: "温度感:",
    category: "temperature",
    limit: 1,
  },
  {
    title: "刺さりやすかった傾向:",
    category: "effective",
    limit: 2,
  },
];

function splitLearningLines(block: string): string[] {
  return block
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}

function compactLearningBlock(block: string): string {
  return compactPromptBlock({
    block,
    maxLines: LEARNING_BLOCK_MAX_LINES,
    maxChars: LEARNING_BLOCK_MAX_CHARS,
    keepFirstLineAsHeader: true,
  });
}

function isLearningHeaderLine(line: string): boolean {
  return (
    line === "HOPY回答へ反映する学習知見:" ||
    line === "Learning insights to reflect in HOPY answers:"
  );
}

function isLearningSectionHeaderLine(line: string): boolean {
  return (
    line === "避ける表現傾向:" ||
    line === "優先する表現傾向:" ||
    line === "今の状態で有効な支え方:" ||
    line === "締め方の好み:" ||
    line === "具体化の強さ:" ||
    line === "温度感:" ||
    line === "刺さりやすかった傾向:" ||
    line === "Avoid patterns:" ||
    line === "Preferred expression tendencies:" ||
    line === "Support guidance for current state:" ||
    line === "Closing preferences:" ||
    line === "Concreteness guidance:" ||
    line === "Emotional temperature guidance:" ||
    line === "Effective response signals:"
  );
}

function stripLearningBullet(line: string): string {
  return line.replace(/^[-・]\s*/, "").trim();
}

function uniqueLines(lines: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const line of lines) {
    const normalized = stripLearningBullet(line);
    if (!normalized) continue;
    if (seen.has(normalized)) continue;
    seen.add(normalized);
    result.push(normalized);
  }

  return result;
}

function lineIncludesAny(line: string, keywords: string[]): boolean {
  const normalized = stripLearningBullet(line).toLowerCase();
  return keywords.some((keyword) => normalized.includes(keyword.toLowerCase()));
}

function isAvoidLearningLine(line: string): boolean {
  return lineIncludesAny(line, [
    "避ける",
    "回避",
    "禁止",
    "aiっぽ",
    "ai っぽ",
    "抽象",
    "きれいすぎ",
    "美文",
    "比喩",
    "avoid",
    "forbidden",
    "anti",
    "generic",
    "platitude",
    "stock abstraction",
  ]);
}

function isClosingLearningLine(line: string): boolean {
  return lineIncludesAny(line, [
    "締め",
    "締め方",
    "終わり方",
    "最後",
    "closing",
    "end with",
  ]);
}

function isConcretenessLearningLine(line: string): boolean {
  return lineIncludesAny(line, [
    "具体",
    "具体化",
    "抽象だけで終わらない",
    "1つか2つ",
    "少し具体",
    "concrete",
    "concreteness",
    "specific",
  ]);
}

function isTemperatureLearningLine(line: string): boolean {
  return lineIncludesAny(line, [
    "温度",
    "熱量",
    "距離感",
    "明るすぎ",
    "冷たすぎ",
    "やわらか",
    "冷静",
    "temperature",
    "warmth",
    "tone",
  ]);
}

function isEffectiveSignalLearningLine(line: string): boolean {
  return lineIncludesAny(line, [
    "反応がよい",
    "評価が高い",
    "入りやすい",
    "刺さりやすい",
    "効果",
    "signal",
    "effective",
    "works well",
    "responds well",
  ]);
}

function isSupportLearningLine(line: string): boolean {
  return lineIncludesAny(line, [
    "支え",
    "支援",
    "提案",
    "放置感",
    "受け止めだけで終わらず",
    "小さな進み方",
    "始めやすい",
    "state",
    "混線",
    "模索",
    "整理",
    "収束",
    "決定",
    "support",
    "guidance",
  ]);
}

function classifyLearningLine(line: string): LearningLineCategory {
  if (isAvoidLearningLine(line)) return "avoid";
  if (isSupportLearningLine(line)) return "support";
  if (isClosingLearningLine(line)) return "closing";
  if (isConcretenessLearningLine(line)) return "concreteness";
  if (isTemperatureLearningLine(line)) return "temperature";
  if (isEffectiveSignalLearningLine(line)) return "effective";
  return "promote";
}

function takeFirst(lines: string[], limit: number): string[] {
  return lines.slice(0, limit);
}

function pushLearningSection(args: {
  orderedSections: string[];
  title: string;
  lines: string[];
  limit: number;
}): void {
  if (args.lines.length <= 0) return;
  args.orderedSections.push(args.title);
  args.orderedSections.push(
    ...takeFirst(args.lines, args.limit).map((line) => `- ${line}`),
  );
}

export function buildOrderedLearningBlock(block: string): string {
  const normalizedBlock = normalizePromptBlock(block);
  if (!normalizedBlock) return "";

  const lines = splitLearningLines(normalizedBlock);
  if (lines.length <= 0) return "";

  const bodyLines = uniqueLines(
    lines.filter(
      (line) =>
        !isLearningHeaderLine(line) && !isLearningSectionHeaderLine(line),
    ),
  );

  if (bodyLines.length <= 0) {
    return compactLearningBlock(normalizedBlock);
  }

  const categorizedLines: Record<LearningLineCategory, string[]> = {
    avoid: [],
    support: [],
    closing: [],
    concreteness: [],
    temperature: [],
    effective: [],
    promote: [],
  };

  for (const line of bodyLines) {
    categorizedLines[classifyLearningLine(line)].push(line);
  }

  const orderedSections: string[] = [];

  for (const section of LEARNING_SECTION_SPECS) {
    pushLearningSection({
      orderedSections,
      title: section.title,
      lines: categorizedLines[section.category],
      limit: section.limit,
    });
  }

  if (orderedSections.length <= 0) {
    return compactLearningBlock(normalizedBlock);
  }

  return compactLearningBlock(
    ["HOPY回答へ反映する学習知見:", ...orderedSections].join("\n"),
  );
}

export function ensureLearningBlockHeader(block: string): string {
  const normalizedBlock = normalizePromptBlock(block);
  if (!normalizedBlock) return "";
  const lines = splitLearningLines(normalizedBlock);
  if (lines.length <= 0) return "";
  if (isLearningHeaderLine(lines[0])) {
    return compactLearningBlock(normalizedBlock);
  }
  return compactLearningBlock(
    ["HOPY回答へ反映する学習知見:", normalizedBlock].join("\n"),
  );
}

export function buildResolvedLearningBlock(args: {
  learningBlock?: string;
  learningPromptContext?: LearningPromptContext | null;
}): string {
  if (args.learningPromptContext) {
    return ensureLearningBlockHeader(
      buildLearningInjectionBlock({
        context: args.learningPromptContext,
      }),
    );
  }

  return buildOrderedLearningBlock(args.learningBlock ?? "");
}

/*
このファイルの正式役割:
learningBlock または learningPromptContext から、
HOPY回答へ反映する学習知見ブロックを整形・分類・順序化して返すファイル。
header 補完、重複行整理、カテゴリ別の並び替え、行数/文字数圧縮を担う。
このファイルは learning 情報の保存責務を持たず、回答用 prompt に載せる整形責務だけを持つ。
*/

/*
【今回このファイルで修正したこと】
- buildResolvedLearningBlock の末尾で、normalizePromptBlock を先に通してから buildOrderedLearningBlock に渡していた二重 normalize をやめました。
- buildOrderedLearningBlock 側が normalizePromptBlock を正式責務として持っているため、呼び出し元では生の learningBlock をそのまま渡す形にそろえました。
- learningPromptContext 優先、header 補完、カテゴリ分類、compact の流れは触っていません。
*/