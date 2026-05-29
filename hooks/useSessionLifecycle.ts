"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { saveScore } from "@/lib/leaderboard";
import { createSessionAsync } from "@/lib/storage/session-history";
import type { SupportedLanguage, SnippetLength } from "@/lib/snippets";
import type { SnippetType } from "@/lib/catalog";
import type { HistoryEntry, ErrorEntry } from "@/hooks/useTypingEngine";
import type { Phase } from "./useFocusManagement";

export interface UseSessionLifecycleProps {
    phase: Phase;
    snippetId: string;
    metrics: {
        adjustedWpm: number;
        rawWpm: number;
        accuracy: number;
        patternScore?: number;
    };
    language: SupportedLanguage;
    elapsedMs: number;
    totalKeystrokes: number;
    correctKeystrokes: number;
    errorCount: number;
    history: HistoryEntry[];
    lengthCategory: SnippetLength;
    contentType: SnippetType;
    isAIDrill?: boolean;
    // NEW - for AI drill weak pattern aggregation
    errors?: ErrorEntry[];
    snippetContent?: string;
    onResetEngine: () => void;
    onSessionFinished?: (sessionData: {
        snippetId: string;
        language: SupportedLanguage;
        wpm: number;
        accuracy: number;
        patternScore?: number;
        contentType: SnippetType;
        lengthCategory: SnippetLength;
    }) => void;
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
    elapsedMs,
    totalKeystrokes,
    correctKeystrokes,
    errorCount,
    history,
    lengthCategory,
    contentType,
    isAIDrill,
    errors,
    snippetContent,
    onResetEngine,
    onSessionFinished,
}: UseSessionLifecycleProps): UseSessionLifecycleReturn {
    const [autoAdvanceDeadline, setAutoAdvanceDeadline] = useState<number | null>(null);
    const autoAdvanceTimeoutRef = useRef<number | null>(null);
    const hasSavedRef = useRef(false);

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
        hasSavedRef.current = false;
        onResetEngine();
        clearAutoAdvance();
    }, [snippetId, onResetEngine, clearAutoAdvance]);

    // Reset the save guard whenever phase leaves "finished" so that:
    // - Replaying the same snippet (R key) triggers a fresh save on re-completion
    // - Backspacing out of finished and re-finishing saves with corrected metrics
    useEffect(() => {
        if (phase !== "finished") {
            hasSavedRef.current = false;
        }
    }, [phase]);

    // Save score on finish
    useEffect(() => {
        if (phase !== "finished" || hasSavedRef.current) return;
        hasSavedRef.current = true;

        saveScore({
            wpm: metrics.adjustedWpm,
            accuracy: metrics.accuracy,
            language,
            snippetId,
        });

        createSessionAsync({
            snippetId,
            language,
            lengthCategory,
            contentType,
            ...(isAIDrill !== undefined ? { isAIDrill } : {}),
            wpm: metrics.adjustedWpm,
            rawWpm: metrics.rawWpm,
            accuracy: metrics.accuracy,
            elapsedMs,
            totalKeystrokes,
            correctKeystrokes,
            errorCount,
            history,
            patternScore: metrics.patternScore,
            errors,
            snippetContentLength: snippetContent?.length,
            snippetContent,
        }).catch(() => {
            // IndexedDB may be unavailable; legacy saveScore above provides fallback
        });

        if (onSessionFinished) {
            onSessionFinished({
                snippetId,
                language,
                wpm: metrics.adjustedWpm,
                accuracy: metrics.accuracy,
                patternScore: metrics.patternScore,
                contentType,
                lengthCategory,
            });
        }
    }, [phase, metrics.adjustedWpm, metrics.rawWpm, metrics.accuracy, metrics.patternScore, language, snippetId, elapsedMs, totalKeystrokes, correctKeystrokes, errorCount, history, lengthCategory, contentType, isAIDrill, onSessionFinished, errors, snippetContent]);

    return {
        autoAdvanceDeadline,
        clearAutoAdvance,
        setAutoAdvance,
    };
}
