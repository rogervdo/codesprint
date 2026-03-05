/**
 * Versioned migration system for localStorage -> IndexedDB.
 *
 * Runs once on first load. Subsequent loads skip migration if the version
 * marker in IndexedDB meta store is current.
 */

import type { SessionRecord } from "./session-history";
import { idbGet, idbGetAll, idbPut, idbPutMany, STORES } from "./idb-store";
import type { MasteryRecord, MetaRecord } from "./idb-store";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MIGRATION_VERSION_KEY = "migration-version";
const CURRENT_VERSION = 2;
const LS_SESSION_KEY = "codesprint-session-history";

// ---------------------------------------------------------------------------
// Migration runner
// ---------------------------------------------------------------------------

export async function runMigrations(): Promise<{ migrated: boolean; sessionCount: number }> {
    if (typeof window === "undefined") {
        return { migrated: false, sessionCount: 0 };
    }

    const meta = await idbGet<MetaRecord>(STORES.meta, MIGRATION_VERSION_KEY);
    const currentVersion = typeof meta?.value === "number" ? meta.value : 0;

    if (currentVersion >= CURRENT_VERSION) {
        return { migrated: false, sessionCount: 0 };
    }

    let sessionCount = 0;

    // V1: Migrate localStorage session history to IndexedDB
    if (currentVersion < 1) {
        sessionCount = await migrateV1Sessions();
    }

    // V2: Add SM-2 defaults to existing mastery records
    if (currentVersion < 2) {
        await migrateV2MasteryRecords();
    }

    // Mark migration complete
    await idbPut<MetaRecord>(STORES.meta, {
        key: MIGRATION_VERSION_KEY,
        value: CURRENT_VERSION,
    });

    return { migrated: true, sessionCount };
}

// ---------------------------------------------------------------------------
// V1: localStorage sessions -> IndexedDB
// ---------------------------------------------------------------------------

async function migrateV1Sessions(): Promise<number> {
    try {
        const raw = window.localStorage.getItem(LS_SESSION_KEY);
        if (!raw) return 0;

        const parsed = JSON.parse(raw);
        if (!Array.isArray(parsed)) return 0;

        const valid = parsed.filter(isValidSessionRecord);
        if (valid.length === 0) return 0;

        await idbPutMany<SessionRecord>(STORES.sessions, valid);

        // Don't remove from localStorage yet - keep as fallback until
        // we're confident the migration worked. The session-history module
        // will prefer IndexedDB reads going forward.

        return valid.length;
    } catch {
        return 0;
    }
}

// ---------------------------------------------------------------------------
// V2: Add SM-2 fields to mastery records
// ---------------------------------------------------------------------------

async function migrateV2MasteryRecords(): Promise<void> {
    try {
        const records = await idbGetAll<Record<string, unknown>>(STORES.mastery);
        if (records.length === 0) return;

        const today = new Date().toISOString().slice(0, 10);
        const updated: MasteryRecord[] = records.map((record) => ({
            snippetId: record.snippetId as string,
            language: record.language as string,
            bestWpm: record.bestWpm as number,
            bestAccuracy: record.bestAccuracy as number,
            attempts: record.attempts as number,
            lastPracticed: record.lastPracticed as string,
            easeFactor: (record.easeFactor as number) ?? 2.5,
            interval: (record.interval as number) ?? 0,
            repetitions: (record.repetitions as number) ?? 0,
            nextReviewDate: (record.nextReviewDate as string) ?? today,
            lastQuality: (record.lastQuality as number) ?? 0,
            lastReviewDate: (record.lastReviewDate as string) ?? today,
        }));

        await idbPutMany<MasteryRecord>(STORES.mastery, updated);
    } catch {
        // Non-critical: existing records will get SM-2 defaults on next practice
    }
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

function isValidSessionRecord(value: unknown): value is SessionRecord {
    if (!value || typeof value !== "object") return false;
    const record = value as Record<string, unknown>;
    return (
        typeof record.id === "string" &&
        typeof record.date === "string" &&
        typeof record.snippetId === "string" &&
        typeof record.language === "string" &&
        typeof record.wpm === "number" &&
        typeof record.accuracy === "number"
    );
}

export { CURRENT_VERSION, MIGRATION_VERSION_KEY };
