import { describe, it, expect, vi, beforeEach } from "vitest";
import type { SessionRecord, SessionFilters } from "@/lib/storage/session-history";

// Mock getSessions before importing aggregations
const mockSessions: SessionRecord[] = [];
vi.mock("@/lib/storage/session-history", () => ({
    getSessions: vi.fn((filters?: SessionFilters) => {
        let result = [...mockSessions];
        if (filters?.language) result = result.filter((s) => s.language === filters.language);
        if (filters?.snippetId) result = result.filter((s) => s.snippetId === filters.snippetId);
        return result;
    }),
}));

import { getWpmTrends, getLanguageStats, getPersonalAverages, getSnippetPerformance, getProgressOverTime } from "../aggregations";

function makeSession(overrides: Partial<SessionRecord> = {}): SessionRecord {
    return {
        id: crypto.randomUUID(),
        date: new Date().toISOString(),
        snippetId: "test-snippet",
        language: "javascript",
        lengthCategory: "medium",
        difficulty: "easy",
        wpm: 60,
        rawWpm: 65,
        accuracy: 0.95,
        elapsedMs: 30000,
        totalKeystrokes: 300,
        correctKeystrokes: 285,
        errorCount: 5,
        history: [],
        ...overrides,
    };
}

describe("getWpmTrends", () => {
    beforeEach(() => {
        mockSessions.length = 0;
    });

    it("returns empty trend for no sessions", () => {
        const trend = getWpmTrends("all");
        expect(trend.dataPoints).toEqual([]);
        expect(trend.averageWpm).toBe(0);
        expect(trend.peakWpm).toBe(0);
        expect(trend.peakDate).toBeNull();
    });

    it("groups sessions by date", () => {
        mockSessions.push(
            makeSession({ date: "2026-01-15T10:00:00Z", wpm: 60 }),
            makeSession({ date: "2026-01-15T11:00:00Z", wpm: 80 }),
            makeSession({ date: "2026-01-16T10:00:00Z", wpm: 70 }),
        );
        const trend = getWpmTrends("all");
        expect(trend.dataPoints).toHaveLength(2);
        expect(trend.dataPoints[0].sessionCount).toBe(2);
        expect(trend.dataPoints[1].sessionCount).toBe(1);
    });

    it("computes overall change percentage", () => {
        mockSessions.push(
            makeSession({ date: "2026-01-15T10:00:00Z", wpm: 50 }),
            makeSession({ date: "2026-01-16T10:00:00Z", wpm: 100 }),
        );
        const trend = getWpmTrends("all");
        expect(trend.overallChange).toBe(100);
    });

    it("identifies peak WPM and date", () => {
        mockSessions.push(
            makeSession({ date: "2026-01-15T10:00:00Z", wpm: 50 }),
            makeSession({ date: "2026-01-16T10:00:00Z", wpm: 90 }),
            makeSession({ date: "2026-01-17T10:00:00Z", wpm: 70 }),
        );
        const trend = getWpmTrends("all");
        expect(trend.peakWpm).toBe(90);
        expect(trend.peakDate).toBe("2026-01-16");
    });
});

describe("getLanguageStats", () => {
    beforeEach(() => {
        mockSessions.length = 0;
    });

    it("returns empty for no sessions", () => {
        const stats = getLanguageStats("all");
        expect(stats).toEqual([]);
    });

    it("groups by language", () => {
        mockSessions.push(
            makeSession({ language: "javascript", wpm: 60 }),
            makeSession({ language: "javascript", wpm: 80 }),
            makeSession({ language: "python", wpm: 50 }),
        );
        const stats = getLanguageStats("all");
        expect(stats).toHaveLength(2);
        const js = stats.find((s) => s.language === "javascript");
        expect(js?.sessionCount).toBe(2);
        expect(js?.averageWpm).toBe(70);
        expect(js?.bestWpm).toBe(80);
    });

    it("sorts by session count descending", () => {
        mockSessions.push(
            makeSession({ language: "python" }),
            makeSession({ language: "javascript" }),
            makeSession({ language: "javascript" }),
        );
        const stats = getLanguageStats("all");
        expect(stats[0].language).toBe("javascript");
    });
});

describe("getPersonalAverages", () => {
    beforeEach(() => {
        mockSessions.length = 0;
    });

    it("returns zeroes for no sessions", () => {
        const avg = getPersonalAverages("all");
        expect(avg.totalSessions).toBe(0);
        expect(avg.overallWpm).toBe(0);
    });

    it("computes overall stats", () => {
        mockSessions.push(
            makeSession({ wpm: 60, accuracy: 0.9, elapsedMs: 30000 }),
            makeSession({ wpm: 80, accuracy: 0.95, elapsedMs: 25000 }),
        );
        const avg = getPersonalAverages("all");
        expect(avg.totalSessions).toBe(2);
        expect(avg.overallWpm).toBe(70);
        expect(avg.bestWpm).toBe(80);
        expect(avg.worstWpm).toBe(60);
        expect(avg.totalTimeMs).toBe(55000);
    });

    it("breaks down by difficulty", () => {
        mockSessions.push(
            makeSession({ difficulty: "easy", wpm: 80 }),
            makeSession({ difficulty: "hard", wpm: 50 }),
        );
        const avg = getPersonalAverages("all");
        expect(avg.byDifficulty.easy.sessions).toBe(1);
        expect(avg.byDifficulty.easy.wpm).toBe(80);
        expect(avg.byDifficulty.hard.sessions).toBe(1);
        expect(avg.byDifficulty.hard.wpm).toBe(50);
        expect(avg.byDifficulty.medium.sessions).toBe(0);
    });

    it("breaks down by length", () => {
        mockSessions.push(
            makeSession({ lengthCategory: "short", wpm: 90 }),
            makeSession({ lengthCategory: "long", wpm: 40 }),
        );
        const avg = getPersonalAverages("all");
        expect(avg.byLength.short.sessions).toBe(1);
        expect(avg.byLength.long.sessions).toBe(1);
        expect(avg.byLength.medium.sessions).toBe(0);
    });
});

describe("getSnippetPerformance", () => {
    beforeEach(() => {
        mockSessions.length = 0;
    });

    it("returns zeroes for unknown snippet", () => {
        const perf = getSnippetPerformance("nonexistent");
        expect(perf.attempts).toBe(0);
        expect(perf.bestWpm).toBe(0);
    });

    it("computes stats for a specific snippet", () => {
        mockSessions.push(
            makeSession({ snippetId: "target", wpm: 60 }),
            makeSession({ snippetId: "target", wpm: 80 }),
            makeSession({ snippetId: "other", wpm: 100 }),
        );
        const perf = getSnippetPerformance("target");
        expect(perf.attempts).toBe(2);
        expect(perf.bestWpm).toBe(80);
        expect(perf.averageWpm).toBe(70);
    });
});

describe("getProgressOverTime", () => {
    beforeEach(() => {
        mockSessions.length = 0;
    });

    it("returns empty for no sessions", () => {
        expect(getProgressOverTime("all")).toEqual([]);
    });

    it("computes cumulative averages", () => {
        mockSessions.push(
            makeSession({ date: "2026-01-15T10:00:00Z", wpm: 60 }),
            makeSession({ date: "2026-01-16T10:00:00Z", wpm: 80 }),
        );
        const progress = getProgressOverTime("all");
        expect(progress).toHaveLength(2);
        expect(progress[0].cumulativeAvgWpm).toBe(60);
        expect(progress[1].cumulativeAvgWpm).toBe(70);
        expect(progress[1].cumulativeSessions).toBe(2);
    });
});
