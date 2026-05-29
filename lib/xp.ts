import type { SnippetLength } from "@/lib/snippets";
import type { SnippetType } from "@/lib/catalog";

export type XpInput = {
    wpm: number;
    accuracy: number;
    contentType: SnippetType;
    lengthCategory: SnippetLength;
};

export type XpBreakdown = {
    base: number;
    wpmBonus: number;
    accuracyBonus: number;
    typeMult: number;
    lengthMult: number;
};

export type XpResult = {
    sessionXp: number;
    breakdown: XpBreakdown;
};

export type LevelInfo = {
    level: number;
    currentLevelXp: number;
    nextLevelXp: number;
    progress: number;
};

const TYPE_MULTIPLIERS: Record<SnippetType, number> = {
    template: 1,
    problem: 1.5,
};

const LENGTH_MULTIPLIERS: Record<SnippetLength, number> = {
    short: 1,
    medium: 1.3,
    long: 1.6,
};

export function computeSessionXp(input: XpInput): XpResult {
    const base = 10;
    const wpmBonus = input.wpm * 0.5;
    const accuracyBonus = input.accuracy > 0.95 ? 20 : 0;
    const typeMult = TYPE_MULTIPLIERS[input.contentType];
    const lengthMult = LENGTH_MULTIPLIERS[input.lengthCategory];

    const sessionXp = Math.round((base + wpmBonus + accuracyBonus) * typeMult * lengthMult);

    return {
        sessionXp,
        breakdown: {
            base,
            wpmBonus,
            accuracyBonus,
            typeMult,
            lengthMult,
        },
    };
}

export function xpRequiredForLevel(level: number): number {
    return Math.round(level * 100 * Math.pow(1.2, level - 1));
}

export function computeLevelFromXp(totalXp: number): LevelInfo {
    let level = 1;

    while (xpRequiredForLevel(level) <= totalXp) {
        level += 1;
    }

    const prevThreshold = level > 1 ? xpRequiredForLevel(level - 1) : 0;
    const nextThreshold = xpRequiredForLevel(level);
    const currentLevelXp = totalXp - prevThreshold;
    const nextLevelXp = nextThreshold - prevThreshold;
    const progress = Math.min(1, Math.max(0, currentLevelXp / nextLevelXp));

    return { level, currentLevelXp, nextLevelXp, progress };
}
