"use client";

import {
    Box,
    DialogBackdrop,
    DialogBody,
    DialogCloseTrigger,
    DialogContent,
    DialogHeader,
    DialogPositioner,
    DialogRoot,
    DialogTitle,
    Flex,
    Grid,
    Portal,
    Text,
} from "@chakra-ui/react";
import { useMemo, useState } from "react";
import {
    ACHIEVEMENTS,
    type AchievementCategory,
    type AchievementRarity,
} from "@/lib/achievements";

interface AchievementGalleryProps {
    isOpen: boolean;
    onClose: () => void;
    unlockedIds: Set<string>;
}

const RARITY_COLORS: Record<AchievementRarity, string> = {
    common: "var(--text-subtle)",
    rare: "#4299e1",
    epic: "#9f7aea",
    legendary: "#d69e2e",
};

const CATEGORIES: Array<{ value: AchievementCategory | "all"; label: string }> = [
    { value: "all", label: "All" },
    { value: "speed", label: "Speed" },
    { value: "accuracy", label: "Accuracy" },
    { value: "consistency", label: "Consistency" },
    { value: "exploration", label: "Exploration" },
    { value: "milestone", label: "Milestone" },
    { value: "improvement", label: "Improvement" },
    { value: "challenge", label: "Challenge" },
    { value: "special", label: "Special" },
];

export default function AchievementGallery({ isOpen, onClose, unlockedIds }: AchievementGalleryProps) {
    const [selectedCategory, setSelectedCategory] = useState<AchievementCategory | "all">("all");

    const filtered = useMemo(
        () =>
            selectedCategory === "all"
                ? ACHIEVEMENTS
                : ACHIEVEMENTS.filter((a) => a.category === selectedCategory),
        [selectedCategory],
    );

    const unlockedCount = unlockedIds.size;
    const totalCount = ACHIEVEMENTS.length;
    const progress = totalCount > 0 ? unlockedCount / totalCount : 0;

    return (
        <DialogRoot
            open={isOpen}
            onOpenChange={({ open }) => {
                if (!open) onClose();
            }}
            size="xl"
            placement="center"
            scrollBehavior="inside"
        >
            <Portal>
                <DialogBackdrop backdropFilter="blur(6px)" />
                <DialogPositioner>
                    <DialogContent
                        bg="var(--panel-soft)"
                        backdropFilter="blur(12px)"
                        border="1px solid var(--border)"
                    >
                        <DialogCloseTrigger />
                        <DialogHeader borderBottom="1px solid var(--border)">
                            <DialogTitle fontSize="xl" fontWeight="bold" color="var(--accent)">
                                Achievements
                            </DialogTitle>
                        </DialogHeader>
                        <DialogBody py={4}>
                            {/* Progress bar */}
                            <Flex align="center" gap={3} mb={5}>
                                <Text fontSize="sm" fontWeight={600} color="var(--text)" whiteSpace="nowrap">
                                    {unlockedCount}/{totalCount} Unlocked
                                </Text>
                                <Box flex={1} h="6px" bg="var(--surface)" borderRadius="full" overflow="hidden">
                                    <Box
                                        h="100%"
                                        w={`${progress * 100}%`}
                                        bg="var(--accent)"
                                        borderRadius="full"
                                        transition="width 0.3s ease"
                                    />
                                </Box>
                            </Flex>

                            {/* Category filter */}
                            <Flex gap={2} mb={5} overflowX="auto" pb={1} flexWrap="wrap">
                                {CATEGORIES.map((cat) => {
                                    const active = selectedCategory === cat.value;
                                    return (
                                        <Box
                                            as="button"
                                            key={cat.value}
                                            px={3}
                                            py={1.5}
                                            borderRadius="full"
                                            fontSize="xs"
                                            fontWeight={600}
                                            border="1px solid"
                                            borderColor={active ? "var(--border-strong)" : "var(--border)"}
                                            bg={active ? "var(--surface-active)" : "transparent"}
                                            color={active ? "var(--text)" : "var(--text-subtle)"}
                                            cursor="pointer"
                                            whiteSpace="nowrap"
                                            _hover={{ bg: "var(--surface-hover)", color: "var(--text)" }}
                                            onClick={() => setSelectedCategory(cat.value)}
                                        >
                                            {cat.label}
                                        </Box>
                                    );
                                })}
                            </Flex>

                            {/* Achievement grid */}
                            <Grid
                                templateColumns={{
                                    base: "repeat(2, 1fr)",
                                    md: "repeat(3, 1fr)",
                                    lg: "repeat(4, 1fr)",
                                }}
                                gap={3}
                            >
                                {filtered.map((achievement) => {
                                    const unlocked = unlockedIds.has(achievement.id);
                                    return (
                                        <Box
                                            key={achievement.id}
                                            p={3}
                                            borderRadius="lg"
                                            border="1px solid var(--border)"
                                            bg="var(--surface)"
                                            opacity={unlocked ? 1 : 0.4}
                                            filter={unlocked ? "none" : "grayscale(1)"}
                                            transition="opacity 0.2s, filter 0.2s"
                                        >
                                            <Flex align="center" gap={2} mb={1}>
                                                <Text fontSize="xl" lineHeight={1}>
                                                    {achievement.icon}
                                                </Text>
                                                <Text
                                                    fontSize="2xs"
                                                    fontWeight={600}
                                                    textTransform="uppercase"
                                                    letterSpacing="0.05em"
                                                    color={RARITY_COLORS[achievement.rarity]}
                                                >
                                                    {achievement.rarity}
                                                </Text>
                                            </Flex>
                                            <Text fontSize="sm" fontWeight={700} color="var(--text)" truncate>
                                                {achievement.name}
                                            </Text>
                                            <Text fontSize="xs" color="var(--text-subtle)" lineClamp={2}>
                                                {achievement.description}
                                            </Text>
                                        </Box>
                                    );
                                })}
                            </Grid>
                        </DialogBody>
                    </DialogContent>
                </DialogPositioner>
            </Portal>
        </DialogRoot>
    );
}
