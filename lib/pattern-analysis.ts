/**
 * Pattern analysis module: identifies weakest token categories
 * from the error log combined with token data.
 *
 * Used to show users which syntax elements they struggle with most
 * (e.g., "You struggle with operators and delimiters").
 */

import type { Token, TokenCategory } from "./tokenizer";
import { getCachedWeights } from "./token-weights";
import type { SupportedLanguage } from "./snippets";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ErrorEntry = {
    expected: string;
    got: string;
    index: number;
};

export type WeakPattern = {
    category: TokenCategory;
    errorCount: number;
    totalTokens: number;
    errorRate: number;
    /** Human-readable label */
    label: string;
};

// ---------------------------------------------------------------------------
// Category labels
// ---------------------------------------------------------------------------

const CATEGORY_LABELS: Record<TokenCategory, string> = {
    keyword: "Keywords",
    operator: "Operators",
    delimiter: "Delimiters",
    identifier: "Identifiers",
    literal: "Literals",
    string: "Strings",
    comment: "Comments",
    whitespace: "Whitespace",
};

// ---------------------------------------------------------------------------
// Category index mapping (avoids Map allocations in hot path)
// ---------------------------------------------------------------------------

const ALL_CATEGORIES: TokenCategory[] = [
    "keyword", "operator", "delimiter", "identifier",
    "literal", "string", "comment", "whitespace",
];
const NUM_CATEGORIES = ALL_CATEGORIES.length;
const CAT_INDEX: Record<TokenCategory, number> = {
    keyword: 0, operator: 1, delimiter: 2, identifier: 3,
    literal: 4, string: 5, comment: 6, whitespace: 7,
};

// ---------------------------------------------------------------------------
// Analysis
// ---------------------------------------------------------------------------

/**
 * Analyze error patterns against token categories.
 *
 * Returns the top N weakest categories sorted by weighted error rate.
 */
export function analyzeWeakPatterns(
    errors: ErrorEntry[],
    tokens: Token[],
    contentLength: number,
    language: SupportedLanguage,
    topN: number = 3,
): WeakPattern[] {
    if (errors.length === 0 || tokens.length === 0) return [];

    const weights = getCachedWeights(language);

    // Fixed-size arrays instead of Maps — avoids per-call Map allocation
    const errorCounts = new Int32Array(NUM_CATEGORIES);
    const totalCounts = new Int32Array(NUM_CATEGORIES);

    // Count errors per category using binary search
    for (let e = 0; e < errors.length; e++) {
        const idx = errors[e].index;
        if (idx >= 0 && idx < contentLength) {
            let lo = 0, hi = tokens.length - 1;
            let catIdx = 7; // whitespace default
            while (lo <= hi) {
                const mid = (lo + hi) >>> 1;
                const tok = tokens[mid];
                if (idx < tok.start) hi = mid - 1;
                else if (idx >= tok.end) lo = mid + 1;
                else { catIdx = CAT_INDEX[tok.category]; break; }
            }
            errorCounts[catIdx]++;
        }
    }

    // Count total characters per category
    for (let t = 0; t < tokens.length; t++) {
        const tok = tokens[t];
        totalCounts[CAT_INDEX[tok.category]] += tok.end - tok.start;
    }

    // Build weak patterns with weighted error rate
    const patterns: WeakPattern[] = [];
    for (let c = 0; c < NUM_CATEGORIES; c++) {
        if (errorCounts[c] > 0) {
            const category = ALL_CATEGORIES[c];
            const totalTokens = totalCounts[c] || 1;
            const errorRate = (errorCounts[c] / totalTokens) * weights[category];
            patterns.push({
                category,
                errorCount: errorCounts[c],
                totalTokens,
                errorRate,
                label: CATEGORY_LABELS[category],
            });
        }
    }

    // Sort by weighted error rate descending, take top N
    return patterns
        .sort((a, b) => b.errorRate - a.errorRate)
        .slice(0, topN);
}

/**
 * Generate a human-readable summary of weak patterns.
 */
export function formatWeakPatterns(patterns: WeakPattern[]): string {
    if (patterns.length === 0) return "No patterns detected";

    return patterns
        .map((p) => `${p.label} (${p.errorCount} errors)`)
        .join(", ");
}
