import { describe, it, expect } from "vitest";
import { computeSessionXp, xpRequiredForLevel, computeLevelFromXp } from "../xp";

describe("computeSessionXp", () => {
    it("computes base XP for a template", () => {
        const result = computeSessionXp({
            wpm: 60,
            accuracy: 0.9,
            contentType: "template",
            lengthCategory: "short",
        });
        expect(result.sessionXp).toBe(40);
        expect(result.breakdown).toEqual({
            base: 10,
            wpmBonus: 30,
            accuracyBonus: 0,
            typeMult: 1,
            lengthMult: 1,
        });
    });

    it("applies problem type multiplier", () => {
        const result = computeSessionXp({
            wpm: 60,
            accuracy: 0.9,
            contentType: "problem",
            lengthCategory: "short",
        });
        expect(result.breakdown.typeMult).toBe(1.5);
        expect(result.sessionXp).toBe(60);
    });
});

describe("computeLevelFromXp", () => {
    it("starts at level 1", () => {
        const info = computeLevelFromXp(0);
        expect(info.level).toBe(1);
    });
});

describe("xpRequiredForLevel", () => {
    it("increases per level", () => {
        expect(xpRequiredForLevel(2)).toBeGreaterThan(xpRequiredForLevel(1));
    });
});
