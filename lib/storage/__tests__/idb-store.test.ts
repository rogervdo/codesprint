import { describe, it, expect, beforeEach } from "vitest";
import "fake-indexeddb/auto";
import {
    idbPut,
    idbGet,
    idbGetAll,
    idbDelete,
    idbClear,
    idbCount,
    idbPutMany,
    isIdbAvailable,
    resetDbConnection,
    STORES,
} from "../idb-store";

describe("idb-store", () => {
    beforeEach(async () => {
        resetDbConnection();
        // Clear all stores instead of deleteDatabase
        // (deleteDatabase blocks on open connections from previous tests)
        try {
            await idbClear(STORES.sessions);
            await idbClear(STORES.mastery);
            await idbClear(STORES.achievements);
            await idbClear(STORES.customSnippets);
            await idbClear(STORES.meta);
        } catch {
            // DB may not exist yet on first test
        }
    });

    describe("isIdbAvailable", () => {
        it("returns true when IndexedDB is available", async () => {
            const available = await isIdbAvailable();
            expect(available).toBe(true);
        });
    });

    describe("CRUD operations on sessions store", () => {
        const session = {
            id: "session-1",
            date: "2026-01-15T10:00:00Z",
            snippetId: "test",
            language: "javascript",
            wpm: 60,
            accuracy: 0.95,
            elapsedMs: 30000,
        };

        it("puts and gets a record", async () => {
            await idbPut(STORES.sessions, session);
            const result = await idbGet(STORES.sessions, "session-1");
            expect(result).toMatchObject({ id: "session-1", wpm: 60 });
        });

        it("returns undefined for missing key", async () => {
            const result = await idbGet(STORES.sessions, "nonexistent");
            expect(result).toBeUndefined();
        });

        it("gets all records", async () => {
            await idbPut(STORES.sessions, session);
            await idbPut(STORES.sessions, { ...session, id: "session-2" });
            const all = await idbGetAll(STORES.sessions);
            expect(all).toHaveLength(2);
        });

        it("deletes a record", async () => {
            await idbPut(STORES.sessions, session);
            await idbDelete(STORES.sessions, "session-1");
            const result = await idbGet(STORES.sessions, "session-1");
            expect(result).toBeUndefined();
        });

        it("clears all records", async () => {
            await idbPut(STORES.sessions, session);
            await idbPut(STORES.sessions, { ...session, id: "session-2" });
            await idbClear(STORES.sessions);
            const count = await idbCount(STORES.sessions);
            expect(count).toBe(0);
        });

        it("counts records", async () => {
            await idbPut(STORES.sessions, session);
            await idbPut(STORES.sessions, { ...session, id: "session-2" });
            const count = await idbCount(STORES.sessions);
            expect(count).toBe(2);
        });
    });

    describe("idbPutMany", () => {
        it("inserts multiple records in one transaction", async () => {
            const records = [
                { id: "s1", date: "2026-01-15", snippetId: "t", language: "js", wpm: 60, accuracy: 0.9, elapsedMs: 1000 },
                { id: "s2", date: "2026-01-16", snippetId: "t", language: "js", wpm: 70, accuracy: 0.95, elapsedMs: 2000 },
                { id: "s3", date: "2026-01-17", snippetId: "t", language: "js", wpm: 80, accuracy: 0.98, elapsedMs: 3000 },
            ];
            await idbPutMany(STORES.sessions, records);
            const count = await idbCount(STORES.sessions);
            expect(count).toBe(3);
        });

        it("handles empty array", async () => {
            await idbPutMany(STORES.sessions, []);
            const count = await idbCount(STORES.sessions);
            expect(count).toBe(0);
        });
    });

    describe("meta store", () => {
        it("stores and retrieves metadata by key", async () => {
            await idbPut(STORES.meta, { key: "version", value: 1 });
            const result = await idbGet<{ key: string; value: number }>(STORES.meta, "version");
            expect(result?.value).toBe(1);
        });
    });

    describe("mastery store", () => {
        it("stores mastery records by snippetId", async () => {
            await idbPut(STORES.mastery, {
                snippetId: "test-snippet",
                language: "python",
                bestWpm: 80,
                bestAccuracy: 0.98,
                attempts: 5,
                lastPracticed: new Date().toISOString(),
            });
            const result = await idbGet(STORES.mastery, "test-snippet");
            expect(result).toMatchObject({ snippetId: "test-snippet", bestWpm: 80 });
        });
    });
});
