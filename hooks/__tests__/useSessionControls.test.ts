import { describe, it, expect, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useState } from "react";
import { useSessionControls } from "../useSessionControls";
import { CURATED_SNIPPETS_LIST, type Snippet, type SupportedLanguage } from "@/lib/snippets";

function makeSnippet(overrides: Partial<Snippet> = {}): Snippet {
    return {
        id: "python:base",
        problemId: "python:base",
        title: "Base",
        content: "def solve(values: list[int]) -> int:\n    return sum(values)\n",
        language: "python",
        lengthCategory: "short",
        difficulty: "easy",
        lines: 2,
        ...overrides,
    };
}

describe("useSessionControls", () => {
    const mockResetEngine = vi.fn();

    function renderControls(snippets = CURATED_SNIPPETS_LIST) {
        return renderHook(() => {
            const [language, setLanguage] = useState<SupportedLanguage>("python");
            return useSessionControls({ snippets, onResetEngine: mockResetEngine, language, setLanguage });
        });
    }

    it("initializes with default language (python) and length (short)", () => {
        const { result } = renderControls();
        expect(result.current.language).toBe("python");
        expect(result.current.lengthPreference).toBe("short");
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

    it("changes length preference", () => {
        const { result } = renderControls();
        act(() => {
            result.current.setLengthPreference("medium");
        });
        expect(result.current.lengthPreference).toBe("medium");
    });

    it("prefers a higher-variance problem when initializing", () => {
        const snippets: Snippet[] = [
            makeSnippet({
                id: "python:pandas-a",
                problemId: "python:pandas-a",
                title: "Pandas A",
                content: "import pandas as pd\n\ndef pandas_a(df: pd.DataFrame) -> pd.DataFrame:\n",
                lines: 3,
            }),
            makeSnippet({
                id: "python:full-a",
                problemId: "python:full-a",
                title: "Full A",
                content: "def full_a(values: list[int]) -> int:\n    total = 0\n    for value in values:\n        total += value\n    return total\n",
                lines: 5,
            }),
        ];

        const { result } = renderControls(snippets);
        expect(result.current.problemId).toBe("python:full-a");
    });

    it("skips low-variance pandas stubs when choosing next problem if alternatives exist", () => {
        const snippets: Snippet[] = [
            makeSnippet({
                id: "python:pandas-a",
                problemId: "python:pandas-a",
                title: "Pandas A",
                content: "import pandas as pd\n\ndef pandas_a(df: pd.DataFrame) -> pd.DataFrame:\n",
                lines: 3,
            }),
            makeSnippet({
                id: "python:full-a",
                problemId: "python:full-a",
                title: "Full A",
                content: "def full_a(values: list[int]) -> int:\n    return sum(values)\n",
                lines: 2,
            }),
            makeSnippet({
                id: "python:full-b",
                problemId: "python:full-b",
                title: "Full B",
                content: "def full_b(values: list[int]) -> int:\n    count = 0\n    for value in values:\n        count += value\n    return count\n",
                lines: 5,
            }),
        ];

        const { result } = renderControls(snippets);
        const initialProblemId = result.current.problemId;

        act(() => {
            result.current.handleNextProblem();
        });

        expect(result.current.problemId).not.toBe("python:pandas-a");
        expect(result.current.problemId).not.toBe(initialProblemId);
    });
});
