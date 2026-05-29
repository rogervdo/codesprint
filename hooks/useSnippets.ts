import { useCallback, useEffect, useRef, useState } from "react";
import { normalizeCatalog, type Snippet, type SupportedLanguage } from "@/lib/snippets";
import { toSnippet, isAcceptedAIDrill } from "@/lib/ai/snippet-bridge";
import type { CustomSnippetRecord } from "@/lib/storage/idb-store";

export function useSnippets(_currentLanguage: SupportedLanguage = "python") {
    const [catalogSnippets, setCatalogSnippets] = useState<Snippet[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const aiDrillsRef = useRef<Snippet[]>([]);

    const loadAIDrills = useCallback(async (): Promise<Snippet[]> => {
        try {
            const { idbGetAll, STORES } = await import("@/lib/storage/idb-store");
            const customSnippets = await idbGetAll<CustomSnippetRecord>(STORES.customSnippets);
            return customSnippets.filter(isAcceptedAIDrill).map(toSnippet);
        } catch (error) {
            console.error("Failed to load AI drills:", error);
            return [];
        }
    }, []);

    const rebuildSnippets = useCallback(() => {
        return [...catalogSnippets, ...aiDrillsRef.current];
    }, [catalogSnippets]);

    const [snippets, setSnippets] = useState<Snippet[]>([]);

    useEffect(() => {
        setSnippets(rebuildSnippets());
    }, [rebuildSnippets]);

    useEffect(() => {
        let mounted = true;

        async function loadCatalog() {
            try {
                const imported = await import("@/data/snippets-catalog.json");
                if (!mounted) return;
                setCatalogSnippets(normalizeCatalog(imported.default));
            } catch (error) {
                console.error("Failed to load snippet catalog:", error);
                if (mounted) setCatalogSnippets([]);
            } finally {
                if (mounted) setIsLoading(false);
            }
        }

        async function loadAll() {
            const aiDrills = await loadAIDrills();
            if (!mounted) return;
            aiDrillsRef.current = aiDrills;
            await loadCatalog();
        }

        loadAll();

        return () => {
            mounted = false;
        };
    }, [loadAIDrills]);

    const refreshAIDrills = useCallback(async () => {
        aiDrillsRef.current = await loadAIDrills();
        setSnippets(rebuildSnippets());
    }, [loadAIDrills, rebuildSnippets]);

    return { snippets, isLoading, refreshAIDrills };
}
