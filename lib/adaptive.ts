import type { Difficulty } from "@/lib/snippets";

export type SessionResult = {
  wpm: number;
  accuracy: number;
  difficulty: Difficulty;
};

export type SkillModelRecord = {
  language: string;
  estimatedWpm: number;
  estimatedAccuracy: number;
  currentDifficulty: Difficulty;
  confidenceLevel: number;
  sessionCount: number;
  consecutivePromotions: number;
  consecutiveDemotions: number;
};

export type DifficultyTransition = {
  newDifficulty: Difficulty;
  reason: "promoted" | "demoted" | "unchanged";
};

const DIFFICULTY_ORDER: readonly Difficulty[] = ["easy", "medium", "hard"];

export function describeDifficultyTransition(
  previousDifficulty: Difficulty,
  newDifficulty: Difficulty
): DifficultyTransition {
  const previousIndex = DIFFICULTY_ORDER.indexOf(previousDifficulty);
  const nextIndex = DIFFICULTY_ORDER.indexOf(newDifficulty);

  if (previousIndex === nextIndex) {
    return { newDifficulty, reason: "unchanged" };
  }

  return {
    newDifficulty,
    reason: nextIndex > previousIndex ? "promoted" : "demoted",
  };
}

export function computeEMA(
  previous: number,
  latest: number,
  alpha: number = 0.3
): number {
  return alpha * latest + (1 - alpha) * previous;
}

export function getDefaultSkillModel(language: string): SkillModelRecord {
  return {
    language,
    estimatedWpm: 40,
    estimatedAccuracy: 0.85,
    currentDifficulty: "easy",
    confidenceLevel: 0,
    sessionCount: 0,
    consecutivePromotions: 0,
    consecutiveDemotions: 0,
  };
}

export function computeDifficultyTransition(
  model: SkillModelRecord,
  result: SessionResult
): DifficultyTransition {
  const currentIndex = DIFFICULTY_ORDER.indexOf(model.currentDifficulty);

  const wouldPromote =
    result.accuracy > 0.92 &&
    result.wpm > model.estimatedWpm * 0.9 &&
    model.consecutivePromotions >= 2 &&
    model.confidenceLevel > 0.5;

  if (wouldPromote && currentIndex < DIFFICULTY_ORDER.length - 1) {
    return {
      newDifficulty: DIFFICULTY_ORDER[currentIndex + 1],
      reason: "promoted",
    };
  }

  const isBadPerformance =
    result.accuracy < 0.78 || result.wpm < model.estimatedWpm * 0.7;
  const wouldDemote = isBadPerformance && model.consecutiveDemotions >= 1;

  if (wouldDemote && currentIndex > 0) {
    return {
      newDifficulty: DIFFICULTY_ORDER[currentIndex - 1],
      reason: "demoted",
    };
  }

  return {
    newDifficulty: model.currentDifficulty,
    reason: "unchanged",
  };
}

export function updateSkillModel(
  model: SkillModelRecord,
  result: SessionResult
): SkillModelRecord {
  const newSessionCount = model.sessionCount + 1;

  const isGood =
    result.accuracy > 0.92 && result.wpm > model.estimatedWpm * 0.9;
  const isBad =
    result.accuracy < 0.78 || result.wpm < model.estimatedWpm * 0.7;

  let consecutivePromotions: number;
  let consecutiveDemotions: number;

  if (isGood) {
    consecutivePromotions = model.consecutivePromotions + 1;
    consecutiveDemotions = 0;
  } else if (isBad) {
    consecutiveDemotions = model.consecutiveDemotions + 1;
    consecutivePromotions = 0;
  } else {
    consecutivePromotions = 0;
    consecutiveDemotions = 0;
  }

  const transitionModel: SkillModelRecord = {
    language: model.language,
    estimatedWpm: computeEMA(model.estimatedWpm, result.wpm),
    estimatedAccuracy: computeEMA(model.estimatedAccuracy, result.accuracy),
    currentDifficulty: model.currentDifficulty,
    confidenceLevel: Math.min(1, newSessionCount / 20),
    sessionCount: newSessionCount,
    consecutivePromotions,
    consecutiveDemotions,
  };

  const transition = computeDifficultyTransition(transitionModel, result);
  return {
    ...transitionModel,
    consecutivePromotions,
    consecutiveDemotions,
    currentDifficulty: transition.newDifficulty,
  };
}
