"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { saveScore } from "@/lib/leaderboard";
import type { SupportedLanguage } from "@/lib/snippets";
import type { Phase } from "./useFocusManagement";

export interface UseSessionLifecycleProps {
    phase: Phase;
    snippetId: string;
    metrics: {
        adjustedWpm: number;
        accuracy: number;
    };
    language: SupportedLanguage;
    onResetEngine: () => void;
}

export interface UseSessionLifecycleReturn {
    /** Deadline timestamp for auto-advance (null if not set) */
    autoAdvanceDeadline: number | null;
    /** Clear any pending auto-advance */
    clearAutoAdvance: () => void;
    /** Set auto-advance with a duration in ms */
    setAutoAdvance: (durationMs: number) => void;
}

/**
 * Hook to manage session lifecycle including:
 * - Auto-advance timeout management
 * - Score saving on finish
 * - Engine reset on snippet change
 */
export function useSessionLifecycle({
    phase,
    snippetId,
    metrics,
    language,
    onResetEngine,
}: UseSessionLifecycleProps): UseSessionLifecycleReturn {
    const [autoAdvanceDeadline, setAutoAdvanceDeadline] = useState<number | null>(null);
    const autoAdvanceTimeoutRef = useRef<number | null>(null);

    const clearAutoAdvance = useCallback(() => {
        if (autoAdvanceTimeoutRef.current !== null) {
            window.clearTimeout(autoAdvanceTimeoutRef.current);
            autoAdvanceTimeoutRef.current = null;
        }
        setAutoAdvanceDeadline(null);
    }, []);

    const setAutoAdvance = useCallback((durationMs: number) => {
        clearAutoAdvance();
        setAutoAdvanceDeadline(Date.now() + durationMs);
        // Note: The actual timeout callback should be set up by the parent
        // This hook just manages the deadline state
    }, [clearAutoAdvance]);

    // Reset engine when snippet changes
    useEffect(() => {
        onResetEngine();
        clearAutoAdvance();
    }, [snippetId, onResetEngine, clearAutoAdvance]);

    // Save score on finish
    useEffect(() => {
        if (phase === "finished") {
            saveScore({
                wpm: metrics.adjustedWpm,
                accuracy: metrics.accuracy,
                language,
                snippetId,
            });
        }
    }, [phase, metrics.adjustedWpm, metrics.accuracy, language, snippetId]);

    return {
        autoAdvanceDeadline,
        clearAutoAdvance,
        setAutoAdvance,
    };
}
