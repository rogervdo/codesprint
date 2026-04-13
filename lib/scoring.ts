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

/**
 * Compute a pattern score (0-100) that reflects how well the user typed
 * syntax-significant tokens.
 *
 * Higher score = fewer errors on high-weight tokens.
 * A perfect run = 100.
 */
export function computePatternScore({
    errorPositions,
    tokens,
    contentLength,
    language,
}: PatternScoreInput): number {
    if (tokens.length === 0 || contentLength === 0) return 100;

    const weights = getCachedWeights(language);

    const totalWeight = totalWeightFromTokens(tokens, weights);
    if (totalWeight === 0) return 100;

    // Weighted errors via binary search (no categoryMap allocation)
    let errorWeight = 0;
    for (let j = 0; j < errorPositions.length; j++) {
        const pos = errorPositions[j];
        if (pos >= 0 && pos < contentLength) {
            errorWeight += weightAtPosition(tokens, pos, weights);
        }
    }

    const score = Math.round(((totalWeight - errorWeight) / totalWeight) * 100);
    return Math.max(0, Math.min(100, score));
}

// ---------------------------------------------------------------------------
// createPatternScoreCalculator - cached version of computePatternScore
// ---------------------------------------------------------------------------

type PatternScoreCalculatorInput = {
    tokens: Token[];
    contentLength: number;
    language: SupportedLanguage;
};

/**
 * Creates a reusable pattern score calculator that caches the categoryMap and
 * totalWeight for a given snippet. Call this once per snippet and reuse the
 * returned function on every keystroke interval to avoid rebuilding the map.
 */
export function createPatternScoreCalculator({
    tokens,
    contentLength,
    language,
}: PatternScoreCalculatorInput): (errorPositions: number[]) => number {
    if (tokens.length === 0 || contentLength === 0) {
        return () => 100;
    }

    const weights = getCachedWeights(language);

    const totalWeight = totalWeightFromTokens(tokens, weights);
    if (totalWeight === 0) {
        return () => 100;
    }

    // Build a Float64Array weight map for fast O(1) lookups in the closure
    const weightMap = new Float64Array(contentLength);
    weightMap.fill(weights.whitespace);
    for (let t = 0; t < tokens.length; t++) {
        const tok = tokens[t];
        const w = weights[tok.category];
        const end = Math.min(tok.end, contentLength);
        for (let i = tok.start; i < end; i++) {
            weightMap[i] = w;
        }
    }

    return (errorPositions: number[]): number => {
        if (errorPositions.length === 0) return 100;
        let errorWeight = 0;
        for (let j = 0; j < errorPositions.length; j++) {
            const pos = errorPositions[j];
            if (pos >= 0 && pos < contentLength) {
                errorWeight += weightMap[pos];
            }
        }
        const score = Math.round(((totalWeight - errorWeight) / totalWeight) * 100);
        return Math.max(0, Math.min(100, score));
    };
}
