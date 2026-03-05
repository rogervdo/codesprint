/**
 * Token category weights for syntax-aware scoring.
 *
 * Higher weight = more impactful on pattern score.
 * Typing keywords and operators correctly matters more than whitespace.
 */

import type { TokenCategory } from "./tokenizer";
import type { SupportedLanguage } from "./snippets";

// ---------------------------------------------------------------------------
// Default weights
// ---------------------------------------------------------------------------

export type TokenWeights = Record<TokenCategory, number>;

const DEFAULT_WEIGHTS: TokenWeights = {
    keyword: 1.5,
    operator: 1.5,
    delimiter: 1.2,
    identifier: 1.0,
    literal: 1.0,
    string: 0.8,
    comment: 0.3,
    whitespace: 0.5,
};

// ---------------------------------------------------------------------------
// Per-language overrides (merged with defaults)
// ---------------------------------------------------------------------------

const LANGUAGE_OVERRIDES: Partial<Record<SupportedLanguage, Partial<TokenWeights>>> = {
    python: {
        // Python's indentation IS syntax, so whitespace matters more
        whitespace: 0.7,
    },
    cpp: {
        // C++ templates and operators are syntactically critical
        operator: 1.6,
        delimiter: 1.3,
    },
};

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export function getWeights(language: SupportedLanguage): TokenWeights {
    const overrides = LANGUAGE_OVERRIDES[language];
    if (!overrides) return DEFAULT_WEIGHTS;
    return { ...DEFAULT_WEIGHTS, ...overrides };
}

export function getWeight(language: SupportedLanguage, category: TokenCategory): number {
    return getWeights(language)[category];
}
