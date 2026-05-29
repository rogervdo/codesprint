/**
 * Content taxonomy: Type (Templates / Problems) and per-type topic lists.
 * Snippets in data/snippets-catalog.json reference these ids.
 */

export const SNIPPET_TYPES = ["template", "problem"] as const;
export type SnippetType = (typeof SNIPPET_TYPES)[number];

/** AlgoMonster-style topics for LeetCode / problem snippets. */
export const PROBLEM_TOPICS = [
    "binary-search",
    "two-pointers",
    "depth-first-search",
    "backtracking",
    "breadth-first-search",
    "graph",
    "priority-queue-heap",
    "dynamic-programming",
    "disjoint-set-union",
    "trie",
    "data-structure-design",
    "segment-tree",
] as const;

export type ProblemTopic = (typeof PROBLEM_TOPICS)[number];

/** Pattern templates (one topic per template family). */
export const TEMPLATE_TOPICS = [
    "backtracking-aggregation",
    "backtracking-basic",
    "binary-search",
    "bfs-tree",
    "dfs-tree",
    "bfs-graph",
    "dfs-graph",
    "bfs-matrix",
    "mono-stack",
    "prefix-sum",
    "sliding-window-fixed",
    "sliding-window-flexible",
    "topological-sort",
    "trie",
    "two-pointers-opposite",
    "two-pointers-same",
    "union-find",
] as const;

export type TemplateTopic = (typeof TEMPLATE_TOPICS)[number];

export type CatalogTopic = ProblemTopic | TemplateTopic;

/** @deprecated Use PROBLEM_TOPICS */
export const TOPICS = PROBLEM_TOPICS;

/** @deprecated Use ProblemTopic */
export type Topic = ProblemTopic;

export const SNIPPET_TYPE_LABELS: Record<SnippetType, string> = {
    template: "Templates",
    problem: "Problems",
};

export const PROBLEM_TOPIC_LABELS: Record<ProblemTopic, string> = {
    "binary-search": "Binary Search",
    "two-pointers": "Two Pointers",
    "depth-first-search": "Depth First Search",
    backtracking: "Backtracking",
    "breadth-first-search": "Breadth First Search",
    graph: "Graph",
    "priority-queue-heap": "Priority Queue / Heap",
    "dynamic-programming": "Dynamic Prog.",
    "disjoint-set-union": "Disjoint Set Union",
    trie: "Trie",
    "data-structure-design": "Data Structure Design",
    "segment-tree": "Segment Tree",
};

export const TEMPLATE_TOPIC_LABELS: Record<TemplateTopic, string> = {
    "backtracking-aggregation": "Backtracking — Aggregation",
    "backtracking-basic": "Backtracking — Basic",
    "binary-search": "Binary Search",
    "bfs-tree": "BFS on Tree",
    "dfs-tree": "DFS on Tree",
    "bfs-graph": "BFS on Graphs",
    "dfs-graph": "DFS on Graphs",
    "bfs-matrix": "BFS on a Matrix",
    "mono-stack": "Mono Stack",
    "prefix-sum": "Prefix Sum",
    "sliding-window-fixed": "Sliding Window (Fixed)",
    "sliding-window-flexible": "Sliding Window (Flexible)",
    "topological-sort": "Topological Sort",
    trie: "Trie",
    "two-pointers-opposite": "Two Pointers (Opposite)",
    "two-pointers-same": "Two Pointers (Same)",
    "union-find": "Union Find",
};

/** @deprecated Use PROBLEM_TOPIC_LABELS */
export const TOPIC_LABELS = PROBLEM_TOPIC_LABELS;

export const DEFAULT_CONTENT_TYPE: SnippetType = "problem";
export const DEFAULT_PROBLEM_TOPICS: ProblemTopic[] = [...PROBLEM_TOPICS];
export const DEFAULT_TEMPLATE_TOPICS: TemplateTopic[] = [...TEMPLATE_TOPICS];

export function getTopicsForType(type: SnippetType): readonly CatalogTopic[] {
    return type === "template" ? TEMPLATE_TOPICS : PROBLEM_TOPICS;
}

export function getTopicLabelsForType(type: SnippetType): Record<string, string> {
    return type === "template" ? TEMPLATE_TOPIC_LABELS : PROBLEM_TOPIC_LABELS;
}

export function isSnippetType(value: unknown): value is SnippetType {
    return value === "template" || value === "problem";
}

export function isProblemTopic(value: unknown): value is ProblemTopic {
    return typeof value === "string" && (PROBLEM_TOPICS as readonly string[]).includes(value);
}

export function isTemplateTopic(value: unknown): value is TemplateTopic {
    return typeof value === "string" && (TEMPLATE_TOPICS as readonly string[]).includes(value);
}

export function isCatalogTopic(value: unknown): value is CatalogTopic {
    return isProblemTopic(value) || isTemplateTopic(value);
}

export function isTopicForType(value: unknown, type: SnippetType): value is CatalogTopic {
    return type === "template" ? isTemplateTopic(value) : isProblemTopic(value);
}

/** @deprecated Use isProblemTopic */
export function isTopic(value: unknown): value is ProblemTopic {
    return isProblemTopic(value);
}

export function sanitizeContentType(
    value: unknown,
    legacyContentTypes?: unknown
): SnippetType {
    if (isSnippetType(value)) return value;
    if (Array.isArray(legacyContentTypes)) {
        const picked = legacyContentTypes.filter(isSnippetType);
        if (picked.length === 1) return picked[0];
    }
    return DEFAULT_CONTENT_TYPE;
}

export function sanitizeProblemTopics(values: unknown): ProblemTopic[] {
    if (!Array.isArray(values)) return DEFAULT_PROBLEM_TOPICS;
    const picked = values.filter(isProblemTopic);
    return picked.length > 0 ? picked : DEFAULT_PROBLEM_TOPICS;
}

export function sanitizeTemplateTopics(values: unknown): TemplateTopic[] {
    if (!Array.isArray(values)) return DEFAULT_TEMPLATE_TOPICS;
    const picked = values.filter(isTemplateTopic);
    return picked.length > 0 ? picked : DEFAULT_TEMPLATE_TOPICS;
}

export function sanitizeTopicsForType(values: unknown, type: SnippetType): CatalogTopic[] {
    return type === "template" ? sanitizeTemplateTopics(values) : sanitizeProblemTopics(values);
}

/** @deprecated Use sanitizeProblemTopics */
export function sanitizeTopics(values: unknown): ProblemTopic[] {
    return sanitizeProblemTopics(values);
}

/** @deprecated Use sanitizeContentType */
export function sanitizeSnippetTypes(values: unknown): SnippetType[] {
    const type = sanitizeContentType(undefined, values);
    return [type];
}

/** Toggle one item; keeps at least one selected in the group. */
export function toggleMultiSelect<T>(current: readonly T[], item: T): T[] {
    if (current.includes(item)) {
        const next = current.filter((value) => value !== item);
        return next.length > 0 ? [...next] : [...current];
    }
    return [...current, item];
}
