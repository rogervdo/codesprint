"use client";

import type { CatalogTopic, SnippetType } from "@/lib/catalog";
import { isSnippetType, isTopicForType } from "@/lib/catalog";
import type { Token } from "./tokenizer";

export type SupportedLanguage = "javascript" | "python";
export type SnippetLength = "short" | "medium" | "long";

export type { CatalogTopic, SnippetType };

export type Problem = {
    id: string;
    title: string;
    summary: string;
    language: SupportedLanguage;
    types: SnippetType[];
    topics: CatalogTopic[];
};

export type Snippet = {
    id: string;
    problemId: string;
    title: string;
    content: string;
    language: SupportedLanguage;
    type: SnippetType;
    topics: CatalogTopic[];
    lengthCategory: SnippetLength;
    lines: number;
    sourceSlug?: string;
    tokens?: Token[];
};

export type ContentFilters = {
    types: SnippetType[];
    topics: CatalogTopic[];
};

export type SnippetVarianceTag = "signature-only" | "full";

type CatalogEntry = {
    id?: string;
    title?: string;
    content?: string;
    language?: string;
    type?: string;
    topics?: unknown;
    problemId?: string;
    sourceSlug?: string;
};

const LENGTH_THRESHOLDS = {
    short: 10,
    medium: 30,
} as const;

/** Shown when no catalog entries match the current filters. */
export const PLACEHOLDER_SNIPPET: Snippet = {
    id: "placeholder-empty",
    problemId: "placeholder:empty",
    title: "No snippets yet",
    content: `// Add templates and problems to data/snippets-catalog.json
// Then restart the dev server.
`,
    language: "python",
    type: "template",
    topics: ["backtracking-basic"],
    lengthCategory: "short",
    lines: 3,
};

export function normalizeCatalog(raw: unknown): Snippet[] {
    if (!Array.isArray(raw)) return [];
    return raw.flatMap((entry: CatalogEntry): Snippet[] => {
        if (!entry || typeof entry !== "object") return [];
        if (!isSupportedLanguage(entry.language)) return [];
        if (!isSnippetType(entry.type)) return [];
        const snippetType = entry.type;
        if (typeof entry.content !== "string" || entry.content.trim().length === 0) return [];
        if (!Array.isArray(entry.topics) || entry.topics.length === 0) return [];
        const topics = entry.topics.filter((topic): topic is CatalogTopic =>
            isTopicForType(topic, snippetType)
        );
        if (topics.length === 0) return [];

        const normalizedContent = normalizeContent(entry.content);
        const lines = countLines(normalizedContent);
        const sourceSlug = typeof entry.sourceSlug === "string" ? entry.sourceSlug : undefined;
        const id =
            typeof entry.id === "string" && entry.id.length > 0
                ? entry.id
                : computeProblemId(entry.language, sourceSlug ?? entry.title ?? "snippet");
        const problemId =
            typeof entry.problemId === "string" && entry.problemId.length > 0
                ? entry.problemId
                : computeProblemId(entry.language, sourceSlug ?? id);
        const title = typeof entry.title === "string" && entry.title.length > 0 ? entry.title : "Untitled";

        return [
            {
                id,
                problemId,
                title,
                content: normalizedContent,
                language: entry.language,
                type: snippetType,
                topics,
                lengthCategory: classifyLength(lines),
                lines,
                sourceSlug,
            },
        ];
    });
}

export function filterSnippets(
    snippets: Snippet[],
    language: SupportedLanguage,
    filters: ContentFilters
): Snippet[] {
    const typeSet = new Set(filters.types);
    const topicSet = new Set(filters.topics);
    return snippets.filter(
        (snippet) =>
            snippet.id !== PLACEHOLDER_SNIPPET.id &&
            snippet.language === language &&
            typeSet.has(snippet.type) &&
            snippet.topics.some((topic) => topicSet.has(topic))
    );
}

function buildProblems(snippets: Snippet[]): Problem[] {
    const byProblem = new Map<string, Problem>();
    for (const snippet of snippets) {
        const existing = byProblem.get(snippet.problemId);
        if (!existing) {
            byProblem.set(snippet.problemId, {
                id: snippet.problemId,
                title: snippet.title,
                summary: snippet.sourceSlug ?? snippet.title,
                language: snippet.language,
                types: [snippet.type],
                topics: [...snippet.topics],
            });
            continue;
        }
        if (!existing.types.includes(snippet.type)) {
            existing.types.push(snippet.type);
        }
        for (const topic of snippet.topics) {
            if (!existing.topics.includes(topic)) {
                existing.topics.push(topic);
            }
        }
    }
    return Array.from(byProblem.values()).sort((a, b) => a.title.localeCompare(b.title));
}

export function buildProblemsFromSnippets(snippets: Snippet[]): Problem[] {
    return buildProblems(snippets);
}

export function getProblems(snippets: Snippet[], language: SupportedLanguage, filters: ContentFilters): Problem[] {
    return buildProblems(filterSnippets(snippets, language, filters));
}

export function getProblemSnippets(
    snippets: Snippet[],
    language: SupportedLanguage,
    problemId: string,
    filters: ContentFilters
): Snippet[] {
    return filterSnippets(snippets, language, filters).filter((snippet) => snippet.problemId === problemId);
}

export function getSnippet(
    snippets: Snippet[],
    language: SupportedLanguage,
    filters: ContentFilters
): Snippet {
    const filtered = filterSnippets(snippets, language, filters);
    return filtered[0] ?? PLACEHOLDER_SNIPPET;
}

export function getSnippetVarianceTag(snippet: Snippet): SnippetVarianceTag {
    if (isSignatureOnlySnippet(snippet)) {
        return "signature-only";
    }
    return "full";
}

export function getSnippetVarietyScore(snippet: Snippet): number {
    const varianceTag = getSnippetVarianceTag(snippet);
    let score = Math.min(snippet.lines, 40) / 4;
    if (varianceTag === "signature-only") {
        score -= 6;
    } else {
        score += 4;
    }
    if (snippet.lengthCategory === "medium") score += 1;
    if (snippet.lengthCategory === "long") score += 2;
    if (snippet.type === "problem") score += 1;
    return score;
}

function isSignatureOnlySnippet(snippet: Snippet): boolean {
    if (snippet.lines > 6) return false;
    const nonEmpty = snippet.content
        .split("\n")
        .map((line) => line.trim())
        .filter((line) => line.length > 0);
    if (nonEmpty.length === 0) return true;
    return nonEmpty.every((line) => {
        if (line.startsWith("import ") || line.startsWith("from ") || line.startsWith("@")) {
            return true;
        }
        if (/^def [a-zA-Z_]\w*\(.*\):$/.test(line) || /^class [a-zA-Z_]\w*(\([^)]*\))?:$/.test(line)) {
            return true;
        }
        return false;
    });
}

function normalizeContent(content: string): string {
    const normalized = content.replace(/\r\n/g, "\n");
    const cleaned = condenseBlankRuns(normalized);
    const trimmed = cleaned.trimEnd();
    if (!trimmed) return "\n";
    return trimmed.endsWith("\n") ? trimmed : `${trimmed}\n`;
}

function condenseBlankRuns(content: string): string {
    const lines = content.split("\n");
    const result: string[] = [];
    let blankRun = 0;
    for (const line of lines) {
        const isBlank = line.trim().length === 0;
        if (isBlank) {
            blankRun += 1;
            if (result.length === 0) continue;
            if (blankRun > 1) continue;
        } else {
            blankRun = 0;
        }
        result.push(line);
    }
    while (result.length > 0 && result[result.length - 1].trim().length === 0) {
        result.pop();
    }
    return result.join("\n");
}

function countLines(content: string): number {
    if (!content) return 0;
    return content.split("\n").length - 1;
}

function classifyLength(lines: number): SnippetLength {
    if (lines <= LENGTH_THRESHOLDS.short) return "short";
    if (lines <= LENGTH_THRESHOLDS.medium) return "medium";
    return "long";
}

function computeProblemId(language: SupportedLanguage, slug: string): string {
    return `${language}:${slug}`;
}

function isSupportedLanguage(value: unknown): value is SupportedLanguage {
    return value === "javascript" || value === "python";
}
