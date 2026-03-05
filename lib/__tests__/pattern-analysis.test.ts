import { describe, it, expect } from "vitest";
import { analyzeWeakPatterns, formatWeakPatterns } from "../pattern-analysis";
import { tokenize } from "../tokenizer";

describe("analyzeWeakPatterns", () => {
    it("returns empty for no errors", () => {
        const content = "const x = 1;";
        const tokens = tokenize(content, "javascript");
        const patterns = analyzeWeakPatterns([], tokens, content.length, "javascript");
        expect(patterns).toEqual([]);
    });

    it("identifies weak categories from errors", () => {
        const content = "const x = 1;";
        const tokens = tokenize(content, "javascript");
        const errors = [
            { expected: "c", got: "x", index: 0 }, // keyword
            { expected: "o", got: "a", index: 1 }, // keyword
            { expected: "n", got: "b", index: 2 }, // keyword
        ];

        const patterns = analyzeWeakPatterns(errors, tokens, content.length, "javascript");
        expect(patterns.length).toBeGreaterThan(0);
        expect(patterns[0].category).toBe("keyword");
        expect(patterns[0].errorCount).toBe(3);
    });

    it("returns top N patterns", () => {
        const content = "if (x == y) { return z; }";
        const tokens = tokenize(content, "javascript");

        // Errors on different categories
        const errors = [
            { expected: "i", got: "x", index: 0 },  // keyword
            { expected: "(", got: "x", index: 3 },  // delimiter
            { expected: "=", got: "x", index: 5 },  // operator
        ];

        const patterns = analyzeWeakPatterns(errors, tokens, content.length, "javascript", 2);
        expect(patterns.length).toBeLessThanOrEqual(2);
    });

    it("sorts by weighted error rate descending", () => {
        const content = "const x = 1;";
        const tokens = tokenize(content, "javascript");

        // Error on keyword and whitespace - keyword should rank higher
        const errors = [
            { expected: "c", got: "x", index: 0 }, // keyword (weight 1.5)
            { expected: " ", got: "x", index: 5 }, // whitespace (weight 0.5)
        ];

        const patterns = analyzeWeakPatterns(errors, tokens, content.length, "javascript");
        if (patterns.length >= 2) {
            expect(patterns[0].errorRate).toBeGreaterThanOrEqual(patterns[1].errorRate);
        }
    });
});

describe("formatWeakPatterns", () => {
    it("returns 'No patterns detected' for empty array", () => {
        expect(formatWeakPatterns([])).toBe("No patterns detected");
    });

    it("formats patterns as comma-separated list", () => {
        const patterns = [
            { category: "keyword" as const, errorCount: 3, totalTokens: 10, errorRate: 0.3, label: "Keywords" },
            { category: "operator" as const, errorCount: 2, totalTokens: 5, errorRate: 0.4, label: "Operators" },
        ];
        const result = formatWeakPatterns(patterns);
        expect(result).toBe("Keywords (3 errors), Operators (2 errors)");
    });
});
