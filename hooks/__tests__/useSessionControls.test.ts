import { describe, it, expect, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useState } from "react";
import { useSessionControls } from "../useSessionControls";
import { normalizeCatalog, type Snippet, type SupportedLanguage } from "@/lib/snippets";
import { DEFAULT_PROBLEM_TOPICS } from "@/lib/catalog";

const TEST_SNIPPETS = normalizeCatalog([
    {
        id: "py-bfs-template",
        title: "BFS Template",
        language: "python",
        type: "template",
        topics: ["bfs-tree"],
        content: "from collections import deque\n\ndef bfs():\n    pass\n",
    },
    {
        id: "py-dfs-template",
        title: "DFS Template",
        language: "python",
        type: "template",
        topics: ["dfs-tree"],
        content: "def dfs(node):\n    pass\n",
    },
    {
        id: "js-graph-problem",
        title: "Graph Problem",
        language: "javascript",
        type: "problem",
        topics: ["graph"],
        content: "function solve() {\n  return 1;\n}\n",
    },
]);

const TEMPLATE_FILTERS = {
    types: ["template" as const],
    topics: ["bfs-tree" as const, "dfs-tree" as const],
};
const PROBLEM_FILTERS = { types: ["problem" as const], topics: DEFAULT_PROBLEM_TOPICS };

function makeSnippet(overrides: Partial<Snippet> = {}): Snippet {
    return {
        id: "python:base",
        problemId: "python:base",
        title: "Base",
        content: "def solve(values: list[int]) -> int:\n    return sum(values)\n",
        language: "python",
        type: "template",
        topics: ["bfs-tree"],
        lengthCategory: "short",
        lines: 2,
        ...overrides,
    };
}

describe("useSessionControls", () => {
    const mockResetEngine = vi.fn();

    function renderControls(snippets = TEST_SNIPPETS) {
        return renderHook(() => {
            const [language, setLanguage] = useState<SupportedLanguage>("python");
            return useSessionControls({
                snippets,
                onResetEngine: mockResetEngine,
                language,
                setLanguage,
                contentFilters: TEMPLATE_FILTERS,
            });
        });
    }

    it("initializes with default language (python)", () => {
        const { result } = renderControls();
        expect(result.current.language).toBe("python");
        expect(result.current.hasMatchingSnippets).toBe(true);
    });

    it("returns problem options for the selected language", () => {
        const { result } = renderControls();
        expect(result.current.problemOptions.length).toBeGreaterThan(0);
        for (const problem of result.current.problemOptions) {
            expect(problem.language).toBe("python");
        }
    });

    it("changes language and updates problem options", () => {
        const { result } = renderControls();
        act(() => {
            result.current.setLanguage("javascript");
        });
        expect(result.current.language).toBe("javascript");
        for (const problem of result.current.problemOptions) {
            expect(problem.language).toBe("javascript");
        }
    });

    it("resolves a snippet", () => {
        const { result } = renderControls();
        expect(result.current.snippet).toBeDefined();
        expect(result.current.snippet.content.length).toBeGreaterThan(0);
    });

    it("keeps an accepted AI drill active before the snippet catalog refreshes", () => {
        const baseSnippet = makeSnippet({
            id: "python:short",
            problemId: "python:short",
            type: "problem",
            topics: ["graph"],
        });
        const aiDrill = makeSnippet({
            id: "ai-drill-record-1",
            problemId: "ai-drill-ai-drill-record-1",
            title: "Generated Loop Drill",
            content: "def run():\n    return 1\n",
            type: "problem",
            topics: ["graph"],
        });

        const { result, rerender } = renderHook(
            ({ snippets }) => {
                const [language, setLanguage] = useState<SupportedLanguage>("python");
                return useSessionControls({
                    snippets,
                    onResetEngine: mockResetEngine,
                    language,
                    setLanguage,
                    contentFilters: PROBLEM_FILTERS,
                });
            },
            { initialProps: { snippets: [baseSnippet] } }
        );

        mockResetEngine.mockClear();
        act(() => {
            result.current.setSnippet(aiDrill);
        });

        expect(mockResetEngine).toHaveBeenCalledTimes(1);
        expect(result.current.language).toBe("python");
        expect(result.current.problemId).toBe(aiDrill.problemId);
        expect(result.current.snippetId).toBe(aiDrill.id);

        rerender({ snippets: [baseSnippet, aiDrill] });

        expect(result.current.snippet.id).toBe(aiDrill.id);
        expect(result.current.problemOptions.some((problem) => problem.id === aiDrill.problemId)).toBe(true);
    });

    it("picks a different problem when randomizing", () => {
        const { result } = renderControls();
        const firstProblemId = result.current.problemId;
        act(() => {
            result.current.handleRandomProblem();
        });
        expect(result.current.problemId).not.toBe(firstProblemId);
        expect(mockResetEngine).toHaveBeenCalled();
    });

    it("navigates to next problem", () => {
        const { result } = renderControls();
        const firstProblemId = result.current.problemId;
        act(() => {
            result.current.handleNextProblem();
        });
        if (result.current.problemOptions.length > 1) {
            expect(result.current.problemId).not.toBe(firstProblemId);
        }
        expect(mockResetEngine).toHaveBeenCalled();
    });
});
