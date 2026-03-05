import { describe, it, expect, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useSessionControls } from "../useSessionControls";
import { CURATED_SNIPPETS_LIST } from "@/lib/snippets";

describe("useSessionControls", () => {
    const mockResetEngine = vi.fn();

    function renderControls(snippets = CURATED_SNIPPETS_LIST) {
        return renderHook(() =>
            useSessionControls({ snippets, onResetEngine: mockResetEngine })
        );
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
});
