/**
 * Data export/import module for CodeSprint.
 *
 * Supports JSON and CSV formats for session history.
 * Import validates and deduplicates records.
 */

import type { SessionRecord } from "./storage/session-history";
import { idbGetAll, idbPutMany, STORES } from "./storage/idb-store";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ExportFormat = "json" | "csv";

export type ExportData = {
    version: number;
    exportedAt: string;
    sessions: SessionRecord[];
};

export type ImportResult = {
    imported: number;
    duplicates: number;
    invalid: number;
    total: number;
};

// ---------------------------------------------------------------------------
// Export
// ---------------------------------------------------------------------------

export async function exportSessions(format: ExportFormat = "json"): Promise<string> {
    const sessions = await idbGetAll<SessionRecord>(STORES.sessions);

    // Sort by date descending
    const sorted = [...sessions].sort(
        (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
    );

    if (format === "csv") {
        return sessionsToCSV(sorted);
    }

    const data: ExportData = {
        version: 1,
        exportedAt: new Date().toISOString(),
        sessions: sorted,
    };

    return JSON.stringify(data, null, 2);
}

function sessionsToCSV(sessions: SessionRecord[]): string {
    const headers = [
        "id", "date", "snippetId", "language", "lengthCategory", "difficulty",
        "wpm", "rawWpm", "accuracy", "elapsedMs", "totalKeystrokes",
        "correctKeystrokes", "errorCount",
    ];

    const rows = sessions.map((s) =>
        [
            s.id, s.date, s.snippetId, s.language, s.lengthCategory, s.difficulty,
            s.wpm, s.rawWpm, s.accuracy, s.elapsedMs, s.totalKeystrokes,
            s.correctKeystrokes, s.errorCount,
        ].map(csvEscape).join(",")
    );

    return [headers.join(","), ...rows].join("\n");
}

function csvEscape(value: unknown): string {
    const str = String(value ?? "");
    if (str.includes(",") || str.includes('"') || str.includes("\n")) {
        return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
}

// ---------------------------------------------------------------------------
// Import
// ---------------------------------------------------------------------------

export async function importSessions(content: string): Promise<ImportResult> {
    const parsed = parseImportData(content);

    if (parsed.length === 0) {
        return { imported: 0, duplicates: 0, invalid: 0, total: 0 };
    }

    // Validate records
    const valid: SessionRecord[] = [];
    let invalid = 0;
    for (const record of parsed) {
        if (isValidSessionRecord(record)) {
            valid.push(record);
        } else {
            invalid++;
        }
    }

    // Deduplicate against existing records
    const existing = await idbGetAll<SessionRecord>(STORES.sessions);
    const existingIds = new Set(existing.map((r) => r.id));

    const newRecords = valid.filter((r) => !existingIds.has(r.id));
    const duplicates = valid.length - newRecords.length;

    if (newRecords.length > 0) {
        await idbPutMany<SessionRecord>(STORES.sessions, newRecords);
    }

    return {
        imported: newRecords.length,
        duplicates,
        invalid,
        total: parsed.length,
    };
}

function parseImportData(content: string): unknown[] {
    try {
        const json = JSON.parse(content);

        // ExportData format
        if (json && typeof json === "object" && Array.isArray(json.sessions)) {
            return json.sessions;
        }

        // Plain array format
        if (Array.isArray(json)) {
            return json;
        }

        return [];
    } catch {
        return [];
    }
}

function isValidSessionRecord(value: unknown): value is SessionRecord {
    if (!value || typeof value !== "object") return false;
    const r = value as Record<string, unknown>;
    return (
        typeof r.id === "string" &&
        typeof r.date === "string" &&
        typeof r.snippetId === "string" &&
        typeof r.language === "string" &&
        typeof r.wpm === "number" &&
        typeof r.accuracy === "number" &&
        typeof r.elapsedMs === "number"
    );
}

// ---------------------------------------------------------------------------
// File download helper
// ---------------------------------------------------------------------------

export function downloadFile(content: string, filename: string, mimeType: string): void {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
}
