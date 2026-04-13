/**
 * Pattern analysis module: identifies weakest token categories
 * from the error log combined with token data.
 *
 * Used to show users which syntax elements they struggle with most
 * (e.g., "You struggle with operators and delimiters").
 */

import type { Token, TokenCategory } from "./tokenizer";
import { buildCategoryMap } from "./tokenizer";
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

    const categoryMap = buildCategoryMap(tokens, contentLength);
    const weights = getCachedWeights(language);

    // Count errors per category
    const errorsByCategory = new Map<TokenCategory, number>();
    for (const error of errors) {
        if (error.index >= 0 && error.index < contentLength) {
            const category = categoryMap[error.index];
            errorsByCategory.set(category, (errorsByCategory.get(category) ?? 0) + 1);
        }
    }

    // Count total characters per category
    const totalByCategory = new Map<TokenCategory, number>();
    for (const token of tokens) {
        const count = token.end - token.start;
        totalByCategory.set(token.category, (totalByCategory.get(token.category) ?? 0) + count);
    }

    // Build weak patterns with weighted error rate
    const patterns: WeakPattern[] = [];
    for (const [category, errorCount] of errorsByCategory) {
        const totalTokens = totalByCategory.get(category) ?? 1;
        const rawErrorRate = errorCount / totalTokens;
        const weight = weights[category];
        // Weighted error rate: higher weight categories matter more
        const errorRate = rawErrorRate * weight;

        patterns.push({
            category,
            errorCount,
            totalTokens,
            errorRate,
            label: CATEGORY_LABELS[category],
        });
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
