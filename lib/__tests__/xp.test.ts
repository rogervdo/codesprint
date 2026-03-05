import { describe, it, expect } from "vitest";
import { computeSessionXp, xpRequiredForLevel, computeLevelFromXp } from "../xp";

describe("computeSessionXp", () => {
    it("computes XP with default multipliers (easy, short, low accuracy)", () => {
        const result = computeSessionXp({
            wpm: 60,
            accuracy: 0.9,
            difficulty: "easy",
            lengthCategory: "short",
        });
        // base=10, wpmBonus=30, accuracyBonus=0, difficultyMult=1, lengthMult=1
        // (10 + 30 + 0) * 1 * 1 = 40
        expect(result.sessionXp).toBe(40);
        expect(result.breakdown).toEqual({
            base: 10,
            wpmBonus: 30,
            accuracyBonus: 0,
            difficultyMult: 1,
            lengthMult: 1,
        });
    });

    it("awards accuracy bonus when accuracy > 0.95", () => {
        const result = computeSessionXp({
            wpm: 60,
            accuracy: 0.96,
            difficulty: "easy",
            lengthCategory: "short",
        });
        // (10 + 30 + 20) * 1 * 1 = 60
        expect(result.sessionXp).toBe(60);
        expect(result.breakdown.accuracyBonus).toBe(20);
    });

    it("does not award accuracy bonus at exactly 0.95", () => {
        const result = computeSessionXp({
            wpm: 60,
            accuracy: 0.95,
            difficulty: "easy",
            lengthCategory: "short",
        });
        expect(result.breakdown.accuracyBonus).toBe(0);
    });

    it("applies medium difficulty multiplier", () => {
        const result = computeSessionXp({
            wpm: 60,
            accuracy: 0.9,
            difficulty: "medium",
            lengthCategory: "short",
        });
        // (10 + 30 + 0) * 1.5 * 1 = 60
        expect(result.sessionXp).toBe(60);
        expect(result.breakdown.difficultyMult).toBe(1.5);
    });

    it("applies hard difficulty multiplier", () => {
        const result = computeSessionXp({
            wpm: 60,
            accuracy: 0.9,
            difficulty: "hard",
            lengthCategory: "short",
        });
        // (10 + 30 + 0) * 2 * 1 = 80
        expect(result.sessionXp).toBe(80);
        expect(result.breakdown.difficultyMult).toBe(2);
    });

    it("applies medium length multiplier", () => {
        const result = computeSessionXp({
            wpm: 60,
            accuracy: 0.9,
            difficulty: "easy",
            lengthCategory: "medium",
        });
        // (10 + 30 + 0) * 1 * 1.3 = 52
        expect(result.sessionXp).toBe(52);
        expect(result.breakdown.lengthMult).toBe(1.3);
    });

    it("applies long length multiplier", () => {
        const result = computeSessionXp({
            wpm: 60,
            accuracy: 0.9,
            difficulty: "easy",
            lengthCategory: "long",
        });
        // (10 + 30 + 0) * 1 * 1.6 = 64
        expect(result.sessionXp).toBe(64);
        expect(result.breakdown.lengthMult).toBe(1.6);
    });

    it("applies combo multipliers (hard + long + high accuracy)", () => {
        const result = computeSessionXp({
            wpm: 100,
            accuracy: 0.98,
            difficulty: "hard",
            lengthCategory: "long",
        });
        // base=10, wpmBonus=50, accuracyBonus=20
        // (10 + 50 + 20) * 2 * 1.6 = 80 * 3.2 = 256
        expect(result.sessionXp).toBe(256);
    });

    it("rounds sessionXp to nearest integer", () => {
        const result = computeSessionXp({
            wpm: 33,
            accuracy: 0.9,
            difficulty: "medium",
            lengthCategory: "medium",
        });
        // base=10, wpmBonus=16.5, accuracyBonus=0
        // (10 + 16.5) * 1.5 * 1.3 = 26.5 * 1.95 = 51.675 -> 52
        expect(result.sessionXp).toBe(52);
    });
});

describe("xpRequiredForLevel", () => {
    it("returns 100 for level 1", () => {
        expect(xpRequiredForLevel(1)).toBe(100);
    });

    it("returns 240 for level 2", () => {
        expect(xpRequiredForLevel(2)).toBe(240);
    });

    it("returns increasing values for higher levels", () => {
        const l3 = xpRequiredForLevel(3);
        const l4 = xpRequiredForLevel(4);
        const l5 = xpRequiredForLevel(5);
        expect(l4).toBeGreaterThan(l3);
        expect(l5).toBeGreaterThan(l4);
    });

    it("computes level 3 correctly", () => {
        // 3 * 100 * 1.2^2 = 300 * 1.44 = 432
        expect(xpRequiredForLevel(3)).toBe(432);
    });
});

describe("computeLevelFromXp", () => {
    it("returns level 1 with 0 xp", () => {
        const info = computeLevelFromXp(0);
        expect(info.level).toBe(1);
        expect(info.currentLevelXp).toBe(0);
        expect(info.nextLevelXp).toBe(100);
        expect(info.progress).toBe(0);
    });

    it("returns level 1 at 50 xp (mid-level)", () => {
        const info = computeLevelFromXp(50);
        expect(info.level).toBe(1);
        expect(info.currentLevelXp).toBe(50);
        expect(info.nextLevelXp).toBe(100);
        expect(info.progress).toBeCloseTo(0.5);
    });

    it("returns level 2 at exactly 100 xp (boundary)", () => {
        const info = computeLevelFromXp(100);
        expect(info.level).toBe(2);
        expect(info.currentLevelXp).toBe(0);
        expect(info.nextLevelXp).toBe(140);
        expect(info.progress).toBe(0);
    });

    it("returns level 2 mid-progress at 200 xp", () => {
        const info = computeLevelFromXp(200);
        expect(info.level).toBe(2);
        expect(info.currentLevelXp).toBe(100);
        expect(info.nextLevelXp).toBe(140);
        expect(info.progress).toBeCloseTo(100 / 140);
    });

    it("returns level 3 at exactly 240 xp", () => {
        const info = computeLevelFromXp(240);
        expect(info.level).toBe(3);
        expect(info.currentLevelXp).toBe(0);
        expect(info.nextLevelXp).toBe(192);
        expect(info.progress).toBe(0);
    });

    it("handles high xp values", () => {
        const info = computeLevelFromXp(10000);
        expect(info.level).toBeGreaterThan(5);
        expect(info.progress).toBeGreaterThanOrEqual(0);
        expect(info.progress).toBeLessThanOrEqual(1);
    });

    it("clamps progress between 0 and 1", () => {
        const info = computeLevelFromXp(99);
        expect(info.progress).toBeGreaterThanOrEqual(0);
        expect(info.progress).toBeLessThanOrEqual(1);
    });
});
