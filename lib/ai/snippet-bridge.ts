/**
 * Snippet Bridge
 * Converts CustomSnippetRecord (from IndexedDB) to Snippet type
 */

import type { CustomSnippetRecord } from "@/lib/storage/idb-store";
import type { Snippet, SupportedLanguage, SnippetLength } from "@/lib/snippets";
import type { CatalogTopic, SnippetType } from "@/lib/catalog";
import { DEFAULT_PROBLEM_TOPICS, isCatalogTopic } from "@/lib/catalog";

const LENGTH_THRESHOLDS = {
    short: 10,
    medium: 30,
} as const;

function classifyLength(lines: number): SnippetLength {
    if (lines <= LENGTH_THRESHOLDS.short) return "short";
    if (lines <= LENGTH_THRESHOLDS.medium) return "medium";
    return "long";
}

export function toSnippet(record: CustomSnippetRecord): Snippet {
    const lines = record.content.split("\n").length;
    const lengthCategory: SnippetLength =
        record.aiMetadata?.lengthCategory
            ? (record.aiMetadata.lengthCategory as SnippetLength)
            : classifyLength(lines);

    const contentType: SnippetType =
        record.aiMetadata?.contentType === "problem" || record.aiMetadata?.contentType === "template"
            ? record.aiMetadata.contentType
            : "template";

    const topics: CatalogTopic[] =
        Array.isArray(record.aiMetadata?.topics) && record.aiMetadata.topics.length > 0
            ? record.aiMetadata.topics.filter(isCatalogTopic)
            : [DEFAULT_PROBLEM_TOPICS[0]];

    return {
        id: record.id,
        problemId: `ai-drill-${record.id}`,
        title: record.title,
        content: record.content,
        language: record.language as SupportedLanguage,
        type: contentType,
        topics,
        lengthCategory,
        lines,
    };
}

export function isAIDrill(record: CustomSnippetRecord): boolean {
    return record.source === "ai";
}

export function isAcceptedAIDrill(record: CustomSnippetRecord): boolean {
    return record.source === "ai" && record.aiMetadata?.accepted === true;
}
