import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";

// Mock leaderboard before importing the hook
vi.mock("@/lib/leaderboard", () => ({
    saveScore: vi.fn(),
}));

vi.mock("@/lib/storage/session-history", () => ({
    createSessionAsync: vi.fn().mockResolvedValue(undefined),
}));

import { useSessionLifecycle, type UseSessionLifecycleProps } from "../useSessionLifecycle";
import { saveScore } from "@/lib/leaderboard";
import { createSessionAsync } from "@/lib/storage/session-history";

const mockSaveScore = vi.mocked(saveScore);
const mockCreateSessionAsync = vi.mocked(createSessionAsync);

describe("useSessionLifecycle", () => {
    const mockResetEngine = vi.fn();

    const defaultProps: UseSessionLifecycleProps = {
        phase: "idle",
        snippetId: "snippet-1",
        metrics: { adjustedWpm: 80, rawWpm: 90, accuracy: 0.95 },
        language: "javascript",
        elapsedMs: 30000,
        totalKeystrokes: 200,
        correctKeystrokes: 190,
        errorCount: 5,
        history: [{ time: 1, wpm: 80, raw: 90, errors: 2, burst: 85 }],
        lengthCategory: "medium",
        contentType: "template",
        onResetEngine: mockResetEngine,
    };

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("starts with no auto-advance deadline", () => {
        const { result } = renderHook(() =>
            useSessionLifecycle(defaultProps)
        );
        expect(result.current.autoAdvanceDeadline).toBeNull();
    });

    it("setAutoAdvance sets a deadline in the future", () => {
        const before = Date.now();
        const { result } = renderHook(() =>
            useSessionLifecycle(defaultProps)
        );

        act(() => {
            result.current.setAutoAdvance(3000);
        });

        const after = Date.now();
        expect(result.current.autoAdvanceDeadline).not.toBeNull();
        expect(result.current.autoAdvanceDeadline).toBeGreaterThanOrEqual(before + 3000);
        expect(result.current.autoAdvanceDeadline).toBeLessThanOrEqual(after + 3000);
    });

    it("clearAutoAdvance removes the deadline", () => {
        const { result } = renderHook(() =>
            useSessionLifecycle(defaultProps)
        );

        act(() => {
            result.current.setAutoAdvance(3000);
        });
        expect(result.current.autoAdvanceDeadline).not.toBeNull();

        act(() => {
            result.current.clearAutoAdvance();
        });
        expect(result.current.autoAdvanceDeadline).toBeNull();
    });

    it("calling setAutoAdvance twice replaces the deadline", () => {
        const { result } = renderHook(() =>
            useSessionLifecycle(defaultProps)
        );

        act(() => {
            result.current.setAutoAdvance(1000);
        });
        const firstDeadline = result.current.autoAdvanceDeadline;

        act(() => {
            result.current.setAutoAdvance(5000);
        });
        const secondDeadline = result.current.autoAdvanceDeadline;

        expect(secondDeadline).not.toBeNull();
        expect(secondDeadline).toBeGreaterThan(firstDeadline!);
    });

    it("saves score when phase becomes finished", () => {
        const { rerender } = renderHook(
            (props) => useSessionLifecycle(props),
            { initialProps: defaultProps }
        );

        expect(mockSaveScore).not.toHaveBeenCalled();

        rerender({
            ...defaultProps,
            phase: "finished",
        });

        expect(mockSaveScore).toHaveBeenCalledOnce();
        expect(mockSaveScore).toHaveBeenCalledWith({
            wpm: defaultProps.metrics.adjustedWpm,
            accuracy: defaultProps.metrics.accuracy,
            language: defaultProps.language,
            snippetId: defaultProps.snippetId,
        });
    });

    it("does not save score while phase is running", () => {
        renderHook(() =>
            useSessionLifecycle({ ...defaultProps, phase: "running" })
        );
        expect(mockSaveScore).not.toHaveBeenCalled();
    });

    it("resets engine when snippetId changes", () => {
        const { rerender } = renderHook(
            (props) => useSessionLifecycle(props),
            { initialProps: defaultProps }
        );

        // Clear the initial mount call
        mockResetEngine.mockClear();

        rerender({ ...defaultProps, snippetId: "snippet-2" });

        expect(mockResetEngine).toHaveBeenCalledOnce();
    });

    it("clears auto-advance deadline when snippetId changes", () => {
        const { result, rerender } = renderHook(
            (props) => useSessionLifecycle(props),
            { initialProps: defaultProps }
        );

        act(() => {
            result.current.setAutoAdvance(3000);
        });
        expect(result.current.autoAdvanceDeadline).not.toBeNull();

        rerender({ ...defaultProps, snippetId: "snippet-2" });

        expect(result.current.autoAdvanceDeadline).toBeNull();
    });

    it("calls createSessionAsync when phase becomes finished", () => {
        const { rerender } = renderHook(
            (props) => useSessionLifecycle(props),
            { initialProps: defaultProps }
        );

        rerender({ ...defaultProps, phase: "finished" });

        expect(mockCreateSessionAsync).toHaveBeenCalledOnce();
        expect(mockCreateSessionAsync).toHaveBeenCalledWith({
            snippetId: defaultProps.snippetId,
            language: defaultProps.language,
            lengthCategory: defaultProps.lengthCategory,
            contentType: defaultProps.contentType,
            wpm: defaultProps.metrics.adjustedWpm,
            rawWpm: defaultProps.metrics.rawWpm,
            accuracy: defaultProps.metrics.accuracy,
            elapsedMs: defaultProps.elapsedMs,
            totalKeystrokes: defaultProps.totalKeystrokes,
            correctKeystrokes: defaultProps.correctKeystrokes,
            errorCount: defaultProps.errorCount,
            history: defaultProps.history,
            patternScore: undefined,
            errors: undefined,
            snippetContentLength: undefined,
            snippetContent: undefined,
        });
    });

    it("records AI drill status when provided", () => {
        const { rerender } = renderHook(
            (props) => useSessionLifecycle(props),
            { initialProps: { ...defaultProps, isAIDrill: true } }
        );

        rerender({ ...defaultProps, isAIDrill: true, phase: "finished" });

        expect(mockCreateSessionAsync).toHaveBeenCalledWith(expect.objectContaining({
            snippetId: defaultProps.snippetId,
            isAIDrill: true,
        }));
    });

    it("passes correct metrics to saveScore", () => {
        const customMetrics = { adjustedWpm: 120, rawWpm: 130, accuracy: 0.98 };
        const { rerender } = renderHook(
            (props) => useSessionLifecycle(props),
            {
                initialProps: {
                    ...defaultProps,
                    metrics: customMetrics,
                },
            }
        );

        rerender({
            ...defaultProps,
            metrics: customMetrics,
            phase: "finished",
        });

        expect(mockSaveScore).toHaveBeenCalledWith({
            wpm: 120,
            accuracy: 0.98,
            language: defaultProps.language,
            snippetId: defaultProps.snippetId,
        });
    });
});
