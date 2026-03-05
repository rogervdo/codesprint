import { describe, it, expect } from "vitest";
import {
  computeQualityRating,
  computeSM2,
  getMasteryStatus,
  isOverdue,
  sortByReviewPriority,
  getDefaultMasteryRecord,
  type MasteryRecord,
} from "../spaced-repetition";

describe("computeQualityRating", () => {
  it("returns 5 for accuracy > 0.98 with no pattern score", () => {
    expect(computeQualityRating(0.99)).toBe(5);
  });

  it("returns 5 for accuracy > 0.98 and pattern > 90", () => {
    expect(computeQualityRating(0.99, 95)).toBe(5);
  });

  it("returns 4 when accuracy > 0.98 but pattern <= 90", () => {
    expect(computeQualityRating(0.99, 85)).toBe(4);
  });

  it("returns 4 for accuracy > 0.95 with no pattern score", () => {
    expect(computeQualityRating(0.96)).toBe(4);
  });

  it("returns 4 for accuracy > 0.95 and pattern > 80", () => {
    expect(computeQualityRating(0.96, 85)).toBe(4);
  });

  it("returns 3 when accuracy > 0.95 but pattern <= 80", () => {
    expect(computeQualityRating(0.96, 75)).toBe(3);
  });

  it("returns 3 for accuracy > 0.90", () => {
    expect(computeQualityRating(0.91)).toBe(3);
  });

  it("returns 2 for accuracy > 0.80", () => {
    expect(computeQualityRating(0.85)).toBe(2);
  });

  it("returns 1 for accuracy > 0.70", () => {
    expect(computeQualityRating(0.75)).toBe(1);
  });

  it("returns 0 for accuracy <= 0.70", () => {
    expect(computeQualityRating(0.7)).toBe(0);
    expect(computeQualityRating(0.5)).toBe(0);
  });
});

describe("computeSM2", () => {
  const TODAY = "2026-03-04";

  it("sets interval to 1 on first successful review", () => {
    const result = computeSM2(
      { easeFactor: 2.5, interval: 0, repetitions: 0, quality: 5 },
      TODAY,
    );
    expect(result.interval).toBe(1);
    expect(result.repetitions).toBe(1);
    expect(result.nextReviewDate).toBe("2026-03-05");
  });

  it("sets interval to 6 on second successful review", () => {
    const result = computeSM2(
      { easeFactor: 2.5, interval: 1, repetitions: 1, quality: 5 },
      TODAY,
    );
    expect(result.interval).toBe(6);
    expect(result.repetitions).toBe(2);
    expect(result.nextReviewDate).toBe("2026-03-10");
  });

  it("multiplies interval by EF on subsequent reviews", () => {
    const result = computeSM2(
      { easeFactor: 2.5, interval: 6, repetitions: 2, quality: 5 },
      TODAY,
    );
    expect(result.interval).toBe(15); // round(6 * 2.5) = 15
    expect(result.repetitions).toBe(3);
  });

  it("resets on quality < 3", () => {
    const result = computeSM2(
      { easeFactor: 2.5, interval: 15, repetitions: 3, quality: 2 },
      TODAY,
    );
    expect(result.interval).toBe(1);
    expect(result.repetitions).toBe(0);
  });

  it("clamps ease factor to minimum 1.3", () => {
    const result = computeSM2(
      { easeFactor: 1.3, interval: 1, repetitions: 0, quality: 0 },
      TODAY,
    );
    expect(result.easeFactor).toBe(1.3);
  });

  it("updates ease factor using SM-2 formula", () => {
    const result = computeSM2(
      { easeFactor: 2.5, interval: 0, repetitions: 0, quality: 5 },
      TODAY,
    );
    // EF = 2.5 + (0.1 - 0 * (0.08 + 0 * 0.02)) = 2.6
    expect(result.easeFactor).toBeCloseTo(2.6);
  });

  it("computes nextReviewDate correctly", () => {
    const result = computeSM2(
      { easeFactor: 2.5, interval: 6, repetitions: 2, quality: 4 },
      "2026-12-28",
    );
    // interval = round(6 * 2.5) = 15
    expect(result.nextReviewDate).toBe("2027-01-12");
  });
});

describe("isOverdue", () => {
  const makeRecord = (nextReviewDate: string): MasteryRecord => ({
    ...getDefaultMasteryRecord("test", "ts"),
    nextReviewDate,
  });

  it("returns true for past dates", () => {
    expect(isOverdue(makeRecord("2026-03-01"), "2026-03-04")).toBe(true);
  });

  it("returns false for future dates", () => {
    expect(isOverdue(makeRecord("2026-03-10"), "2026-03-04")).toBe(false);
  });

  it("returns true when due today (nextReviewDate === today)", () => {
    expect(isOverdue(makeRecord("2026-03-04"), "2026-03-04")).toBe(true);
  });
});

describe("getMasteryStatus", () => {
  const base = getDefaultMasteryRecord("test", "ts");

  it("returns 'new' for repetitions === 0", () => {
    expect(getMasteryStatus(base, "2026-03-04")).toBe("new");
  });

  it("returns 'due' when overdue", () => {
    const record: MasteryRecord = {
      ...base,
      repetitions: 2,
      interval: 5,
      nextReviewDate: "2026-03-01",
    };
    expect(getMasteryStatus(record, "2026-03-04")).toBe("due");
  });

  it("returns 'mastered' when interval >= 21 and not overdue", () => {
    const record: MasteryRecord = {
      ...base,
      repetitions: 5,
      interval: 21,
      nextReviewDate: "2026-03-10",
    };
    expect(getMasteryStatus(record, "2026-03-04")).toBe("mastered");
  });

  it("returns 'learning' for active records not yet mastered", () => {
    const record: MasteryRecord = {
      ...base,
      repetitions: 2,
      interval: 6,
      nextReviewDate: "2026-03-10",
    };
    expect(getMasteryStatus(record, "2026-03-04")).toBe("learning");
  });
});

describe("sortByReviewPriority", () => {
  const base = getDefaultMasteryRecord("test", "ts");
  const TODAY = "2026-03-04";

  it("sorts overdue items before non-overdue", () => {
    const overdue: MasteryRecord = {
      ...base,
      snippetId: "overdue",
      repetitions: 1,
      nextReviewDate: "2026-03-01",
    };
    const future: MasteryRecord = {
      ...base,
      snippetId: "future",
      repetitions: 1,
      nextReviewDate: "2026-03-10",
    };
    const sorted = sortByReviewPriority([future, overdue], TODAY);
    expect(sorted[0].snippetId).toBe("overdue");
    expect(sorted[1].snippetId).toBe("future");
  });

  it("sorts most overdue first among overdue items", () => {
    const moreOverdue: MasteryRecord = {
      ...base,
      snippetId: "more",
      repetitions: 1,
      nextReviewDate: "2026-02-20",
    };
    const lessOverdue: MasteryRecord = {
      ...base,
      snippetId: "less",
      repetitions: 1,
      nextReviewDate: "2026-03-02",
    };
    const sorted = sortByReviewPriority([lessOverdue, moreOverdue], TODAY);
    expect(sorted[0].snippetId).toBe("more");
    expect(sorted[1].snippetId).toBe("less");
  });

  it("sorts non-overdue by interval ascending", () => {
    const longer: MasteryRecord = {
      ...base,
      snippetId: "longer",
      repetitions: 1,
      interval: 10,
      nextReviewDate: "2026-03-10",
    };
    const shorter: MasteryRecord = {
      ...base,
      snippetId: "shorter",
      repetitions: 1,
      interval: 3,
      nextReviewDate: "2026-03-10",
    };
    const sorted = sortByReviewPriority([longer, shorter], TODAY);
    expect(sorted[0].snippetId).toBe("shorter");
    expect(sorted[1].snippetId).toBe("longer");
  });

  it("does not mutate the input array", () => {
    const records = [
      { ...base, snippetId: "a", repetitions: 1, nextReviewDate: "2026-03-10" },
      { ...base, snippetId: "b", repetitions: 1, nextReviewDate: "2026-03-01" },
    ];
    const original = [...records];
    sortByReviewPriority(records, TODAY);
    expect(records[0].snippetId).toBe(original[0].snippetId);
    expect(records[1].snippetId).toBe(original[1].snippetId);
  });
});

describe("getDefaultMasteryRecord", () => {
  it("returns a record with correct defaults", () => {
    const record = getDefaultMasteryRecord("snippet-1", "typescript");
    expect(record.snippetId).toBe("snippet-1");
    expect(record.language).toBe("typescript");
    expect(record.easeFactor).toBe(2.5);
    expect(record.interval).toBe(0);
    expect(record.repetitions).toBe(0);
    expect(record.bestWpm).toBe(0);
    expect(record.bestAccuracy).toBe(0);
    expect(record.attempts).toBe(0);
  });
});
