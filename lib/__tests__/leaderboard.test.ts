import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { getLeaderboard, saveScore, clearLeaderboard } from "../leaderboard";

describe("getLeaderboard", () => {
    beforeEach(() => {
        localStorage.clear();
    });

    afterEach(() => {
        localStorage.clear();
    });

    it("returns empty array when storage is empty", () => {
        expect(getLeaderboard()).toEqual([]);
    });

    it("returns empty array when stored value is not an array", () => {
        localStorage.setItem("codesprint-leaderboard", JSON.stringify({ bad: "data" }));
        expect(getLeaderboard()).toEqual([]);
    });

    it("returns empty array when stored value is a string", () => {
        localStorage.setItem("codesprint-leaderboard", '"just a string"');
        expect(getLeaderboard()).toEqual([]);
    });

    it("returns empty array when stored value is invalid JSON", () => {
        localStorage.setItem("codesprint-leaderboard", "not json at all {{{");
        expect(getLeaderboard()).toEqual([]);
    });

    it("returns entries when stored value is a valid array", () => {
        const entries = [
            { id: "1", wpm: 100, accuracy: 0.95, date: "2026-01-01", language: "python", snippetId: "py-1" },
        ];
        localStorage.setItem("codesprint-leaderboard", JSON.stringify(entries));
        expect(getLeaderboard()).toEqual(entries);
    });

    it("respects the limit parameter", () => {
        const entries = Array.from({ length: 10 }, (_, i) => ({
            id: String(i), wpm: 100 - i, accuracy: 0.95, date: "2026-01-01", language: "python", snippetId: "py-1",
        }));
        localStorage.setItem("codesprint-leaderboard", JSON.stringify(entries));
        expect(getLeaderboard(3)).toHaveLength(3);
    });
});
