import { describe, it, expect } from "vitest";
import {
  computeEMA,
  getDefaultSkillModel,
  computeDifficultyTransition,
  updateSkillModel,
  type SkillModelRecord,
  type SessionResult,
} from "@/lib/adaptive";

describe("computeEMA", () => {
  it("computes basic EMA with default alpha", () => {
    // alpha=0.3: 0.3 * 100 + 0.7 * 50 = 30 + 35 = 65
    expect(computeEMA(50, 100)).toBeCloseTo(65);
  });

  it("uses default alpha of 0.3", () => {
    const result = computeEMA(40, 60);
    // 0.3 * 60 + 0.7 * 40 = 18 + 28 = 46
    expect(result).toBeCloseTo(46);
  });

  it("accepts custom alpha", () => {
    const result = computeEMA(40, 60, 0.5);
    // 0.5 * 60 + 0.5 * 40 = 50
    expect(result).toBeCloseTo(50);
  });
});

describe("getDefaultSkillModel", () => {
  it("returns correct defaults for a language", () => {
    const model = getDefaultSkillModel("javascript");
    expect(model).toEqual({
      language: "javascript",
      estimatedWpm: 40,
      estimatedAccuracy: 0.85,
      currentDifficulty: "easy",
      confidenceLevel: 0,
      sessionCount: 0,
      consecutivePromotions: 0,
      consecutiveDemotions: 0,
    });
  });
});

describe("computeDifficultyTransition", () => {
  const baseModel: SkillModelRecord = {
    language: "javascript",
    estimatedWpm: 50,
    estimatedAccuracy: 0.9,
    currentDifficulty: "easy",
    confidenceLevel: 0.6,
    sessionCount: 15,
    consecutivePromotions: 2,
    consecutiveDemotions: 0,
  };

  it("promotes after 3 consecutive good sessions", () => {
    const result: SessionResult = { wpm: 55, accuracy: 0.95, difficulty: "easy" };
    const transition = computeDifficultyTransition(baseModel, result);
    expect(transition).toEqual({ newDifficulty: "medium", reason: "promoted" });
  });

  it("does not promote if accuracy too low", () => {
    const result: SessionResult = { wpm: 55, accuracy: 0.90, difficulty: "easy" };
    const transition = computeDifficultyTransition(baseModel, result);
    expect(transition).toEqual({ newDifficulty: "easy", reason: "unchanged" });
  });

  it("does not promote if wpm too low", () => {
    const result: SessionResult = { wpm: 40, accuracy: 0.95, difficulty: "easy" };
    // 40 < 50 * 0.9 = 45
    const transition = computeDifficultyTransition(baseModel, result);
    expect(transition).toEqual({ newDifficulty: "easy", reason: "unchanged" });
  });

  it("does not promote if confidence too low", () => {
    const lowConfModel = { ...baseModel, confidenceLevel: 0.3 };
    const result: SessionResult = { wpm: 55, accuracy: 0.95, difficulty: "easy" };
    const transition = computeDifficultyTransition(lowConfModel, result);
    expect(transition).toEqual({ newDifficulty: "easy", reason: "unchanged" });
  });

  it("does not promote if not enough consecutive promotions", () => {
    const lowStreakModel = { ...baseModel, consecutivePromotions: 1 };
    const result: SessionResult = { wpm: 55, accuracy: 0.95, difficulty: "easy" };
    const transition = computeDifficultyTransition(lowStreakModel, result);
    expect(transition).toEqual({ newDifficulty: "easy", reason: "unchanged" });
  });

  it("demotes after 2 consecutive bad sessions (low accuracy)", () => {
    const model: SkillModelRecord = {
      ...baseModel,
      currentDifficulty: "medium",
      consecutivePromotions: 0,
      consecutiveDemotions: 1,
    };
    const result: SessionResult = { wpm: 55, accuracy: 0.70, difficulty: "medium" };
    const transition = computeDifficultyTransition(model, result);
    expect(transition).toEqual({ newDifficulty: "easy", reason: "demoted" });
  });

  it("demotes after 2 consecutive bad sessions (low wpm)", () => {
    const model: SkillModelRecord = {
      ...baseModel,
      currentDifficulty: "hard",
      consecutivePromotions: 0,
      consecutiveDemotions: 1,
    };
    const result: SessionResult = { wpm: 30, accuracy: 0.85, difficulty: "hard" };
    // 30 < 50 * 0.7 = 35
    const transition = computeDifficultyTransition(model, result);
    expect(transition).toEqual({ newDifficulty: "medium", reason: "demoted" });
  });

  it("does not demote if only 1 consecutive bad session", () => {
    const model: SkillModelRecord = {
      ...baseModel,
      currentDifficulty: "medium",
      consecutivePromotions: 0,
      consecutiveDemotions: 0,
    };
    const result: SessionResult = { wpm: 55, accuracy: 0.70, difficulty: "medium" };
    const transition = computeDifficultyTransition(model, result);
    expect(transition).toEqual({ newDifficulty: "medium", reason: "unchanged" });
  });

  it("clamps at hard boundary (cannot promote above hard)", () => {
    const model: SkillModelRecord = {
      ...baseModel,
      currentDifficulty: "hard",
      consecutivePromotions: 2,
    };
    const result: SessionResult = { wpm: 55, accuracy: 0.95, difficulty: "hard" };
    const transition = computeDifficultyTransition(model, result);
    expect(transition).toEqual({ newDifficulty: "hard", reason: "unchanged" });
  });

  it("clamps at easy boundary (cannot demote below easy)", () => {
    const model: SkillModelRecord = {
      ...baseModel,
      currentDifficulty: "easy",
      consecutivePromotions: 0,
      consecutiveDemotions: 1,
    };
    const result: SessionResult = { wpm: 30, accuracy: 0.70, difficulty: "easy" };
    const transition = computeDifficultyTransition(model, result);
    expect(transition).toEqual({ newDifficulty: "easy", reason: "unchanged" });
  });

  it("returns unchanged when performance is mixed", () => {
    const result: SessionResult = { wpm: 48, accuracy: 0.88, difficulty: "easy" };
    const model: SkillModelRecord = {
      ...baseModel,
      consecutivePromotions: 0,
      consecutiveDemotions: 0,
    };
    const transition = computeDifficultyTransition(model, result);
    expect(transition).toEqual({ newDifficulty: "easy", reason: "unchanged" });
  });
});

describe("updateSkillModel", () => {
  const defaultModel = getDefaultSkillModel("javascript");

  it("updates EMA for wpm and accuracy", () => {
    const result: SessionResult = { wpm: 60, accuracy: 0.95, difficulty: "easy" };
    const updated = updateSkillModel(defaultModel, result);
    // EMA: 0.3 * 60 + 0.7 * 40 = 46
    expect(updated.estimatedWpm).toBeCloseTo(46);
    // EMA: 0.3 * 0.95 + 0.7 * 0.85 = 0.88
    expect(updated.estimatedAccuracy).toBeCloseTo(0.88);
  });

  it("increments session count", () => {
    const result: SessionResult = { wpm: 50, accuracy: 0.90, difficulty: "easy" };
    const updated = updateSkillModel(defaultModel, result);
    expect(updated.sessionCount).toBe(1);
  });

  it("updates confidence based on new session count", () => {
    const result: SessionResult = { wpm: 50, accuracy: 0.90, difficulty: "easy" };
    const updated = updateSkillModel(defaultModel, result);
    // new sessionCount = 1, confidence = min(1, 1/20) = 0.05
    expect(updated.confidenceLevel).toBeCloseTo(0.05);
  });

  it("caps confidence at 1", () => {
    const model: SkillModelRecord = { ...defaultModel, sessionCount: 25 };
    const result: SessionResult = { wpm: 50, accuracy: 0.90, difficulty: "easy" };
    const updated = updateSkillModel(model, result);
    expect(updated.confidenceLevel).toBe(1);
  });

  it("increments consecutivePromotions on good performance", () => {
    const result: SessionResult = { wpm: 50, accuracy: 0.95, difficulty: "easy" };
    // wpm 50 > 40 * 0.9 = 36, accuracy 0.95 > 0.92
    const updated = updateSkillModel(defaultModel, result);
    expect(updated.consecutivePromotions).toBe(1);
    expect(updated.consecutiveDemotions).toBe(0);
  });

  it("increments consecutiveDemotions on bad performance", () => {
    const result: SessionResult = { wpm: 20, accuracy: 0.70, difficulty: "easy" };
    const updated = updateSkillModel(defaultModel, result);
    expect(updated.consecutiveDemotions).toBe(1);
    expect(updated.consecutivePromotions).toBe(0);
  });

  it("resets both counters on mixed performance", () => {
    const model: SkillModelRecord = {
      ...defaultModel,
      consecutivePromotions: 2,
      consecutiveDemotions: 0,
    };
    const result: SessionResult = { wpm: 50, accuracy: 0.88, difficulty: "easy" };
    const updated = updateSkillModel(model, result);
    expect(updated.consecutivePromotions).toBe(0);
    expect(updated.consecutiveDemotions).toBe(0);
  });

  it("does not mutate the original model", () => {
    const result: SessionResult = { wpm: 60, accuracy: 0.95, difficulty: "easy" };
    const updated = updateSkillModel(defaultModel, result);
    expect(updated).not.toBe(defaultModel);
    expect(defaultModel.sessionCount).toBe(0);
  });

  it("completes full promotion flow after 3 good sessions", () => {
    let model = getDefaultSkillModel("python");
    // Need confidence > 0.5, so set sessionCount high enough
    model = { ...model, sessionCount: 15, confidenceLevel: 0.75 };

    const goodResult: SessionResult = { wpm: 60, accuracy: 0.95, difficulty: "easy" };

    // Session 1
    model = updateSkillModel(model, goodResult);
    expect(model.consecutivePromotions).toBe(1);
    expect(model.currentDifficulty).toBe("easy");

    // Session 2
    model = updateSkillModel(model, goodResult);
    expect(model.consecutivePromotions).toBe(2);
    expect(model.currentDifficulty).toBe("easy");

    // Session 3 - should promote
    model = updateSkillModel(model, goodResult);
    expect(model.consecutivePromotions).toBe(3);
    expect(model.currentDifficulty).toBe("medium");
  });

  it("completes full demotion flow after 2 bad sessions", () => {
    let model: SkillModelRecord = {
      ...getDefaultSkillModel("python"),
      currentDifficulty: "medium",
      sessionCount: 10,
    };

    const badResult: SessionResult = { wpm: 20, accuracy: 0.70, difficulty: "medium" };

    // Session 1
    model = updateSkillModel(model, badResult);
    expect(model.consecutiveDemotions).toBe(1);
    expect(model.currentDifficulty).toBe("medium");

    // Session 2 - should demote
    model = updateSkillModel(model, badResult);
    expect(model.consecutiveDemotions).toBe(2);
    expect(model.currentDifficulty).toBe("easy");
  });
});
