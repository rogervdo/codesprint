"use client";

import {
    Button,
    Flex,
    Text,
    Badge,
    TooltipRoot,
    TooltipTrigger,
    TooltipPositioner,
    TooltipContent,
} from "@chakra-ui/react";
import { AnimatePresence, motion } from "framer-motion";
import { getPillButtonStyles, getStartButtonStyles, SESSION_CSS_VARS } from "@/lib/session-styles";
import { getControlsMotion, getStartButtonMotion } from "@/lib/motion-config";
import type { SupportedLanguage } from "@/lib/snippets";
import type { Phase } from "@/hooks/useFocusManagement";
import {
    SNIPPET_TYPES,
    SNIPPET_TYPE_LABELS,
    getTopicLabelsForType,
    getTopicsForType,
    type CatalogTopic,
    type SnippetType,
} from "@/lib/catalog";
import { getActiveProvider } from "@/lib/ai/key-storage";
import { checkRateLimit } from "@/lib/ai/rate-limiter";
import { useAIDrills } from "@/hooks/useAIDrills";
import { usePreferences } from "@/lib/preferences";

export type SurfaceStyle = "panel" | "immersive";

export interface SessionControlBarProps {
    language: SupportedLanguage;
    onLanguageChange: (lang: SupportedLanguage) => void;
    contentType: SnippetType;
    onContentTypeChange: (type: SnippetType) => void;
    selectedTopics: CatalogTopic[];
    onToggleTopic: (topic: CatalogTopic) => void;
    surfaceStyle: SurfaceStyle;
    onSurfaceChange: (style: SurfaceStyle) => void;
    onStart: () => void;
    phase: Phase;
    disabled: boolean;
    isTerminalMode: boolean;
    prefersReducedMotion: boolean;
    dueCount?: number;
    canStart?: boolean;
    onOpenAIDrill?: () => void;
}

const LANGUAGE_OPTIONS: Array<{ value: SupportedLanguage; label: string }> = [
    { value: "javascript", label: "JavaScript" },
    { value: "python", label: "Python" },
];

const SURFACE_OPTIONS: Array<{ value: SurfaceStyle; label: string }> = [
    { value: "panel", label: "Framed" },
    { value: "immersive", label: "Immersive" },
];

export function SessionControlBar({
    language,
    onLanguageChange,
    contentType,
    onContentTypeChange,
    selectedTopics,
    onToggleTopic,
    surfaceStyle,
    onSurfaceChange,
    onStart,
    phase,
    disabled,
    isTerminalMode,
    prefersReducedMotion,
    dueCount,
    canStart = true,
    onOpenAIDrill,
}: SessionControlBarProps) {
    const { panelGlass, border } = SESSION_CSS_VARS;
    const controlsMotion = getControlsMotion(prefersReducedMotion);
    const startButtonMotion = getStartButtonMotion(prefersReducedMotion);
    const startButtonStyles = getStartButtonStyles(isTerminalMode);

    const { preferences } = usePreferences();
    const ai = useAIDrills(preferences);
    const showAIDrill =
        preferences.aiDrillsEnabled &&
        getActiveProvider() !== null &&
        phase !== "running" &&
        phase !== "countdown";
    const rateLimit = checkRateLimit(preferences.aiMaxDrillsPerDay);
    const topicOptions = getTopicsForType(contentType);
    const topicLabels = getTopicLabelsForType(contentType);

    return (
        <motion.div
            style={{
                display: "flex",
                flexDirection: "column",
                gap: "8px",
                padding: "8px 12px",
                borderRadius: "8px",
                background: panelGlass,
                backdropFilter: "blur(12px)",
                border: `1px solid ${border}`,
                boxShadow: "var(--shadow)",
            }}
            {...controlsMotion}
            layout
        >
            <Flex gap={2} flexWrap="wrap" align="center">
                <Text fontSize="xs" color="var(--text-subtle)" fontWeight={600} minW="3.5rem">
                    Language
                </Text>
                {LANGUAGE_OPTIONS.map((option) => (
                    <Button
                        key={option.value}
                        {...getPillButtonStyles(language === option.value, isTerminalMode)}
                        onClick={() => onLanguageChange(option.value)}
                        disabled={disabled}
                    >
                        {option.label}
                    </Button>
                ))}

                <Flex gap={2} flexWrap="wrap" align="center" ml="auto">
                    {SURFACE_OPTIONS.map((option) => (
                        <Button
                            key={option.value}
                            {...getPillButtonStyles(surfaceStyle === option.value, isTerminalMode)}
                            onClick={() => onSurfaceChange(option.value)}
                            disabled={disabled}
                        >
                            {option.label}
                        </Button>
                    ))}
                </Flex>
            </Flex>

            <Flex gap={2} flexWrap="wrap" align="center">
                <Text fontSize="xs" color="var(--text-subtle)" fontWeight={600} minW="3.5rem">
                    Type
                </Text>
                {SNIPPET_TYPES.map((type) => (
                    <Button
                        key={type}
                        {...getPillButtonStyles(contentType === type, isTerminalMode)}
                        onClick={() => onContentTypeChange(type)}
                        disabled={disabled}
                    >
                        {SNIPPET_TYPE_LABELS[type]}
                    </Button>
                ))}
            </Flex>

            <Flex gap={2} flexWrap="wrap" align="flex-start">
                <Text fontSize="xs" color="var(--text-subtle)" fontWeight={600} minW="3.5rem" pt={1}>
                    Topics
                </Text>
                <Flex gap={2} flexWrap="wrap" flex={1}>
                    {topicOptions.map((topic) => (
                        <Button
                            key={topic}
                            size="sm"
                            {...getPillButtonStyles(selectedTopics.includes(topic), isTerminalMode)}
                            onClick={() => onToggleTopic(topic)}
                            disabled={disabled}
                        >
                            {topicLabels[topic]}
                        </Button>
                    ))}
                </Flex>
            </Flex>

            <Flex gap={2} flexWrap="wrap" align="center" justify="flex-end">
                {dueCount !== undefined && dueCount > 0 && (
                    <Text fontSize="xs" color="var(--accent)" fontWeight={600} px={2}>
                        📚 {dueCount} due
                    </Text>
                )}

                {showAIDrill && (
                    <TooltipRoot>
                        <TooltipTrigger asChild>
                            <Button
                                {...getPillButtonStyles(false, isTerminalMode)}
                                onClick={onOpenAIDrill}
                                disabled={!rateLimit.allowed}
                            >
                                ⚡ AI
                                <Badge ml={1} size="sm">
                                    {ai.remainingToday}
                                </Badge>
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
                                {!rateLimit.allowed ? rateLimit.reason : "Generate AI drill (Shift+A)"}
                            </TooltipContent>
                        </TooltipPositioner>
                    </TooltipRoot>
                )}

                <AnimatePresence>
                    {phase === "idle" && (
                        <motion.div {...startButtonMotion} layout style={{ display: "inline-flex" }}>
                            <Button onClick={onStart} {...startButtonStyles} disabled={!canStart}>
                                Start
                            </Button>
                        </motion.div>
                    )}
                </AnimatePresence>
            </Flex>
        </motion.div>
    );
}
