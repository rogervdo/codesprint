import { describe, it, expect, beforeEach, vi } from "vitest";
import "fake-indexeddb/auto";
import { resetDbConnection, idbGet, idbGetAll, idbClear, STORES } from "../idb-store";
import type { MetaRecord } from "../idb-store";
import { runMigrations, CURRENT_VERSION, MIGRATION_VERSION_KEY } from "../migration";

const LS_KEY = "codesprint-session-history";

// Mock window.localStorage since jsdom's implementation is incomplete
// when the project path contains ':'
const mockStore: Record<string, string> = {};
const mockLocalStorage = {
    getItem: vi.fn((key: string) => mockStore[key] ?? null),
    setItem: vi.fn((key: string, value: string) => { mockStore[key] = value; }),
    removeItem: vi.fn((key: string) => { delete mockStore[key]; }),
    clear: vi.fn(() => { for (const key of Object.keys(mockStore)) delete mockStore[key]; }),
    get length() { return Object.keys(mockStore).length; },
    key: vi.fn((index: number) => Object.keys(mockStore)[index] ?? null),
};

Object.defineProperty(window, "localStorage", {
    value: mockLocalStorage,
    writable: true,
});

describe("migration", () => {
    beforeEach(async () => {
        resetDbConnection();
        // Clear all stores instead of deleteDatabase (avoids blocking on open connections)
        try {
            await idbClear(STORES.sessions);
            await idbClear(STORES.mastery);
            await idbClear(STORES.achievements);
            await idbClear(STORES.customSnippets);
            await idbClear(STORES.meta);
        } catch {
            // DB may not exist yet on first test
        }
        // Clear mock localStorage
        for (const key of Object.keys(mockStore)) {
            delete mockStore[key];
        }
        vi.clearAllMocks();
    });

    it("migrates sessions from localStorage to IndexedDB", async () => {
        const sessions = [
            {
                id: "s1",
                date: "2026-01-15T10:00:00Z",
                snippetId: "test",
                language: "javascript",
                wpm: 60,
                accuracy: 0.95,
                elapsedMs: 30000,
            },
            {
                id: "s2",
                date: "2026-01-16T10:00:00Z",
                snippetId: "test2",
                language: "python",
                wpm: 70,
                accuracy: 0.9,
                elapsedMs: 25000,
            },
        ];
        mockStore[LS_KEY] = JSON.stringify(sessions);

        const result = await runMigrations();
        expect(result.migrated).toBe(true);
        expect(result.sessionCount).toBe(2);

        const stored = await idbGetAll(STORES.sessions);
        expect(stored).toHaveLength(2);
    });

    it("sets migration version after running", async () => {
        mockStore[LS_KEY] = JSON.stringify([]);
        await runMigrations();

        const meta = await idbGet<MetaRecord>(STORES.meta, MIGRATION_VERSION_KEY);
        expect(meta?.value).toBe(CURRENT_VERSION);
    });

    it("skips migration if already at current version", async () => {
        mockStore[LS_KEY] = JSON.stringify([
            { id: "s1", date: "2026-01-15", snippetId: "t", language: "js", wpm: 60, accuracy: 0.9 },
        ]);
        await runMigrations();

        // Second run — should skip
        const result = await runMigrations();
        expect(result.migrated).toBe(false);
        expect(result.sessionCount).toBe(0);
    });

    it("handles empty localStorage gracefully", async () => {
        const result = await runMigrations();
        expect(result.migrated).toBe(true);
        expect(result.sessionCount).toBe(0);
    });

    it("skips invalid session records", async () => {
        mockStore[LS_KEY] = JSON.stringify([
            { id: "valid", date: "2026-01-15", snippetId: "t", language: "js", wpm: 60, accuracy: 0.9 },
            { bad: "record" },
            null,
            "not an object",
        ]);

        const result = await runMigrations();
        expect(result.sessionCount).toBe(1);
    });

    it("handles malformed JSON gracefully", async () => {
        mockStore[LS_KEY] = "not valid json {{{";
        const result = await runMigrations();
        expect(result.migrated).toBe(true);
        expect(result.sessionCount).toBe(0);
    });
});
