"use client";

import { Button, Flex, Text, chakra } from "@chakra-ui/react";
import type { IconProps as ChakraIconProps } from "@chakra-ui/react";
import {
    TooltipContent,
    TooltipPositioner,
    TooltipRoot,
    TooltipTrigger,
} from "@chakra-ui/react";
import { ProgressIndicator, type ProgressIndicatorProps } from "./ProgressIndicator";
import { getNextProblemButtonStyles, getRandomizeButtonStyles } from "@/lib/session-styles";
import type { Problem } from "@/lib/snippets";

function ShuffleIcon(props: ChakraIconProps) {
    return (
        <chakra.svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
            focusable="false"
            {...props}
        >
            <path d="M2 18h1.4c1.3 0 2.5-.6 3.3-1.7l6.1-8.6c.8-1.1 2-1.7 3.3-1.7H22" />
            <path d="m18 2 4 4-4 4" />
            <path d="M2 6h1.9c1.5 0 2.9.9 3.6 2.2" />
            <path d="M22 18h-5.9c-1.3 0-2.6-.7-3.3-1.8l-.5-.8" />
            <path d="m18 14 4 4-4 4" />
        </chakra.svg>
    );
}

export interface SessionTopBarProps extends ProgressIndicatorProps {
    /** Current problem being practiced (null if none) */
    currentProblem: Problem | null;
    /** Total number of problems available */
    problemCount: number;
    /** Callback when next problem button is clicked */
    onNextProblem: () => void;
    /** Callback when randomize button is clicked */
    onRandomProblem: () => void;
    /** Callback when leaderboard button is clicked */
    onLeaderboardOpen: () => void;
}

/**
 * Top bar containing progress indicator, problem summary, and action buttons
 */
export function SessionTopBar({
    progress,
    isTerminalMode,
    isImmersive,
    showChrome,
    prefersReducedMotion,
    currentProblem,
    problemCount,
    onNextProblem,
    onRandomProblem,
    onLeaderboardOpen,
}: SessionTopBarProps) {
    const nextProblemButtonStyles = getNextProblemButtonStyles(isTerminalMode);
    const randomizeButtonStyles = getRandomizeButtonStyles(isTerminalMode);

    // Problem summary
    const problemSummary =
        problemCount > 0 ? (
            <Flex direction="column" gap={1} minW={0}>
                <Text fontSize="sm" fontWeight={600} color="var(--text)" whiteSpace="nowrap">
                    {problemCount} {problemCount === 1 ? "problem" : "problems"}
                </Text>
                <Text
                    fontSize="xs"
                    color="var(--text-subtle)"
                    whiteSpace="nowrap"
                    textOverflow="ellipsis"
                    overflow="hidden"
                >
                    Now practicing: {currentProblem ? currentProblem.title : "Random snippet"}
                </Text>
            </Flex>
        ) : (
            <Text fontSize="sm" fontWeight={600} color="var(--text)">
                No problems available
            </Text>
        );

    // Next problem button (only if multiple problems)
    const nextProblemButton =
        problemCount > 1 ? (
            <TooltipRoot>
                <TooltipTrigger asChild>
                    <Button onClick={onNextProblem} {...nextProblemButtonStyles}>
                        Next problem
                    </Button>
                </TooltipTrigger>
                <TooltipPositioner>
                    <TooltipContent
                        bg="var(--surface)"
                        color="var(--text)"
                        border="1px solid var(--border)"
                        fontSize="xs"
                        px={2}
                        py={1}
                    >
                        Press N or Q
                    </TooltipContent>
                </TooltipPositioner>
            </TooltipRoot>
        ) : null;

    const randomizeButton =
        problemCount > 1 ? (
            <TooltipRoot>
                <TooltipTrigger asChild>
                    <Button
                        onClick={onRandomProblem}
                        aria-label="Random problem"
                        {...randomizeButtonStyles}
                    >
                        <ShuffleIcon boxSize={4} />
                    </Button>
                </TooltipTrigger>
                <TooltipPositioner>
                    <TooltipContent
                        bg="var(--surface)"
                        color="var(--text)"
                        border="1px solid var(--border)"
                        fontSize="xs"
                        px={2}
                        py={1}
                    >
                        Random problem
                    </TooltipContent>
                </TooltipPositioner>
            </TooltipRoot>
        ) : null;

    // Check if we have content to show
    const progressIndicator = (
        <ProgressIndicator
            progress={progress}
            isTerminalMode={isTerminalMode}
            isImmersive={isImmersive}
            showChrome={showChrome}
            prefersReducedMotion={prefersReducedMotion}
        />
    );

    const hasMeta = Boolean(showChrome && (progressIndicator || problemSummary));
    const hasActions = Boolean(nextProblemButton || randomizeButton);

    if (!hasMeta && !hasActions) return null;

    return (
        <Flex
            align="center"
            justify={hasMeta && hasActions ? "space-between" : "flex-start"}
            gap={3}
            flexWrap="wrap"
        >
            {hasMeta && (
                <Flex align="center" gap={3} flexWrap="wrap">
                    {progressIndicator}
                    {problemSummary}
                </Flex>
            )}
            {hasActions && (
                <Flex align="center" gap={2} flexWrap="wrap" ml={hasMeta ? undefined : "auto"}>
                    <Button
                        size="sm"
                        variant="ghost"
                        color="var(--text-subtle)"
                        _hover={{ color: "var(--accent)", bg: "var(--surface-hover)" }}
                        onClick={onLeaderboardOpen}
                    >
                        Leaderboard
                    </Button>
                    {randomizeButton}
                    {nextProblemButton}
                </Flex>
            )}
        </Flex>
    );
}
