"use client";

import { Stack } from "@chakra-ui/react";
import { motion } from "framer-motion";
import LiveStats from "@/components/LiveStats";
import ResultCard from "@/components/ResultCard";
import { getResultCardMotion } from "@/lib/motion-config";
import type { SupportedLanguage, SnippetLength } from "@/lib/snippets";
import type { ErrorEntry, HistoryEntry } from "@/hooks/useTypingEngine";

export interface ResultScreenProps {
    /** Adjusted WPM score */
    wpm: number;
    /** Accuracy percentage */
    accuracy: number;
    /** Time taken in milliseconds */
    timeMs: number;
    /** Number of errors */
    errors: number;
    /** Snippet title */
    snippetTitle: string;
    /** Snippet ID */
    snippetId: string;
    /** Programming language */
    language: SupportedLanguage;
    /** Snippet difficulty */
    difficulty: string;
    /** Snippet length category */
    lengthCategory: SnippetLength;
    /** Error log for analysis */
    errorLog: ErrorEntry[];
    /** Typing history for graphs */
    history: HistoryEntry[];
    /** Whether to show live stats panel */
    showLiveStats: boolean;
    /** Auto-advance deadline timestamp (null if not set) */
    autoAdvanceDeadline: number | null;
    /** Whether next problem action is available */
    canAdvance: boolean;
    /** Callback when next button is clicked */
    onNext: () => void;
    /** Whether user prefers reduced motion */
    prefersReducedMotion: boolean;
}

/**
 * Result screen shown when typing session is finished
 * Contains optional LiveStats and ResultCard
 */
export function ResultScreen({
    wpm,
    accuracy,
    timeMs,
    errors,
    snippetTitle,
    snippetId,
    language,
    difficulty,
    lengthCategory,
    errorLog,
    history,
    showLiveStats,
    autoAdvanceDeadline,
    canAdvance,
    onNext,
    prefersReducedMotion,
}: ResultScreenProps) {
    const resultCardMotion = getResultCardMotion(prefersReducedMotion);

    return (
        <motion.div
            key="result"
            {...resultCardMotion}
            style={{
                width: "100%",
                display: "flex",
                justifyContent: "center",
                marginTop: 32,
            }}
        >
            <Stack gap={5} align="center" w="100%" maxW="800px">
                {showLiveStats && (
                    <LiveStats wpm={wpm} accuracy={accuracy} label="Final WPM" />
                )}
                <ResultCard
                    wpm={wpm}
                    accuracy={accuracy}
                    timeMs={timeMs}
                    errors={errors}
                    onNext={canAdvance ? onNext : undefined}
                    autoAdvanceDeadline={autoAdvanceDeadline}
                    snippetTitle={snippetTitle}
                    snippetId={snippetId}
                    language={language}
                    difficulty={difficulty}
                    lengthCategory={lengthCategory}
                    errorLog={errorLog}
                    history={history}
                />
            </Stack>
        </motion.div>
    );
}
