import { describe, it, expect } from "vitest";
import { getWeights, getWeight } from "../token-weights";

describe("getWeights", () => {
    it("returns default weights for javascript (no overrides)", () => {
        const weights = getWeights("javascript");
        expect(weights.keyword).toBe(1.5);
        expect(weights.operator).toBe(1.5);
        expect(weights.delimiter).toBe(1.2);
        expect(weights.identifier).toBe(1.0);
        expect(weights.literal).toBe(1.0);
        expect(weights.string).toBe(0.8);
        expect(weights.comment).toBe(0.3);
        expect(weights.whitespace).toBe(0.5);
    });

    it("applies python overrides (whitespace = 0.7)", () => {
        const weights = getWeights("python");
        expect(weights.whitespace).toBe(0.7);
        expect(weights.keyword).toBe(1.5);
        expect(weights.operator).toBe(1.5);
    });

    it("returns a new object (not a reference to defaults)", () => {
        const w1 = getWeights("python");
        const w2 = getWeights("python");
        expect(w1).not.toBe(w2);
        expect(w1).toEqual(w2);
    });
});

describe("getWeight", () => {
    it("returns weight for a specific category and language", () => {
        expect(getWeight("python", "whitespace")).toBe(0.7);
        expect(getWeight("javascript", "whitespace")).toBe(0.5);
    });
});
