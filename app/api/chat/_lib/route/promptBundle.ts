// /app/api/chat/_lib/route/promptBundle.ts
import { buildPhaseSystem } from "../phase/system";
import { hopyPersonaSystem } from "../system/persona";
import type { Lang } from "../router/simpleRouter";
import type { LearningPromptContext } from "../hopy/learning/buildLearningPromptContext";
import {
  buildPromptProfile,
  type PromptProfile,
  type PromptVariant,
  type MemoryMode,
  type LearningMode,
  type ResolvedPlan,
} from "./promptProfile";
import {
  conversationStyleSystem,
  continuitySystem,
  antiPlatitudeSystem,
  outputComplianceSystem,
  replyLengthSystem,
  planMarkerSystem,
  planExperienceSystem,
  planDifferenceAnswerSystem,
  replyLanguageSystem,
  memoryOutputContractSystem,
} from "./promptTextSystems";
import {
  normalizePromptBlock,
  compactPromptBlock,
} from "./promptBlockUtils";
import { buildResolvedLearningBlock } from "./promptLearningUtils";
import {
  detectExplicitReplyLanguageRequest,
  isShortLowSignalEnglish,
  decideReplyLanguage,
} from "./promptLanguageUtils";
import { buildHopyPromptSections } from "./promptHopySections";

export type PromptBundle = {
  coreSystemPrompt: string;
  baseSystemPrompt: string;
  userPrompt: string;
  continuitySystemPrompt: string;
  personaSystemPrompt: string;
  styleSystemPrompt: string;
  antiPlatitudePrompt: string;
  complianceSystemPrompt: string;
  replyLanguageLockPrompt: string;
};

const MEDIUM_PROMPT_MAX_LINES = 9;
const MEDIUM_PROMPT_MAX_CHARS = 1000;
const SHORT_PROMPT_MAX_LINES = 5;
const SHORT_PROMPT_MAX_CHARS = 520;
const MEMORY_BLOCK_MAX_LINES = 8;
const MEMORY_BLOCK_MAX_CHARS = 900;
const LEARNING_BLOCK_MAX_LINES = 18;
const LEARNING_BLOCK_MAX_CHARS = 1400;

function joinPromptParts(
  parts: Array<string | null | undefined>,
  separator = "\n\n",
): string {
  return parts.filter(Boolean).join(separator);
}

function applyPromptVariant(args: {
  block: string;
  variant: PromptVariant;
  keepFirstLineAsHeader?: boolean;
}): string {
  const normalizedBlock = normalizePromptBlock(args.block);
  if (!normalizedBlock) return "";

  if (args.variant === "full") {
    return normalizedBlock;
  }

  if (args.variant === "medium") {
    return compactPromptBlock({
      block: normalizedBlock,
      maxLines: MEDIUM_PROMPT_MAX_LINES,
      maxChars: MEDIUM_PROMPT_MAX_CHARS,
      keepFirstLineAsHeader: args.keepFirstLineAsHeader,
    });
  }

  return compactPromptBlock({
    block: normalizedBlock,
    maxLines: SHORT_PROMPT_MAX_LINES,
    maxChars: SHORT_PROMPT_MAX_CHARS,
    keepFirstLineAsHeader: args.keepFirstLineAsHeader,
  });
}

function buildPromptSection(args: {
  parts: Array<string | null | undefined>;
  variant: PromptVariant;
  keepFirstLineAsHeader?: boolean;
  separator?: string;
}): string {
  return applyPromptVariant({
    block: joinPromptParts(args.parts, args.separator ?? "\n\n"),
    variant: args.variant,
    keepFirstLineAsHeader: args.keepFirstLineAsHeader,
  });
}

function buildSinglePromptSection(args: {
  block: string | null | undefined;
  variant: PromptVariant;
  keepFirstLineAsHeader?: boolean;
}): string {
  return applyPromptVariant({
    block: args.block ?? "",
    variant: args.variant,
    keepFirstLineAsHeader: args.keepFirstLineAsHeader,
  });
}

function compactProfileBlock(args: {
  block: string;
  maxLines: number;
  maxChars: number;
  keepFirstLineAsHeader: boolean;
}): string {
  const normalizedBlock = normalizePromptBlock(args.block);
  if (!normalizedBlock) return "";

  return compactPromptBlock({
    block: normalizedBlock,
    maxLines: args.maxLines,
    maxChars: args.maxChars,
    keepFirstLineAsHeader: args.keepFirstLineAsHeader,
  });
}

function buildMemoryBlockByProfile(args: {
  memoryBlock: string;
  memoryMode: MemoryMode;
}): string {
  if (args.memoryMode === "off") {
    return "";
  }

  if (!String(args.memoryBlock ?? "").trim()) {
    return "";
  }

  return compactProfileBlock({
    block: args.memoryBlock,
    maxLines: MEMORY_BLOCK_MAX_LINES,
    maxChars: MEMORY_BLOCK_MAX_CHARS,
    keepFirstLineAsHeader: false,
  });
}

function buildLearningBlockByProfile(args: {
  learningMode: LearningMode;
  learningBlock?: string;
  learningPromptContext?: LearningPromptContext | null;
}): string {
  if (args.learningMode === "off") {
    return "";
  }

  const resolvedLearningBlock = buildResolvedLearningBlock({
    learningBlock: args.learningBlock,
    learningPromptContext: args.learningPromptContext,
  });

  if (!String(resolvedLearningBlock ?? "").trim()) {
    return "";
  }

  return compactProfileBlock({
    block: resolvedLearningBlock,
    maxLines: LEARNING_BLOCK_MAX_LINES,
    maxChars: LEARNING_BLOCK_MAX_CHARS,
    keepFirstLineAsHeader: true,
  });
}

export {
  detectExplicitReplyLanguageRequest,
  isShortLowSignalEnglish,
  decideReplyLanguage,
};

export function buildPromptBundle(args: {
  resolvedPlan: ResolvedPlan;
  coreSystemPrompt: string;
  uiLang: Lang;
  replyLang: Lang;
  stateForSystem: any;
  memoryBlock: string;
  learningBlock?: string;
  learningPromptContext?: LearningPromptContext | null;
  userText: string;
  conversationId: string;
}): PromptBundle {
  const {
    resolvedPlan,
    coreSystemPrompt: rawCoreSystemPrompt,
    uiLang,
    replyLang,
    stateForSystem,
    memoryBlock,
    learningBlock,
    learningPromptContext,
    userText,
    conversationId,
  } = args;

  const profile: PromptProfile = buildPromptProfile(resolvedPlan);

  const normalizedMemoryBlock = buildMemoryBlockByProfile({
    memoryBlock,
    memoryMode: profile.memoryMode,
  });

  const normalizedLearningBlock = buildLearningBlockByProfile({
    learningMode: profile.learningMode,
    learningBlock,
    learningPromptContext,
  });

  const hopyPromptSections = buildHopyPromptSections({
    resolvedPlan,
    stateForSystem,
    userText,
    memoryBlock: normalizedMemoryBlock,
    learningBlock: normalizedLearningBlock,
  });

  return {
    coreSystemPrompt: buildPromptSection({
      parts: [rawCoreSystemPrompt, hopyPromptSections.hopyCoreSystemPrompt],
      variant: profile.coreVariant,
    }),
    baseSystemPrompt: joinPromptParts([
      buildPhaseSystem({
        uiLang: replyLang,
        state: stateForSystem,
        userText,
        conversationId,
      }),
      hopyPromptSections.hopyBaseSystemPrompt,
    ]),
    userPrompt: buildSinglePromptSection({
      block: hopyPromptSections.hopyUserPrompt,
      variant: profile.userPromptVariant,
    }),
    continuitySystemPrompt: buildSinglePromptSection({
      block: continuitySystem(replyLang),
      variant: profile.continuityVariant,
    }),
    personaSystemPrompt: buildSinglePromptSection({
      block: hopyPersonaSystem(replyLang),
      variant: profile.personaVariant,
    }),
    styleSystemPrompt: buildPromptSection({
      parts: [
        planMarkerSystem({
          uiLang: replyLang,
          resolvedPlan,
        }),
        conversationStyleSystem(replyLang),
        replyLengthSystem({
          uiLang: replyLang,
          replyLengthMode: profile.replyLengthMode,
        }),
        planExperienceSystem({
          uiLang: replyLang,
          resolvedPlan,
        }),
        planDifferenceAnswerSystem({
          uiLang: replyLang,
          resolvedPlan,
        }),
      ],
      variant: profile.styleVariant,
      separator: "\n\n",
    }),
    antiPlatitudePrompt: buildSinglePromptSection({
      block: antiPlatitudeSystem(replyLang),
      variant: profile.antiPlatitudeVariant,
    }),
    complianceSystemPrompt: buildPromptSection({
      parts: [
        outputComplianceSystem(replyLang),
        memoryOutputContractSystem(replyLang),
      ],
      variant: profile.complianceVariant,
      separator: "\n\n",
    }),
    replyLanguageLockPrompt: buildSinglePromptSection({
      block: replyLanguageSystem({
        uiLang,
        replyLang,
      }),
      variant: profile.replyLanguageLock,
    }),
  };
}