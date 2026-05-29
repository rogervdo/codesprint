"use client";

import { useCallback, useEffect, useState } from "react";
import type { SupportedLanguage } from "@/lib/snippets";
import type { SkillModelRecord, DifficultyTransition, SessionResult, Difficulty } from "@/lib/adaptive";
import {
    updateSkillModel as pureUpdateSkillModel,
    getDefaultSkillModel,
    describeDifficultyTransition,
} from "@/lib/adaptive";
import { idbGet, idbPut, STORES } from "@/lib/storage/idb-store";
import type { SkillModelRecord as IdbSkillModelRecord } from "@/lib/storage/idb-store";

export interface UseAdaptiveDifficultyReturn {
    skillModel: SkillModelRecord | null;
    suggestedDifficulty: Difficulty;
    updateSkillModel: (result: SessionResult) => Promise<DifficultyTransition>;
    isLoading: boolean;
}

export function useAdaptiveDifficulty(
    language: SupportedLanguage,
    enabled: boolean
): UseAdaptiveDifficultyReturn {
    const [skillModel, setSkillModel] = useState<SkillModelRecord | null>(null);
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        if (!enabled) {
            setSkillModel(null);
            return;
        }

        let cancelled = false;

        async function load() {
            setIsLoading(true);
            try {
                const stored = await idbGet<IdbSkillModelRecord>(STORES.skillModels, language);
                if (cancelled) return;

                if (stored) {
                    setSkillModel({
                        ...stored,
                        currentDifficulty: stored.currentDifficulty as Difficulty,
                    });
                } else {
                    setSkillModel(getDefaultSkillModel(language));
                }
            } catch (error) {
                console.error("[useAdaptiveDifficulty] Failed to load skill model:", error);
                if (!cancelled) {
                    setSkillModel(getDefaultSkillModel(language));
                }
            } finally {
                if (!cancelled) setIsLoading(false);
            }
        }

        load();
        return () => { cancelled = true; };
    }, [language, enabled]);

    const suggestedDifficulty: Difficulty = enabled
        ? (skillModel?.currentDifficulty ?? "easy")
        : "easy";

    const updateModel = useCallback(
        async (result: SessionResult): Promise<DifficultyTransition> => {
            if (!enabled || !skillModel) {
                return { newDifficulty: "easy", reason: "unchanged" };
            }

            try {
                const updated = pureUpdateSkillModel(skillModel, result);
                const transition = describeDifficultyTransition(skillModel.currentDifficulty, updated.currentDifficulty);

                await idbPut(STORES.skillModels, {
                    ...updated,
                    currentDifficulty: updated.currentDifficulty as string,
                });

                setSkillModel(updated);
                return transition;
            } catch (error) {
                console.error("[useAdaptiveDifficulty] Failed to update skill model:", error);
                return { newDifficulty: skillModel.currentDifficulty, reason: "unchanged" };
            }
        },
        [enabled, skillModel]
    );

    return {
        skillModel,
        suggestedDifficulty,
        updateSkillModel: updateModel,
        isLoading,
    };
}
