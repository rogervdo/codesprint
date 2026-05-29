/**
 * AI Drills Types
 */

import type { SupportedLanguage, SnippetLength } from "@/lib/snippets";
import type { CatalogTopic, SnippetType } from "@/lib/catalog";
import type { WeakPattern } from "@/lib/pattern-analysis";

export type DrillRequest = {
    language: SupportedLanguage;
    contentType?: SnippetType;
    lengthCategory: SnippetLength;
    weakPatterns: WeakPattern[];
    targetTokenCategories: string[];
    recentDrillTitles: string[];
    userContext: {
        estimatedWpm: number;
        estimatedAccuracy: number;
        sessionCount: number;
    };
};

export type DrillResponse = {
    title: string;
    content: string;
    explanation: string;
    focusAreas: string[];
    reasoning: string;
};

export type GeneratedDrill = DrillResponse & {
    provider: "claude" | "openai" | "fireworks";
    model: string;
    tokensUsed: number;
    costUsd: number;
};

export type GenerateApiRequest = DrillRequest;

export type GenerateApiResponse = {
    snippet: DrillResponse;
    provider: "claude" | "openai" | "fireworks";
    model: string;
    tokensUsed: number;
    costUsd: number;
};

export type GenerateApiError = {
    error: string;
    code: string;
    details?: unknown;
    reason?: string;
};

export interface RateLimiterState {
    minuteTimestamps: number[];
    hourTimestamps: number[];
    dayTimestamps: number[];
    lastRequestMs: number;
}

export interface RateLimitCheckResult {
    allowed: boolean;
    reason?: string;
    retryAfterMs?: number;
}

export type AIMetadata = {
    provider: "claude" | "openai" | "fireworks";
    model: string;
    reasoning: string;
    focusAreas: string[];
    weakPatternsInput: string[];
    tokensUsed: number;
    costUsd: number;
    accepted: boolean;
    contentType?: SnippetType;
    topics?: CatalogTopic[];
    lengthCategory: SnippetLength;
};
