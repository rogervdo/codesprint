"use client";

import type { Token } from "./tokenizer";
import { getCachedWeights } from "./token-weights";
import type { TokenWeights } from "./token-weights";
import type { SupportedLanguage } from "./snippets";

export type Metrics = {
    rawWpm: number;
    adjustedWpm: number;
    accuracy: number;
    patternScore?: number;
};

const MS_IN_MINUTE = 1000 * 60;

type ComputeMetricsInput = {
    correctProgress: number; // Characters in perfect words
    elapsedMs: number;
    totalTyped: number; // Total characters currently in the buffer (cursor position) - kept for legacy/other uses
    totalKeystrokes?: number; // Total keys pressed (including backspaces)
    correctKeystrokes?: number; // Total correct keys pressed
};

export function computeMetrics({ correctProgress, elapsedMs, totalTyped, totalKeystrokes, correctKeystrokes }: ComputeMetricsInput): Metrics {
    if (elapsedMs <= 0) {
        return { rawWpm: 0, adjustedWpm: 0, accuracy: 1 };
    }
    const minutes = elapsedMs / MS_IN_MINUTE;

    // Raw WPM: (Total Keystrokes / 5) / Time
    // We use totalKeystrokes if available, otherwise fallback to totalTyped (backward compatibility/safety)
    const rawCount = totalKeystrokes ?? totalTyped;
    const rawWpm = (rawCount / 5) / minutes;

    // Adjusted WPM: (Characters in Perfect Words / 5) / Time
    // correctProgress now represents "sum of lengths of perfect words"
    const adjustedWpm = Math.max(0, (correctProgress / 5) / minutes);

    // Accuracy: Correct Keystrokes / Total Keystrokes
    const accuracy =
        !totalKeystrokes || totalKeystrokes <= 0
            ? 1
            : Math.min(1, (correctKeystrokes ?? 0) / totalKeystrokes);

    return {
        rawWpm,
        adjustedWpm,
        accuracy,
    };
}

// ---------------------------------------------------------------------------
// Pattern Score
// ---------------------------------------------------------------------------

/** Compute totalWeight from tokens directly — O(numTokens) instead of O(numChars). */
function totalWeightFromTokens(tokens: Token[], weights: TokenWeights): number {
    let total = 0;
    for (let t = 0; t < tokens.length; t++) {
        const tok = tokens[t];
        total += weights[tok.category] * (tok.end - tok.start);
    }
    return total;
}

/** Binary search tokens for the weight at a given position. */
function weightAtPosition(tokens: Token[], pos: number, weights: TokenWeights): number {
    let lo = 0, hi = tokens.length - 1;
    while (lo <= hi) {
        const mid = (lo + hi) >>> 1;
        const tok = tokens[mid];
        if (pos < tok.start) hi = mid - 1;
        else if (pos >= tok.end) lo = mid + 1;
        else return weights[tok.category];
    }
    return weights.whitespace;
}

type PatternScoreInput = {
    /** Error positions in the content string */
    errorPositions: number[];
    /** Tokens from the tokenizer */
    tokens: Token[];
    /** Total content length */
    contentLength: number;
    /** Language for weight lookup */
    language: SupportedLanguage;
};

// Single-entry cache via Symbols
const _pscKey = Symbol('psc-k');
const _pscVal = Symbol('psc-v');

/**
 * Compute a pattern score (0-100) — tiny hot path for JIT inlining.
 */
export function computePatternScore(input: PatternScoreInput): number {
    const ta = input.tokens as any;
    if (ta[_pscKey] === input.errorPositions) return ta[_pscVal];
    return _computePatternScoreCold(input, ta);
}

function _computePatternScoreCold(input: PatternScoreInput, ta: any): number {
    const tokens = input.tokens;
    if (tokens.length === 0 || input.contentLength === 0) return 100;

    const weights = getCachedWeights(input.language);
    const totalWeight = totalWeightFromTokens(tokens, weights);
    if (totalWeight === 0) return 100;

    const errorPositions = input.errorPositions;
    const contentLength = input.contentLength;
    let errorWeight = 0;
    for (let j = 0; j < errorPositions.length; j++) {
        const pos = errorPositions[j];
        if (pos >= 0 && pos < contentLength) {
            errorWeight += weightAtPosition(tokens, pos, weights);
        }
    }

    const score = Math.round(((totalWeight - errorWeight) / totalWeight) * 100);
    const result = Math.max(0, Math.min(100, score));

    ta[_pscKey] = errorPositions;
    ta[_pscVal] = result;

    return result;
}

// ---------------------------------------------------------------------------
// createPatternScoreCalculator - cached version of computePatternScore
// ---------------------------------------------------------------------------

type PatternScoreCalculatorInput = {
    tokens: Token[];
    contentLength: number;
    language: SupportedLanguage;
};

const _calcSym = Symbol('calc');

/**
 * Creates a reusable pattern score calculator — tiny hot path for JIT inlining.
 */
export function createPatternScoreCalculator(
    input: PatternScoreCalculatorInput
): (errorPositions: number[]) => number {
    const ta = input.tokens as any;
    if (ta[_calcSym]) return ta[_calcSym];
    return _createCalcCold(input, ta);
}

function _createCalcCold(
    input: PatternScoreCalculatorInput,
    ta: any,
): (errorPositions: number[]) => number {
    const tokens = input.tokens;
    if (tokens.length === 0 || input.contentLength === 0) {
        return () => 100;
    }

    const weights = getCachedWeights(input.language);
    const totalWeight = totalWeightFromTokens(tokens, weights);
    if (totalWeight === 0) {
        const fn = () => 100;
        ta[_calcSym] = fn;
        return fn;
    }

    const contentLength = input.contentLength;
    let lastKey: number[] | null = null;
    let lastVal = 0;

    const fn = (errorPositions: number[]): number => {
        if (lastKey === errorPositions) return lastVal;
        if (errorPositions.length === 0) return 100;

        let errorWeight = 0;
        for (let j = 0; j < errorPositions.length; j++) {
            const pos = errorPositions[j];
            if (pos >= 0 && pos < contentLength) {
                errorWeight += weightAtPosition(tokens, pos, weights);
            }
        }
        const score = Math.round(((totalWeight - errorWeight) / totalWeight) * 100);
        const result = Math.max(0, Math.min(100, score));
        lastKey = errorPositions;
        lastVal = result;
        return result;
    };

    ta[_calcSym] = fn;
    return fn;
}
