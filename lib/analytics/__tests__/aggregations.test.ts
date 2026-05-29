import { describe, it, expect, beforeEach, vi } from "vitest";
import {
    getWpmTrends,
    getLanguageStats,
    getPersonalAverages,
    getSnippetPerformance,
    getProgressOverTime,
} from "../aggregations";
import type { CreateSessionInput } from "@/lib/storage/session-history";

const mockLocalStorage = (() => {
    let store: Record<string, string> = {};
    return {
        getItem: vi.fn((key: string) => store[key] ?? null),
        setItem: vi.fn((key: string, value: string) => {
            store[key] = value;
        }),
        removeItem: vi.fn((key: string) => {
            delete store[key];
        }),
        clear: vi.fn(() => {
            store = {};
        }),
        get length() {
            return Object.keys(store).length;
        },
        key: vi.fn((index: number) => Object.keys(store)[index] ?? null),
    };
})();

vi.stubGlobal("window", { localStorage: mockLocalStorage });

let uuidCounter = 0;
vi.stubGlobal("crypto", { randomUUID: vi.fn(() => `test-uuid-${++uuidCounter}`) });

function createMockInput(overrides: Partial<CreateSessionInput> = {}): CreateSessionInput {
    return {
        snippetId: "test-snippet",
        language: "javascript",
        lengthCategory: "medium",
        contentType: "template",
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

function createSessionDirectly(input: CreateSessionInput, dateOverride?: string): void {
    const stored = mockLocalStorage.getItem("codesprint-session-history");
    const existing = stored ? JSON.parse(stored) : [];
    const record = {
        ...input,
        id: `test-uuid-${++uuidCounter}`,
        date: dateOverride ?? new Date().toISOString(),
    };
    mockLocalStorage.setItem("codesprint-session-history", JSON.stringify([record, ...existing]));
}

function daysAgo(days: number): string {
    const date = new Date();
    date.setDate(date.getDate() - days);
    return date.toISOString();
}

describe("aggregations", () => {
    beforeEach(() => {
        mockLocalStorage.clear();
        uuidCounter = 0;
        vi.clearAllMocks();
    });

    describe("getWpmTrends", () => {
        it("should return empty data when no sessions exist", () => {
            const trends = getWpmTrends("week");

            expect(trends.dataPoints).toHaveLength(0);
            expect(trends.overallChange).toBe(0);
            expect(trends.averageWpm).toBe(0);
            expect(trends.peakWpm).toBe(0);
            expect(trends.peakDate).toBeNull();
        });

        it("should aggregate sessions by date", () => {
            const today = new Date().toISOString().split("T")[0];
            createSessionDirectly(createMockInput({ wpm: 60 }), `${today}T10:00:00.000Z`);
            createSessionDirectly(createMockInput({ wpm: 80 }), `${today}T14:00:00.000Z`);

            const trends = getWpmTrends("week");

            expect(trends.dataPoints).toHaveLength(1);
            expect(trends.dataPoints[0].date).toBe(today);
            expect(trends.dataPoints[0].wpm).toBe(70);
            expect(trends.dataPoints[0].sessionCount).toBe(2);
        });

        it("should calculate overall change between first and last data points", () => {
            createSessionDirectly(createMockInput({ wpm: 50 }), daysAgo(3));
            createSessionDirectly(createMockInput({ wpm: 100 }), daysAgo(0));

            const trends = getWpmTrends("week");

            expect(trends.overallChange).toBe(100);
        });

        it("should identify peak WPM and date", () => {
            createSessionDirectly(createMockInput({ wpm: 60 }), daysAgo(2));
            createSessionDirectly(createMockInput({ wpm: 90 }), daysAgo(1));
            createSessionDirectly(createMockInput({ wpm: 70 }), daysAgo(0));

            const trends = getWpmTrends("week");

            expect(trends.peakWpm).toBe(90);
            expect(trends.peakDate).toBe(new Date(daysAgo(1)).toISOString().split("T")[0]);
        });

        it("should respect time range filter - day", () => {
            createSessionDirectly(createMockInput({ wpm: 60 }), daysAgo(2));
            createSessionDirectly(createMockInput({ wpm: 80 }), daysAgo(0));

            const trends = getWpmTrends("day");

            expect(trends.dataPoints).toHaveLength(1);
            expect(trends.averageWpm).toBe(80);
        });

        it("should respect time range filter - week", () => {
            createSessionDirectly(createMockInput({ wpm: 60 }), daysAgo(10));
            createSessionDirectly(createMockInput({ wpm: 80 }), daysAgo(3));

            const trends = getWpmTrends("week");

            expect(trends.dataPoints).toHaveLength(1);
            expect(trends.averageWpm).toBe(80);
        });

        it("should include all sessions for 'all' range", () => {
            createSessionDirectly(createMockInput({ wpm: 60 }), daysAgo(100));
            createSessionDirectly(createMockInput({ wpm: 80 }), daysAgo(0));

            const trends = getWpmTrends("all");

            expect(trends.dataPoints).toHaveLength(2);
        });

        it("should respect language filter", () => {
            createSessionDirectly(createMockInput({ language: "javascript", wpm: 60 }), daysAgo(0));
            createSessionDirectly(createMockInput({ language: "python", wpm: 100 }), daysAgo(0));

            const trends = getWpmTrends("week", { language: "javascript" });

            expect(trends.averageWpm).toBe(60);
        });

        it("should calculate average raw WPM and accuracy in data points", () => {
            const today = new Date().toISOString().split("T")[0];
            createSessionDirectly(createMockInput({ wpm: 60, rawWpm: 70, accuracy: 0.9 }), `${today}T10:00:00.000Z`);
            createSessionDirectly(createMockInput({ wpm: 80, rawWpm: 90, accuracy: 0.95 }), `${today}T14:00:00.000Z`);

            const trends = getWpmTrends("week");

            expect(trends.dataPoints[0].rawWpm).toBe(80);
            expect(trends.dataPoints[0].accuracy).toBeCloseTo(0.925, 3);
        });

        it("should sort data points by date ascending", () => {
            createSessionDirectly(createMockInput({ wpm: 60 }), daysAgo(0));
            createSessionDirectly(createMockInput({ wpm: 70 }), daysAgo(2));
            createSessionDirectly(createMockInput({ wpm: 80 }), daysAgo(1));

            const trends = getWpmTrends("week");

            expect(trends.dataPoints[0].wpm).toBe(70);
            expect(trends.dataPoints[1].wpm).toBe(80);
            expect(trends.dataPoints[2].wpm).toBe(60);
        });
    });

    describe("getLanguageStats", () => {
        it("should return empty array when no sessions exist", () => {
            const stats = getLanguageStats();

            expect(stats).toHaveLength(0);
        });

        it("should aggregate stats by language", () => {
            createSessionDirectly(createMockInput({ language: "javascript", wpm: 60, accuracy: 0.9, elapsedMs: 30000 }));
            createSessionDirectly(createMockInput({ language: "javascript", wpm: 80, accuracy: 0.95, elapsedMs: 25000 }));
            createSessionDirectly(createMockInput({ language: "python", wpm: 70, accuracy: 0.92, elapsedMs: 28000 }));

            const stats = getLanguageStats();

            expect(stats).toHaveLength(2);

            const jsStats = stats.find((s) => s.language === "javascript");
            expect(jsStats?.sessionCount).toBe(2);
            expect(jsStats?.averageWpm).toBe(70);
            expect(jsStats?.bestWpm).toBe(80);
            expect(jsStats?.averageAccuracy).toBeCloseTo(0.925, 3);
            expect(jsStats?.totalTimeMs).toBe(55000);
        });

        it("should sort by session count descending", () => {
            createSessionDirectly(createMockInput({ language: "python" }));
            createSessionDirectly(createMockInput({ language: "javascript" }));
            createSessionDirectly(createMockInput({ language: "javascript" }));
            createSessionDirectly(createMockInput({ language: "javascript" }));

            const stats = getLanguageStats();

            expect(stats[0].language).toBe("javascript");
            expect(stats[0].sessionCount).toBe(3);
            expect(stats[1].language).toBe("python");
            expect(stats[1].sessionCount).toBe(1);
        });

        it("should calculate recent trend as improving", () => {
            createSessionDirectly(createMockInput({ language: "javascript", wpm: 50 }), daysAgo(5));
            createSessionDirectly(createMockInput({ language: "javascript", wpm: 55 }), daysAgo(4));
            createSessionDirectly(createMockInput({ language: "javascript", wpm: 60 }), daysAgo(3));
            createSessionDirectly(createMockInput({ language: "javascript", wpm: 70 }), daysAgo(2));
            createSessionDirectly(createMockInput({ language: "javascript", wpm: 80 }), daysAgo(1));
            createSessionDirectly(createMockInput({ language: "javascript", wpm: 90 }), daysAgo(0));

            const stats = getLanguageStats();
            const jsStats = stats.find((s) => s.language === "javascript");

            expect(jsStats?.recentTrend).toBe("improving");
        });

        it("should calculate recent trend as declining", () => {
            createSessionDirectly(createMockInput({ language: "javascript", wpm: 90 }), daysAgo(5));
            createSessionDirectly(createMockInput({ language: "javascript", wpm: 80 }), daysAgo(4));
            createSessionDirectly(createMockInput({ language: "javascript", wpm: 70 }), daysAgo(3));
            createSessionDirectly(createMockInput({ language: "javascript", wpm: 60 }), daysAgo(2));
            createSessionDirectly(createMockInput({ language: "javascript", wpm: 55 }), daysAgo(1));
            createSessionDirectly(createMockInput({ language: "javascript", wpm: 50 }), daysAgo(0));

            const stats = getLanguageStats();
            const jsStats = stats.find((s) => s.language === "javascript");

            expect(jsStats?.recentTrend).toBe("declining");
        });

        it("should calculate recent trend as stable for small changes", () => {
            createSessionDirectly(createMockInput({ language: "javascript", wpm: 60 }), daysAgo(3));
            createSessionDirectly(createMockInput({ language: "javascript", wpm: 61 }), daysAgo(2));
            createSessionDirectly(createMockInput({ language: "javascript", wpm: 62 }), daysAgo(1));
            createSessionDirectly(createMockInput({ language: "javascript", wpm: 63 }), daysAgo(0));

            const stats = getLanguageStats();
            const jsStats = stats.find((s) => s.language === "javascript");

            expect(jsStats?.recentTrend).toBe("stable");
        });

        it("should respect time range filter", () => {
            createSessionDirectly(createMockInput({ language: "javascript" }), daysAgo(10));
            createSessionDirectly(createMockInput({ language: "python" }), daysAgo(3));

            const stats = getLanguageStats("week");

            expect(stats).toHaveLength(1);
            expect(stats[0].language).toBe("python");
        });
    });

    describe("getPersonalAverages", () => {
        it("should return empty stats when no sessions exist", () => {
            const averages = getPersonalAverages();

            expect(averages.overallWpm).toBe(0);
            expect(averages.overallAccuracy).toBe(0);
            expect(averages.totalSessions).toBe(0);
            expect(averages.totalTimeMs).toBe(0);
            expect(averages.bestWpm).toBe(0);
            expect(averages.worstWpm).toBe(0);
            expect(averages.improvementRate).toBe(0);
        });

        it("should calculate overall averages", () => {
            createSessionDirectly(createMockInput({ wpm: 60, accuracy: 0.9, elapsedMs: 30000 }));
            createSessionDirectly(createMockInput({ wpm: 80, accuracy: 0.95, elapsedMs: 25000 }));
            createSessionDirectly(createMockInput({ wpm: 70, accuracy: 0.92, elapsedMs: 28000 }));

            const averages = getPersonalAverages();

            expect(averages.overallWpm).toBe(70);
            expect(averages.overallAccuracy).toBeCloseTo(0.923, 2);
            expect(averages.totalSessions).toBe(3);
            expect(averages.totalTimeMs).toBe(83000);
            expect(averages.bestWpm).toBe(80);
            expect(averages.worstWpm).toBe(60);
        });

        it("should calculate stats by content type", () => {
            createSessionDirectly(createMockInput({ contentType: "template", wpm: 80, accuracy: 0.95 }));
            createSessionDirectly(createMockInput({ contentType: "template", wpm: 90, accuracy: 0.97 }));
            createSessionDirectly(createMockInput({ contentType: "problem", wpm: 50, accuracy: 0.85 }));

            const averages = getPersonalAverages();

            expect(averages.byContentType.template.wpm).toBe(85);
            expect(averages.byContentType.template.accuracy).toBeCloseTo(0.96, 2);
            expect(averages.byContentType.template.sessions).toBe(2);
            expect(averages.byContentType.problem.wpm).toBe(50);
            expect(averages.byContentType.problem.sessions).toBe(1);
        });

        it("should calculate stats by length category", () => {
            createSessionDirectly(createMockInput({ lengthCategory: "short", wpm: 90, accuracy: 0.98 }));
            createSessionDirectly(createMockInput({ lengthCategory: "medium", wpm: 70, accuracy: 0.92 }));
            createSessionDirectly(createMockInput({ lengthCategory: "medium", wpm: 80, accuracy: 0.94 }));
            createSessionDirectly(createMockInput({ lengthCategory: "long", wpm: 50, accuracy: 0.88 }));

            const averages = getPersonalAverages();

            expect(averages.byLength.short.wpm).toBe(90);
            expect(averages.byLength.short.sessions).toBe(1);
            expect(averages.byLength.medium.wpm).toBe(75);
            expect(averages.byLength.medium.sessions).toBe(2);
            expect(averages.byLength.long.wpm).toBe(50);
            expect(averages.byLength.long.sessions).toBe(1);
        });

        it("should calculate positive improvement rate when improving", () => {
            createSessionDirectly(createMockInput({ wpm: 50 }), daysAgo(5));
            createSessionDirectly(createMockInput({ wpm: 55 }), daysAgo(4));
            createSessionDirectly(createMockInput({ wpm: 60 }), daysAgo(3));
            createSessionDirectly(createMockInput({ wpm: 70 }), daysAgo(2));
            createSessionDirectly(createMockInput({ wpm: 80 }), daysAgo(1));
            createSessionDirectly(createMockInput({ wpm: 90 }), daysAgo(0));

            const averages = getPersonalAverages();

            expect(averages.improvementRate).toBe(1);
        });

        it("should calculate negative improvement rate when declining", () => {
            createSessionDirectly(createMockInput({ wpm: 90 }), daysAgo(5));
            createSessionDirectly(createMockInput({ wpm: 80 }), daysAgo(4));
            createSessionDirectly(createMockInput({ wpm: 70 }), daysAgo(3));
            createSessionDirectly(createMockInput({ wpm: 60 }), daysAgo(2));
            createSessionDirectly(createMockInput({ wpm: 55 }), daysAgo(1));
            createSessionDirectly(createMockInput({ wpm: 50 }), daysAgo(0));

            const averages = getPersonalAverages();

            expect(averages.improvementRate).toBe(-1);
        });

        it("should handle empty content type/length categories", () => {
            createSessionDirectly(createMockInput({ contentType: "template", lengthCategory: "short" }));

            const averages = getPersonalAverages();

            expect(averages.byContentType.problem.sessions).toBe(0);
            expect(averages.byLength.medium.sessions).toBe(0);
            expect(averages.byLength.long.sessions).toBe(0);
        });

        it("should respect time range filter", () => {
            createSessionDirectly(createMockInput({ wpm: 100 }), daysAgo(10));
            createSessionDirectly(createMockInput({ wpm: 60 }), daysAgo(3));

            const averages = getPersonalAverages("week");

            expect(averages.totalSessions).toBe(1);
            expect(averages.overallWpm).toBe(60);
        });
    });

    describe("getSnippetPerformance", () => {
        it("should return empty stats for non-existent snippet", () => {
            const performance = getSnippetPerformance("non-existent");

            expect(performance.attempts).toBe(0);
            expect(performance.bestWpm).toBe(0);
            expect(performance.averageWpm).toBe(0);
            expect(performance.averageAccuracy).toBe(0);
            expect(performance.improvement).toBe(0);
        });

        it("should calculate stats for a specific snippet", () => {
            createSessionDirectly(createMockInput({ snippetId: "target", wpm: 60, accuracy: 0.9 }), daysAgo(2));
            createSessionDirectly(createMockInput({ snippetId: "target", wpm: 80, accuracy: 0.95 }), daysAgo(1));
            createSessionDirectly(createMockInput({ snippetId: "other", wpm: 100, accuracy: 0.99 }));

            const performance = getSnippetPerformance("target");

            expect(performance.attempts).toBe(2);
            expect(performance.bestWpm).toBe(80);
            expect(performance.averageWpm).toBe(70);
            expect(performance.averageAccuracy).toBeCloseTo(0.925, 3);
        });

        it("should calculate improvement percentage", () => {
            createSessionDirectly(createMockInput({ snippetId: "target", wpm: 50 }), daysAgo(2));
            createSessionDirectly(createMockInput({ snippetId: "target", wpm: 100 }), daysAgo(0));

            const performance = getSnippetPerformance("target");

            expect(performance.improvement).toBe(100);
        });

        it("should handle single attempt with zero improvement", () => {
            createSessionDirectly(createMockInput({ snippetId: "target", wpm: 60 }));

            const performance = getSnippetPerformance("target");

            expect(performance.attempts).toBe(1);
            expect(performance.improvement).toBe(0);
        });
    });

    describe("getProgressOverTime", () => {
        it("should return empty array when no sessions exist", () => {
            const progress = getProgressOverTime();

            expect(progress).toHaveLength(0);
        });

        it("should calculate cumulative averages", () => {
            createSessionDirectly(createMockInput({ wpm: 60 }), daysAgo(2));
            createSessionDirectly(createMockInput({ wpm: 80 }), daysAgo(1));
            createSessionDirectly(createMockInput({ wpm: 100 }), daysAgo(0));

            const progress = getProgressOverTime("week");

            expect(progress).toHaveLength(3);
            expect(progress[0].cumulativeAvgWpm).toBe(60);
            expect(progress[0].cumulativeSessions).toBe(1);
            expect(progress[1].cumulativeAvgWpm).toBe(70);
            expect(progress[1].cumulativeSessions).toBe(2);
            expect(progress[2].cumulativeAvgWpm).toBe(80);
            expect(progress[2].cumulativeSessions).toBe(3);
        });

        it("should aggregate multiple sessions on the same day", () => {
            const today = new Date().toISOString().split("T")[0];
            createSessionDirectly(createMockInput({ wpm: 60 }), `${today}T10:00:00.000Z`);
            createSessionDirectly(createMockInput({ wpm: 80 }), `${today}T14:00:00.000Z`);

            const progress = getProgressOverTime("week");

            expect(progress).toHaveLength(1);
            expect(progress[0].cumulativeAvgWpm).toBe(70);
            expect(progress[0].cumulativeSessions).toBe(2);
        });

        it("should respect time range filter", () => {
            createSessionDirectly(createMockInput({ wpm: 100 }), daysAgo(40));
            createSessionDirectly(createMockInput({ wpm: 60 }), daysAgo(15));

            const progress = getProgressOverTime("month");

            expect(progress).toHaveLength(1);
            expect(progress[0].cumulativeAvgWpm).toBe(60);
        });

        it("should sort dates chronologically", () => {
            createSessionDirectly(createMockInput({ wpm: 100 }), daysAgo(0));
            createSessionDirectly(createMockInput({ wpm: 60 }), daysAgo(2));
            createSessionDirectly(createMockInput({ wpm: 80 }), daysAgo(1));

            const progress = getProgressOverTime("week");

            const dates = progress.map((p) => p.date);
            const sortedDates = [...dates].sort();
            expect(dates).toEqual(sortedDates);
        });
    });
});
