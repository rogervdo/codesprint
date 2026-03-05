"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
    getProblemSnippets,
    getProblems,
    getSnippet,
    type Problem,
    type Snippet,
    type SnippetLength,
    type SupportedLanguage,
} from "@/lib/snippets";

export type LengthFilter = SnippetLength | "all";

export interface UseSessionControlsProps {
    snippets: Snippet[];
    onResetEngine: () => void;
    getNextRecommendation?: (availableIds: string[], currentId: string) => string | null;
}

export interface UseSessionControlsReturn {
    // Language
    language: SupportedLanguage;
    setLanguage: (lang: SupportedLanguage) => void;

    // Length preference
    lengthPreference: LengthFilter;
    setLengthPreference: (pref: LengthFilter) => void;

    // Problem selection
    problemOptions: Problem[];
    problemId: string;
    setProblemId: (id: string) => void;
    currentProblem: Problem | null;
    currentProblemIndex: number;

    // Snippet selection
    snippetOptions: Snippet[];
    snippetId: string;
    setSnippetId: (id: string) => void;
    snippet: Snippet;

    // Actions
    handleNextProblem: () => void;
}

/**
 * Hook to manage session controls including language, length, problem, and snippet selection
 * Extracted from TypingSession.tsx selection state management
 */
export function useSessionControls({
    snippets,
    onResetEngine,
    getNextRecommendation,
}: UseSessionControlsProps): UseSessionControlsReturn {
    const [language, setLanguage] = useState<SupportedLanguage>("python");
    const [lengthPreference, setLengthPreference] = useState<LengthFilter>("short");

    // Problem options based on language and length filter
    const problemOptions = useMemo<Problem[]>(() => {
        const options = getProblems(
            snippets,
            language,
            lengthPreference === "all" ? undefined : { length: lengthPreference }
        );
        return options;
    }, [language, lengthPreference, snippets]);

    const [problemId, setProblemId] = useState(() => problemOptions[0]?.id ?? "");

    // Auto-sync problemId when problemOptions changes
    useEffect(() => {
        if (problemOptions.length === 0) {
            if (problemId !== "") setProblemId("");
            return;
        }
        if (!problemOptions.some((problem) => problem.id === problemId)) {
            setProblemId(problemOptions[0].id);
        }
    }, [problemOptions, problemId]);

    // Snippet options based on selected problem
    const snippetOptions = useMemo<Snippet[]>(() => {
        if (!problemId) return [];
        const options = getProblemSnippets(
            snippets,
            language,
            problemId,
            lengthPreference === "all" ? undefined : { length: lengthPreference }
        );
        return options;
    }, [language, problemId, lengthPreference, snippets]);

    const [snippetId, setSnippetId] = useState(() => snippetOptions[0]?.id ?? "");

    // Auto-sync snippetId when snippetOptions changes
    useEffect(() => {
        if (snippetOptions.length === 0) {
            if (snippetId !== "") setSnippetId("");
            return;
        }
        if (!snippetOptions.some((option) => option.id === snippetId)) {
            setSnippetId(snippetOptions[0].id);
        }
    }, [snippetOptions, snippetId]);

    // Resolve the current snippet
    const snippet = useMemo(() => {
        if (snippetOptions.length === 0) {
            const filters = lengthPreference === "all" ? undefined : { length: lengthPreference };
            return getSnippet(snippets, language, filters);
        }
        const selected = snippetOptions.find((option) => option.id === snippetId);
        return selected ?? snippetOptions[0];
    }, [snippetOptions, snippetId, language, lengthPreference, snippets]);

    // Current problem info
    const currentProblemIndex = problemOptions.findIndex((problem) => problem.id === problemId);
    const currentProblem: Problem | null = currentProblemIndex >= 0 ? problemOptions[currentProblemIndex] : null;

    // Navigate to next problem
    const handleNextProblem = useCallback(() => {
        if (problemOptions.length === 0) {
            return;
        }

        // Check spaced repetition recommendation first
        if (getNextRecommendation) {
            const availableSnippetIds = snippetOptions.map((s) => s.id);
            const recommended = getNextRecommendation(availableSnippetIds, snippet.id);
            if (recommended) {
                const recSnippet = snippetOptions.find((s) => s.id === recommended);
                if (recSnippet) {
                    onResetEngine();
                    setProblemId(recSnippet.problemId);
                    setSnippetId(recSnippet.id);
                    return;
                }
            }
        }

        // Fall back to sequential cycling
        const currentIndex = problemOptions.findIndex((problem) => problem.id === problemId);
        const nextIndex = currentIndex >= 0 ? (currentIndex + 1) % problemOptions.length : 0;
        const nextProblem = problemOptions[nextIndex];

        onResetEngine();
        setProblemId(nextProblem.id);
    }, [problemId, problemOptions, snippetOptions, snippet, onResetEngine, getNextRecommendation]);

    return {
        language,
        setLanguage,
        lengthPreference,
        setLengthPreference,
        problemOptions,
        problemId,
        setProblemId,
        currentProblem,
        currentProblemIndex,
        snippetOptions,
        snippetId,
        setSnippetId,
        snippet,
        handleNextProblem,
    };
}
