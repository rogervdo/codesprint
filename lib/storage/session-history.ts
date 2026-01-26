import type { SupportedLanguage, SnippetLength, Difficulty } from "@/lib/snippets";
import type { HistoryEntry } from "@/hooks/useTypingEngine";

export type SessionRecord = {
    id: string;
    date: string; // ISO string
    snippetId: string;
    language: SupportedLanguage;
    lengthCategory: SnippetLength;
    difficulty: Difficulty;
    wpm: number;
    rawWpm: number;
    accuracy: number;
    elapsedMs: number;
    totalKeystrokes: number;
    correctKeystrokes: number;
    errorCount: number;
    history: HistoryEntry[];
};

export type CreateSessionInput = Omit<SessionRecord, "id" | "date">;

export type SessionFilters = {
    language?: SupportedLanguage;
    lengthCategory?: SnippetLength;
    difficulty?: Difficulty;
    snippetId?: string;
    limit?: number;
    offset?: number;
};

const STORAGE_KEY = "codesprint-session-history";
const MAX_RECORDS = 500;

function isServer(): boolean {
    return typeof window === "undefined";
}

function readStorage(): SessionRecord[] {
    if (isServer()) return [];

    try {
        const stored = window.localStorage.getItem(STORAGE_KEY);
        if (!stored) return [];
        const parsed = JSON.parse(stored);
        if (!Array.isArray(parsed)) return [];
        return parsed as SessionRecord[];
    } catch {
        return [];
    }
}

function writeStorage(records: SessionRecord[]): void {
    if (isServer()) return;

    try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
    } catch {
        // Storage quota exceeded or other error - silently fail
    }
}

export function createSession(input: CreateSessionInput): SessionRecord | null {
    if (isServer()) return null;

    try {
        const record: SessionRecord = {
            ...input,
            id: crypto.randomUUID(),
            date: new Date().toISOString(),
        };

        const existing = readStorage();
        const updated = [record, ...existing].slice(0, MAX_RECORDS);
        writeStorage(updated);

        return record;
    } catch {
        return null;
    }
}

export function getSession(id: string): SessionRecord | null {
    if (isServer()) return null;

    const records = readStorage();
    return records.find((r) => r.id === id) ?? null;
}

export function getSessions(filters?: SessionFilters): SessionRecord[] {
    if (isServer()) return [];

    let records = readStorage();

    if (filters?.language) {
        records = records.filter((r) => r.language === filters.language);
    }
    if (filters?.lengthCategory) {
        records = records.filter((r) => r.lengthCategory === filters.lengthCategory);
    }
    if (filters?.difficulty) {
        records = records.filter((r) => r.difficulty === filters.difficulty);
    }
    if (filters?.snippetId) {
        records = records.filter((r) => r.snippetId === filters.snippetId);
    }

    const offset = filters?.offset ?? 0;
    const limit = filters?.limit ?? records.length;

    return records.slice(offset, offset + limit);
}

export function updateSession(id: string, updates: Partial<Omit<SessionRecord, "id" | "date">>): SessionRecord | null {
    if (isServer()) return null;

    const records = readStorage();
    const index = records.findIndex((r) => r.id === id);

    if (index === -1) return null;

    const updated: SessionRecord = {
        ...records[index],
        ...updates,
        id: records[index].id,
        date: records[index].date,
    };

    const newRecords = [...records.slice(0, index), updated, ...records.slice(index + 1)];
    writeStorage(newRecords);

    return updated;
}

export function deleteSession(id: string): boolean {
    if (isServer()) return false;

    const records = readStorage();
    const filtered = records.filter((r) => r.id !== id);

    if (filtered.length === records.length) return false;

    writeStorage(filtered);
    return true;
}

export function clearSessions(): void {
    if (isServer()) return;
    window.localStorage.removeItem(STORAGE_KEY);
}

export function getSessionStats(filters?: Omit<SessionFilters, "limit" | "offset">): {
    totalSessions: number;
    averageWpm: number;
    averageAccuracy: number;
    bestWpm: number;
    totalTimeMs: number;
} {
    const records = getSessions(filters);

    if (records.length === 0) {
        return {
            totalSessions: 0,
            averageWpm: 0,
            averageAccuracy: 0,
            bestWpm: 0,
            totalTimeMs: 0,
        };
    }

    const totalWpm = records.reduce((sum, r) => sum + r.wpm, 0);
    const totalAccuracy = records.reduce((sum, r) => sum + r.accuracy, 0);
    const bestWpm = Math.max(...records.map((r) => r.wpm));
    const totalTimeMs = records.reduce((sum, r) => sum + r.elapsedMs, 0);

    return {
        totalSessions: records.length,
        averageWpm: totalWpm / records.length,
        averageAccuracy: totalAccuracy / records.length,
        bestWpm,
        totalTimeMs,
    };
}

export function getRecentSessions(count: number = 10): SessionRecord[] {
    return getSessions({ limit: count });
}

export function getSessionsBySnippet(snippetId: string): SessionRecord[] {
    return getSessions({ snippetId });
}
