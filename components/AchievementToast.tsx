"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Box, Flex, Text } from "@chakra-ui/react";
import { useEffect, useState } from "react";
import type { AchievementDefinition, AchievementRarity } from "@/lib/achievements";

interface AchievementToastProps {
    achievements: AchievementDefinition[];
    onDismiss: () => void;
}

const RARITY_COLORS: Record<AchievementRarity, string> = {
    common: "var(--text-subtle)",
    rare: "#4299e1",
    epic: "#9f7aea",
    legendary: "#d69e2e",
};

const MAX_VISIBLE = 3;
const AUTO_DISMISS_MS = 4000;

export default function AchievementToast({ achievements, onDismiss }: AchievementToastProps) {
    const [visible, setVisible] = useState<AchievementDefinition[]>(
        () => achievements.slice(0, MAX_VISIBLE),
    );

    useEffect(() => {
        if (visible.length === 0) {
            onDismiss();
            return;
        }

        const timers = visible.map((achievement, i) =>
            setTimeout(() => {
                setVisible((prev) => prev.filter((a) => a.id !== achievement.id));
            }, AUTO_DISMISS_MS + i * 600),
        );

        return () => timers.forEach(clearTimeout);
    }, [visible.length, onDismiss]);

    return (
        <Box position="fixed" bottom={6} right={6} zIndex={50} display="flex" flexDirection="column-reverse" gap={3}>
            <AnimatePresence>
                {visible.map((achievement) => (
                    <motion.div
                        key={achievement.id}
                        initial={{ x: 100, opacity: 0 }}
                        animate={{ x: 0, opacity: 1 }}
                        exit={{ x: 100, opacity: 0 }}
                        transition={{ type: "spring", stiffness: 300, damping: 25 }}
                    >
                        <Flex
                            align="center"
                            gap={3}
                            px={4}
                            py={3}
                            bg="var(--panel)"
                            border="1px solid var(--border)"
                            borderRadius="lg"
                            backdropFilter="blur(12px)"
                            boxShadow="var(--shadow)"
                            minW="280px"
                            maxW="360px"
                        >
                            <Text fontSize="2xl" lineHeight={1}>
                                {achievement.icon}
                            </Text>
                            <Box flex={1} minW={0}>
                                <Flex align="center" gap={2}>
                                    <Text fontWeight={700} fontSize="sm" color="var(--text)" truncate>
                                        {achievement.name}
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
                                <Text fontSize="xs" color="var(--text-subtle)" truncate>
                                    {achievement.description}
                                </Text>
                            </Box>
                        </Flex>
                    </motion.div>
                ))}
            </AnimatePresence>
        </Box>
    );
}
