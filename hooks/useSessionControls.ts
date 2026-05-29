"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ContentFilters } from "@/lib/snippets";
import {
    getSnippetVarietyScore,
    getSnippetVarianceTag,
    getProblemSnippets,
    getProblems,
    getSnippet,
    PLACEHOLDER_SNIPPET,
    type Problem,
    type Snippet,
    type SupportedLanguage,
} from "@/lib/snippets";

export interface UseSessionControlsProps {
    snippets: Snippet[];
    onResetEngine: () => void;
    getNextRecommendation?: (availableIds: string[], currentId: string) => string | null;
    language: SupportedLanguage;
    setLanguage: (lang: SupportedLanguage) => void;
    contentFilters: ContentFilters;
}

export interface UseSessionControlsReturn {
    language: SupportedLanguage;
    setLanguage: (lang: SupportedLanguage) => void;
    contentFilters: ContentFilters;
    problemOptions: Problem[];
    problemId: string;
    setProblemId: (id: string) => void;
    currentProblem: Problem | null;
    currentProblemIndex: number;
    snippetOptions: Snippet[];
    snippetId: string;
    setSnippetId: (id: string) => void;
    snippet: Snippet;
    hasMatchingSnippets: boolean;
    handleNextProblem: () => void;
    handleRandomProblem: () => void;
    setSnippet: (snippet: Snippet) => void;
}

const RECENT_PROBLEM_WINDOW = 10;
const RECENT_VARIANCE_WINDOW = 6;
const VARIETY_POOL_SIZE = 5;

function pushRecent(history: string[], nextValue: string, limit: number): string[] {
    const withoutDup = history.filter((value) => value !== nextValue);
    withoutDup.push(nextValue);
    return withoutDup.slice(-limit);
}

function pickPreferredProblemId(problemOptions: Problem[], representativeByProblem: Map<string, Snippet>): string {
    if (problemOptions.length === 0) return "";

    const sorted = [...problemOptions].sort((a, b) => {
        const snippetA = representativeByProblem.get(a.id);
        const snippetB = representativeByProblem.get(b.id);
        const scoreA = snippetA ? getSnippetVarietyScore(snippetA) : Number.NEGATIVE_INFINITY;
        const scoreB = snippetB ? getSnippetVarietyScore(snippetB) : Number.NEGATIVE_INFINITY;
        if (scoreA !== scoreB) return scoreB - scoreA;
        return a.title.localeCompare(b.title);
    });

    return sorted[0]?.id ?? "";
}

export function useSessionControls({
    snippets,
    onResetEngine,
    getNextRecommendation,
    language,
    setLanguage,
    contentFilters,
}: UseSessionControlsProps): UseSessionControlsReturn {
    const [explicitSnippet, setExplicitSnippet] = useState<Snippet | null>(null);
    const recentProblemIdsRef = useRef<string[]>([]);
    const recentVarianceTagsRef = useRef<string[]>([]);
    const nextPoolOffsetRef = useRef(0);

    const filteredSnippets = useMemo(
        () =>
            snippets.filter(
                (s) =>
                    s.id !== PLACEHOLDER_SNIPPET.id &&
                    s.language === language &&
                    contentFilters.types.includes(s.type) &&
                    s.topics.some((topic) => contentFilters.topics.includes(topic))
            ),
        [snippets, language, contentFilters]
    );

    const hasMatchingSnippets = filteredSnippets.length > 0;

    const problemOptions = useMemo<Problem[]>(
        () => getProblems(snippets, language, contentFilters),
        [language, contentFilters, snippets]
    );

    const representativeByProblem = useMemo(() => {
        const map = new Map<string, Snippet>();
        for (const snippet of filteredSnippets) {
            const existing = map.get(snippet.problemId);
            if (!existing || getSnippetVarietyScore(snippet) > getSnippetVarietyScore(existing)) {
                map.set(snippet.problemId, snippet);
            }
        }
        return map;
    }, [filteredSnippets]);

    const preferredProblemId = useMemo(
        () => pickPreferredProblemId(problemOptions, representativeByProblem),
        [problemOptions, representativeByProblem]
    );

    const [problemId, setProblemIdState] = useState(() => preferredProblemId);

    const setLanguageAndClearSnippet = useCallback(
        (lang: SupportedLanguage) => {
            setExplicitSnippet(null);
            setLanguage(lang);
        },
        [setLanguage]
    );

    const setProblemId = useCallback((id: string) => {
        setExplicitSnippet(null);
        setProblemIdState(id);
    }, []);

    useEffect(() => {
        recentProblemIdsRef.current = [];
        recentVarianceTagsRef.current = [];
        nextPoolOffsetRef.current = 0;
    }, [language, contentFilters]);

    useEffect(() => {
        if (problemOptions.length === 0) {
            if (explicitSnippet?.problemId === problemId) return;
            if (problemId !== "") setProblemIdState("");
            return;
        }
        if (explicitSnippet?.problemId === problemId) return;
        if (!problemOptions.some((problem) => problem.id === problemId)) {
            setProblemIdState(preferredProblemId || problemOptions[0].id);
        }
    }, [problemOptions, problemId, preferredProblemId, explicitSnippet]);

    const snippetOptions = useMemo<Snippet[]>(() => {
        if (!problemId) return [];
        return getProblemSnippets(snippets, language, problemId, contentFilters);
    }, [language, problemId, contentFilters, snippets]);

    const [snippetId, setSnippetIdState] = useState(() => snippetOptions[0]?.id ?? "");

    const setSnippetId = useCallback((id: string) => {
        setExplicitSnippet(null);
        setSnippetIdState(id);
    }, []);

    useEffect(() => {
        if (snippetOptions.length === 0) {
            if (explicitSnippet?.problemId === problemId && explicitSnippet.id === snippetId) return;
            if (snippetId !== "") setSnippetIdState("");
            return;
        }
        if (explicitSnippet?.problemId === problemId && explicitSnippet.id === snippetId) return;
        if (!snippetOptions.some((option) => option.id === snippetId)) {
            setSnippetIdState(snippetOptions[0].id);
        }
    }, [snippetOptions, snippetId, explicitSnippet, problemId]);

    const snippet = useMemo(() => {
        const selected = snippetOptions.find((option) => option.id === snippetId);
        if (selected) return selected;

        if (
            explicitSnippet &&
            explicitSnippet.id === snippetId &&
            explicitSnippet.problemId === problemId &&
            explicitSnippet.language === language
        ) {
            return explicitSnippet;
        }

        if (snippetOptions.length > 0) {
            return snippetOptions[0];
        }

        return getSnippet(snippets, language, contentFilters);
    }, [snippetOptions, snippetId, explicitSnippet, problemId, language, contentFilters, snippets]);

    useEffect(() => {
        if (!snippet?.id || snippet.id === PLACEHOLDER_SNIPPET.id) return;
        recentProblemIdsRef.current = pushRecent(recentProblemIdsRef.current, snippet.problemId, RECENT_PROBLEM_WINDOW);
        const varianceTag = getSnippetVarianceTag(snippet);
        recentVarianceTagsRef.current = pushRecent(recentVarianceTagsRef.current, varianceTag, RECENT_VARIANCE_WINDOW);
    }, [snippet]);

    const currentProblemIndex = problemOptions.findIndex((problem) => problem.id === problemId);
    const currentProblem: Problem | null = currentProblemIndex >= 0 ? problemOptions[currentProblemIndex] : null;

    const pickRandomProblemAndSnippet = useCallback(() => {
        if (problemOptions.length === 0) return;

        const candidateProblems =
            problemOptions.length > 1
                ? problemOptions.filter((problem) => problem.id !== problemId)
                : problemOptions;
        const randomProblem =
            candidateProblems[Math.floor(Math.random() * candidateProblems.length)];
        if (!randomProblem) return;

        const options = getProblemSnippets(snippets, language, randomProblem.id, contentFilters);
        const randomSnippet =
            options.length > 0 ? options[Math.floor(Math.random() * options.length)] : null;

        onResetEngine();
        setExplicitSnippet(null);
        setProblemIdState(randomProblem.id);
        if (randomSnippet) {
            setSnippetIdState(randomSnippet.id);
        }
    }, [
        problemId,
        problemOptions,
        snippets,
        language,
        contentFilters,
        onResetEngine,
    ]);

    const handleRandomProblem = useCallback(() => {
        if (problemOptions.length === 0) return;

        if (getNextRecommendation) {
            const availableSnippetIds = filteredSnippets.map((s) => s.id);
            const pool = availableSnippetIds.filter((id) => id !== snippet.id);
            const pickFrom = pool.length > 0 ? pool : availableSnippetIds;
            if (pickFrom.length > 0) {
                const randomId = pickFrom[Math.floor(Math.random() * pickFrom.length)];
                const randomSnippet = filteredSnippets.find((s) => s.id === randomId);
                if (randomSnippet) {
                    onResetEngine();
                    setExplicitSnippet(null);
                    setProblemIdState(randomSnippet.problemId);
                    setSnippetIdState(randomSnippet.id);
                    return;
                }
            }
        }

        pickRandomProblemAndSnippet();
    }, [
        problemOptions,
        getNextRecommendation,
        filteredSnippets,
        snippet.id,
        onResetEngine,
        pickRandomProblemAndSnippet,
    ]);

    const handleNextProblem = useCallback(() => {
        if (problemOptions.length === 0) {
            return;
        }

        if (getNextRecommendation) {
            const availableSnippetIds = filteredSnippets.map((s) => s.id);
            const recommended = getNextRecommendation(availableSnippetIds, snippet.id);
            if (recommended) {
                const recSnippet = filteredSnippets.find((s) => s.id === recommended);
                if (recSnippet) {
                    onResetEngine();
                    setExplicitSnippet(null);
                    setProblemIdState(recSnippet.problemId);
                    setSnippetIdState(recSnippet.id);
                    return;
                }
            }
        }

        const candidateProblems = problemOptions.filter((problem) => problem.id !== problemId);
        if (candidateProblems.length === 0) {
            return;
        }

        const ranked = candidateProblems
            .map((problem) => {
                const rep = representativeByProblem.get(problem.id);
                const varietyScore = rep ? getSnippetVarietyScore(rep) : -100;
                const varianceTag = rep ? getSnippetVarianceTag(rep) : "full";
                const seenProblemPenalty = recentProblemIdsRef.current.includes(problem.id) ? 20 : 0;
                const seenVariancePenalty = recentVarianceTagsRef.current.includes(varianceTag) ? 6 : 0;
                return {
                    problem,
                    rank: varietyScore - seenProblemPenalty - seenVariancePenalty,
                };
            })
            .sort((a, b) => (a.rank === b.rank ? a.problem.title.localeCompare(b.problem.title) : b.rank - a.rank));

        const poolSize = Math.min(VARIETY_POOL_SIZE, ranked.length);
        const poolIndex = nextPoolOffsetRef.current % poolSize;
        nextPoolOffsetRef.current += 1;
        const nextProblem = ranked[poolIndex]?.problem ?? ranked[0]?.problem;
        if (!nextProblem) return;

        onResetEngine();
        setExplicitSnippet(null);
        setProblemIdState(nextProblem.id);
    }, [
        problemId,
        problemOptions,
        snippet,
        onResetEngine,
        getNextRecommendation,
        representativeByProblem,
        filteredSnippets,
    ]);

    const setSnippet = useCallback(
        (newSnippet: Snippet) => {
            onResetEngine();
            setExplicitSnippet(newSnippet);
            setLanguage(newSnippet.language);
            setProblemIdState(newSnippet.problemId);
            setSnippetIdState(newSnippet.id);
        },
        [onResetEngine, setLanguage]
    );

    return {
        language,
        setLanguage: setLanguageAndClearSnippet,
        contentFilters,
        problemOptions,
        problemId,
        setProblemId,
        currentProblem,
        currentProblemIndex,
        snippetOptions,
        snippetId,
        setSnippetId,
        snippet,
        hasMatchingSnippets,
        handleNextProblem,
        handleRandomProblem,
        setSnippet,
    };
}
