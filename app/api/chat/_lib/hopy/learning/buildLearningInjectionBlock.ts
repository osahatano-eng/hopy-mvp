// /app/api/chat/_lib/hopy/learning/buildLearningInjectionBlock.ts
import type { LearningPromptContext } from "./buildLearningPromptContext";

export type BuildLearningInjectionBlockParams = {
  context: LearningPromptContext;
  maxLinesPerCategory?: number;
};

const DEFAULT_MAX_LINES_PER_CATEGORY = 2;
const MAX_TOTAL_LINES = 8;

type SectionInput = {
  title: string;
  lines: string[];
};

function normalizeMaxLines(value?: number): number {
  if (!Number.isFinite(value)) return DEFAULT_MAX_LINES_PER_CATEGORY;
  const safe = Math.floor(value as number);
  if (safe <= 0) return DEFAULT_MAX_LINES_PER_CATEGORY;
  return safe;
}

function normalizeLine(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function dedupeAndNormalizeLines(lines: string[]): string[] {
  const result: string[] = [];
  const seen = new Set<string>();

  for (const line of lines) {
    const normalized = normalizeLine(line);
    if (!normalized) continue;
    if (seen.has(normalized)) continue;
    seen.add(normalized);
    result.push(normalized);
  }

  return result;
}

function takeLines(lines: string[], maxLines: number): string[] {
  return dedupeAndNormalizeLines(lines).slice(0, maxLines);
}

function buildSection(title: string, lines: string[]): string {
  if (lines.length === 0) return "";
  return [title, ...lines.map((line) => `- ${line}`)].join("\n");
}

function buildSectionInputs(context: LearningPromptContext): SectionInput[] {
  return [
    {
      title: "避ける表現傾向:",
      lines: context.avoidPatterns,
    },
    {
      title: "優先する表現傾向:",
      lines: context.preferredExpressions,
    },
    {
      title: "今の状態で有効な支え方:",
      lines: context.supportGuidance,
    },
    {
      title: "締め方の好み:",
      lines: context.closingPreferences,
    },
    {
      title: "具体化の強さ:",
      lines: context.concretenessGuidance,
    },
    {
      title: "温度感:",
      lines: context.emotionalTemperatureGuidance,
    },
    {
      title: "刺さりやすかった傾向:",
      lines: context.effectiveSignals,
    },
  ];
}

function allocateLines(
  sections: SectionInput[],
  maxLinesPerCategory: number,
): Array<{ title: string; lines: string[] }> {
  const prepared = sections
    .map((section) => ({
      title: section.title,
      lines: takeLines(section.lines, maxLinesPerCategory),
    }))
    .filter((section) => section.lines.length > 0);

  if (prepared.length === 0) {
    return [];
  }

  const allocated = prepared.map((section) => ({
    title: section.title,
    lines: [] as string[],
    source: section.lines,
  }));

  let used = 0;

  for (const section of allocated) {
    if (used >= MAX_TOTAL_LINES) break;
    if (section.source.length === 0) continue;
    section.lines.push(section.source[0]);
    used += 1;
  }

  if (used >= MAX_TOTAL_LINES) {
    return allocated.map(({ title, lines }) => ({ title, lines }));
  }

  let progressed = true;
  while (used < MAX_TOTAL_LINES && progressed) {
    progressed = false;

    for (const section of allocated) {
      if (used >= MAX_TOTAL_LINES) break;
      if (section.lines.length >= section.source.length) continue;
      section.lines.push(section.source[section.lines.length]);
      used += 1;
      progressed = true;
    }
  }

  return allocated.map(({ title, lines }) => ({ title, lines }));
}

export function buildLearningInjectionBlock({
  context,
  maxLinesPerCategory,
}: BuildLearningInjectionBlockParams): string {
  const resolvedMaxLines = normalizeMaxLines(maxLinesPerCategory);
  const allocatedSections = allocateLines(
    buildSectionInputs(context),
    resolvedMaxLines,
  );

  return allocatedSections
    .map((section) => buildSection(section.title, section.lines))
    .filter(Boolean)
    .join("\n\n")
    .trim();
}

export default buildLearningInjectionBlock;