import { describe, it, expect } from "vitest";
import {
  getLocalDateString,
  updateStreak,
  type StreakState,
} from "../streaks";

describe("getLocalDateString", () => {
  it("formats a date as YYYY-MM-DD", () => {
    const date = new Date(2025, 0, 5); // Jan 5, 2025
    expect(getLocalDateString(date)).toBe("2025-01-05");
  });

  it("pads single-digit months and days", () => {
    const date = new Date(2025, 2, 3); // Mar 3
    expect(getLocalDateString(date)).toBe("2025-03-03");
  });
});

describe("updateStreak", () => {
  it("creates initial state with streak of 1 when undefined", () => {
    const result = updateStreak(undefined, "2025-06-01");
    expect(result).toEqual({
      newState: {
        currentStreak: 1,
        longestStreak: 1,
        lastActiveDate: "2025-06-01",
        streakStartDate: "2025-06-01",
      },
      streakIncremented: true,
      streakBroken: false,
    });
  });

  it("returns no-op for same day", () => {
    const current: StreakState = {
      currentStreak: 3,
      longestStreak: 5,
      lastActiveDate: "2025-06-01",
      streakStartDate: "2025-05-30",
    };
    const result = updateStreak(current, "2025-06-01");
    expect(result.streakIncremented).toBe(false);
    expect(result.streakBroken).toBe(false);
    expect(result.newState.currentStreak).toBe(3);
  });

  it("increments streak on next day", () => {
    const current: StreakState = {
      currentStreak: 3,
      longestStreak: 5,
      lastActiveDate: "2025-06-01",
      streakStartDate: "2025-05-30",
    };
    const result = updateStreak(current, "2025-06-02");
    expect(result.streakIncremented).toBe(true);
    expect(result.streakBroken).toBe(false);
    expect(result.newState.currentStreak).toBe(4);
    expect(result.newState.lastActiveDate).toBe("2025-06-02");
    expect(result.newState.streakStartDate).toBe("2025-05-30");
  });

  it("resets streak and marks broken on gap of 2+ days", () => {
    const current: StreakState = {
      currentStreak: 5,
      longestStreak: 10,
      lastActiveDate: "2025-06-01",
      streakStartDate: "2025-05-28",
    };
    const result = updateStreak(current, "2025-06-04");
    expect(result.streakIncremented).toBe(false);
    expect(result.streakBroken).toBe(true);
    expect(result.newState.currentStreak).toBe(1);
    expect(result.newState.streakStartDate).toBe("2025-06-04");
    expect(result.newState.lastActiveDate).toBe("2025-06-04");
  });

  it("handles month boundary (Jan 31 -> Feb 1)", () => {
    const current: StreakState = {
      currentStreak: 2,
      longestStreak: 2,
      lastActiveDate: "2025-01-31",
      streakStartDate: "2025-01-30",
    };
    const result = updateStreak(current, "2025-02-01");
    expect(result.streakIncremented).toBe(true);
    expect(result.streakBroken).toBe(false);
    expect(result.newState.currentStreak).toBe(3);
  });

  it("handles year boundary (Dec 31 -> Jan 1)", () => {
    const current: StreakState = {
      currentStreak: 7,
      longestStreak: 7,
      lastActiveDate: "2025-12-31",
      streakStartDate: "2025-12-25",
    };
    const result = updateStreak(current, "2026-01-01");
    expect(result.streakIncremented).toBe(true);
    expect(result.streakBroken).toBe(false);
    expect(result.newState.currentStreak).toBe(8);
    expect(result.newState.longestStreak).toBe(8);
  });

  it("preserves longestStreak when streak is broken", () => {
    const current: StreakState = {
      currentStreak: 3,
      longestStreak: 10,
      lastActiveDate: "2025-06-01",
      streakStartDate: "2025-05-30",
    };
    const result = updateStreak(current, "2025-06-05");
    expect(result.newState.longestStreak).toBe(10);
    expect(result.newState.currentStreak).toBe(1);
  });

  it("updates longestStreak when current exceeds it", () => {
    const current: StreakState = {
      currentStreak: 5,
      longestStreak: 5,
      lastActiveDate: "2025-06-05",
      streakStartDate: "2025-06-01",
    };
    const result = updateStreak(current, "2025-06-06");
    expect(result.newState.currentStreak).toBe(6);
    expect(result.newState.longestStreak).toBe(6);
  });
});
