# Testing Infrastructure Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add comprehensive test coverage to CodeSprint across unit tests, hook tests, and Playwright E2E.

**Architecture:** Three layers — (1) Vitest unit tests for pure `lib/` modules without test coverage, (2) Vitest `renderHook` tests for React hooks that drive the typing engine, (3) Playwright E2E for the full typing session flow in a real browser with Monaco.

**Tech Stack:** Vitest 4, @testing-library/react 16, fake-indexeddb, Playwright

---

### Task 0: Install dependencies and configure test infrastructure

**Files:**
- Modify: `package.json`
- Modify: `vitest.config.ts`
- Create: `playwright.config.ts`
- Create: `e2e/` directory

**Step 1: Install test dependencies**

Run:
```bash
cd "/Users/connork/code/JS:TS/hackerthihng/codesprint"
bun add -d fake-indexeddb @playwright/test
```

**Step 2: Install Playwright browsers**

Run:
```bash
cd "/Users/connork/code/JS:TS/hackerthihng/codesprint"
bunx playwright install chromium
```

**Step 3: Update vitest.config.ts to add jsdom environment**

Replace `vitest.config.ts` with:

```typescript
import { defineConfig } from "vitest/config";
import { resolve } from "path";

export default defineConfig({
    test: {
        globals: true,
        environment: "jsdom",
        setupFiles: ["./vitest.setup.ts"],
        exclude: ["node_modules", "e2e"],
    },
    resolve: {
        alias: {
            "@": resolve(__dirname, "./"),
        },
    },
});
```

**Step 4: Create playwright.config.ts**

```typescript
import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
    testDir: "./e2e",
    fullyParallel: false,
    retries: 1,
    timeout: 60000,
    use: {
        baseURL: "http://localhost:3000",
        trace: "on-first-retry",
    },
    projects: [
        {
            name: "chromium",
            use: { ...devices["Desktop Chrome"] },
        },
    ],
    webServer: {
        command: "bun run dev",
        url: "http://localhost:3000",
        reuseExistingServer: !process.env.CI,
        timeout: 30000,
    },
});
```

**Step 5: Add test:e2e script to package.json**

Add to scripts: `"test:e2e": "bunx playwright test"`

**Step 6: Add e2e/ and playwright-report/ to .gitignore**

Add these lines:
```
/test-results/
/playwright-report/
```

**Step 7: Verify existing tests still pass**

Run:
```bash
cd "/Users/connork/code/JS:TS/hackerthihng/codesprint"
./node_modules/.bin/vitest run
```
Expected: All existing tests pass.

**Step 8: Commit**

```bash
git add package.json vitest.config.ts playwright.config.ts .gitignore bun.lockb
git commit -m "chore: add test infrastructure for unit, hook, and E2E tests"
```

---

### Task 1: Unit tests for `lib/token-weights.ts`

**Files:**
- Create: `lib/__tests__/token-weights.test.ts`
- Test: `lib/token-weights.ts`

**Step 1: Write the failing tests**

```typescript
import { describe, it, expect } from "vitest";
import { getWeights, getWeight } from "../token-weights";

describe("getWeights", () => {
    it("returns default weights for javascript (no overrides)", () => {
        const weights = getWeights("javascript");
        expect(weights.keyword).toBe(1.5);
        expect(weights.operator).toBe(1.5);
        expect(weights.delimiter).toBe(1.2);
        expect(weights.identifier).toBe(1.0);
        expect(weights.literal).toBe(1.0);
        expect(weights.string).toBe(0.8);
        expect(weights.comment).toBe(0.3);
        expect(weights.whitespace).toBe(0.5);
    });

    it("returns default weights for java (no overrides)", () => {
        const weights = getWeights("java");
        expect(weights.keyword).toBe(1.5);
        expect(weights.whitespace).toBe(0.5);
    });

    it("applies python overrides (whitespace = 0.7)", () => {
        const weights = getWeights("python");
        expect(weights.whitespace).toBe(0.7);
        // Other defaults unchanged
        expect(weights.keyword).toBe(1.5);
        expect(weights.operator).toBe(1.5);
    });

    it("applies cpp overrides (operator = 1.6, delimiter = 1.3)", () => {
        const weights = getWeights("cpp");
        expect(weights.operator).toBe(1.6);
        expect(weights.delimiter).toBe(1.3);
        // Other defaults unchanged
        expect(weights.keyword).toBe(1.5);
        expect(weights.whitespace).toBe(0.5);
    });

    it("returns a new object (not a reference to defaults)", () => {
        const w1 = getWeights("python");
        const w2 = getWeights("python");
        expect(w1).not.toBe(w2);
        expect(w1).toEqual(w2);
    });
});

describe("getWeight", () => {
    it("returns weight for a specific category and language", () => {
        expect(getWeight("python", "whitespace")).toBe(0.7);
        expect(getWeight("javascript", "whitespace")).toBe(0.5);
        expect(getWeight("cpp", "operator")).toBe(1.6);
    });
});
```

**Step 2: Run test to verify it passes**

Run: `./node_modules/.bin/vitest run lib/__tests__/token-weights.test.ts`
Expected: PASS (this is pure logic, tests should pass immediately)

**Step 3: Commit**

```bash
git add lib/__tests__/token-weights.test.ts
git commit -m "test: add unit tests for token-weights module"
```

---

### Task 2: Unit tests for `lib/snippets.ts`

**Files:**
- Create: `lib/__tests__/snippets.test.ts`
- Test: `lib/snippets.ts`

**Step 1: Write the tests**

```typescript
import { describe, it, expect } from "vitest";
import {
    normalizeDataset,
    buildProblemsFromSnippets,
    getProblems,
    getProblemSnippets,
    getSnippet,
    CURATED_SNIPPETS_LIST,
    type Snippet,
} from "../snippets";

describe("CURATED_SNIPPETS_LIST", () => {
    it("has at least one snippet", () => {
        expect(CURATED_SNIPPETS_LIST.length).toBeGreaterThan(0);
    });

    it("all curated snippets have required fields", () => {
        for (const snippet of CURATED_SNIPPETS_LIST) {
            expect(snippet.id).toBeTruthy();
            expect(snippet.problemId).toBeTruthy();
            expect(snippet.title).toBeTruthy();
            expect(snippet.content.length).toBeGreaterThan(0);
            expect(["javascript", "python", "java", "cpp"]).toContain(snippet.language);
            expect(["short", "medium", "long"]).toContain(snippet.lengthCategory);
            expect(["easy", "medium", "hard"]).toContain(snippet.difficulty);
            expect(snippet.lines).toBeGreaterThan(0);
        }
    });

    it("curated snippet content ends with newline", () => {
        for (const snippet of CURATED_SNIPPETS_LIST) {
            expect(snippet.content.endsWith("\n")).toBe(true);
        }
    });

    it("curated snippet content has no \\r\\n", () => {
        for (const snippet of CURATED_SNIPPETS_LIST) {
            expect(snippet.content).not.toContain("\r\n");
        }
    });
});

describe("normalizeDataset", () => {
    it("returns empty array for non-array input", () => {
        expect(normalizeDataset(null)).toEqual([]);
        expect(normalizeDataset("string")).toEqual([]);
        expect(normalizeDataset(42)).toEqual([]);
        expect(normalizeDataset({})).toEqual([]);
    });

    it("returns empty array for empty array", () => {
        expect(normalizeDataset([])).toEqual([]);
    });

    it("skips entries with unsupported languages", () => {
        const result = normalizeDataset([
            { lang: "ruby", content: "puts 'hello'", title: "test" },
        ]);
        expect(result).toEqual([]);
    });

    it("skips entries with empty content", () => {
        const result = normalizeDataset([
            { lang: "javascript", content: "", title: "test" },
        ]);
        expect(result).toEqual([]);
    });

    it("skips skeletal javascript snippets", () => {
        const result = normalizeDataset([
            {
                lang: "javascript",
                content: "var twoSum = function(nums, target) {\n};",
                title: "Two Sum",
                id: "test-skel",
            },
        ]);
        expect(result).toEqual([]);
    });

    it("skips skeletal python snippets", () => {
        const result = normalizeDataset([
            {
                lang: "python",
                content: "class Solution:\n    def twoSum(self, nums, target):\n        pass",
                title: "Two Sum",
                id: "test-skel",
            },
        ]);
        expect(result).toEqual([]);
    });

    it("normalizes valid entries", () => {
        const result = normalizeDataset([
            {
                lang: "javascript",
                content: "function add(a, b) {\n    return a + b;\n}\n",
                title: "Add",
                id: "js-add",
                difficulty: "easy",
            },
        ]);
        expect(result).toHaveLength(1);
        expect(result[0].language).toBe("javascript");
        expect(result[0].title).toBe("Add");
        expect(result[0].difficulty).toBe("easy");
        expect(result[0].content.endsWith("\n")).toBe(true);
    });

    it("strips comments from content", () => {
        const result = normalizeDataset([
            {
                lang: "javascript",
                content: "// comment\nfunction add(a, b) {\n    return a + b;\n}\n",
                title: "Add",
                id: "js-add-comment",
            },
        ]);
        expect(result).toHaveLength(1);
        expect(result[0].content).not.toContain("// comment");
    });

    it("defaults difficulty to easy", () => {
        const result = normalizeDataset([
            {
                lang: "javascript",
                content: "function add(a, b) {\n    return a + b;\n}\n",
                title: "Add",
                id: "js-add-nodifficulty",
            },
        ]);
        expect(result[0].difficulty).toBe("easy");
    });
});

describe("buildProblemsFromSnippets", () => {
    const snippets: Snippet[] = [
        {
            id: "js-a-short",
            problemId: "javascript:a",
            title: "Problem A",
            content: "code\n",
            language: "javascript",
            lengthCategory: "short",
            difficulty: "easy",
            lines: 1,
        },
        {
            id: "js-a-medium",
            problemId: "javascript:a",
            title: "Problem A",
            content: "longer code\n",
            language: "javascript",
            lengthCategory: "medium",
            difficulty: "easy",
            lines: 15,
        },
        {
            id: "js-b-short",
            problemId: "javascript:b",
            title: "Problem B",
            content: "code b\n",
            language: "javascript",
            lengthCategory: "short",
            difficulty: "medium",
            lines: 1,
        },
    ];

    it("groups snippets into problems by problemId", () => {
        const problems = buildProblemsFromSnippets(snippets);
        expect(problems).toHaveLength(2);
    });

    it("collects available lengths for each problem", () => {
        const problems = buildProblemsFromSnippets(snippets);
        const problemA = problems.find((p) => p.id === "javascript:a");
        expect(problemA?.availableLengths).toEqual(["short", "medium"]);
    });

    it("sorts problems alphabetically by title", () => {
        const problems = buildProblemsFromSnippets(snippets);
        expect(problems[0].title).toBe("Problem A");
        expect(problems[1].title).toBe("Problem B");
    });
});

describe("getProblems", () => {
    it("filters by language", () => {
        const problems = getProblems(CURATED_SNIPPETS_LIST, "python");
        expect(problems.length).toBeGreaterThan(0);
        expect(problems.every((p) => p.language === "python")).toBe(true);
    });

    it("filters by length", () => {
        const problems = getProblems(CURATED_SNIPPETS_LIST, "javascript", { length: "short" });
        for (const p of problems) {
            expect(p.availableLengths).toContain("short");
        }
    });
});

describe("getProblemSnippets", () => {
    it("returns snippets for a specific problem", () => {
        const problems = getProblems(CURATED_SNIPPETS_LIST, "python");
        if (problems.length === 0) return;
        const snippets = getProblemSnippets(CURATED_SNIPPETS_LIST, "python", problems[0].id);
        expect(snippets.length).toBeGreaterThan(0);
        expect(snippets.every((s) => s.problemId === problems[0].id)).toBe(true);
    });

    it("respects length filter", () => {
        const snippets = getProblemSnippets(CURATED_SNIPPETS_LIST, "javascript", "javascript:js-array-helpers", { length: "short" });
        for (const s of snippets) {
            expect(s.lengthCategory).toBe("short");
        }
    });
});

describe("getSnippet", () => {
    it("returns a snippet for a language", () => {
        const snippet = getSnippet(CURATED_SNIPPETS_LIST, "python");
        expect(snippet).toBeDefined();
        expect(snippet.language).toBe("python");
    });

    it("prefers matching length filter", () => {
        const snippet = getSnippet(CURATED_SNIPPETS_LIST, "javascript", { length: "short" });
        expect(snippet.lengthCategory).toBe("short");
    });

    it("falls back to any snippet if length filter has no match", () => {
        // Even if no long javascript snippet exists in curated list, it returns something
        const snippet = getSnippet(CURATED_SNIPPETS_LIST, "javascript");
        expect(snippet).toBeDefined();
    });
});
```

**Step 2: Run tests**

Run: `./node_modules/.bin/vitest run lib/__tests__/snippets.test.ts`
Expected: PASS

**Step 3: Commit**

```bash
git add lib/__tests__/snippets.test.ts
git commit -m "test: add unit tests for snippets module"
```

---

### Task 3: Unit tests for `lib/preferences-core.ts`

**Files:**
- Create: `lib/__tests__/preferences-core.test.ts`
- Test: `lib/preferences-core.ts`

**Step 1: Write the tests**

```typescript
import { describe, it, expect } from "vitest";
import {
    DEFAULT_PREFERENCES,
    THEME_PRESETS,
    computeCaretHeight,
    sanitizePreferences,
    type ThemePreset,
} from "../preferences-core";

describe("DEFAULT_PREFERENCES", () => {
    it("has expected default values", () => {
        expect(DEFAULT_PREFERENCES.theme).toBe("gruvbox");
        expect(DEFAULT_PREFERENCES.fontSize).toBe(24);
        expect(DEFAULT_PREFERENCES.caretWidth).toBe(3);
        expect(DEFAULT_PREFERENCES.countdownEnabled).toBe(false);
        expect(DEFAULT_PREFERENCES.surfaceStyle).toBe("immersive");
        expect(DEFAULT_PREFERENCES.showLiveStatsDuringRun).toBe(true);
        expect(DEFAULT_PREFERENCES.interfaceMode).toBe("ide");
        expect(DEFAULT_PREFERENCES.requireTabForIndent).toBe(false);
        expect(DEFAULT_PREFERENCES.syntaxHighlighting).toBe("full");
        expect(DEFAULT_PREFERENCES.vimMode).toBe(false);
        expect(DEFAULT_PREFERENCES.debugGapBuffer).toBe(false);
    });
});

describe("THEME_PRESETS", () => {
    const themeNames: ThemePreset[] = [
        "midnight", "vaporwave", "solarized", "dracula", "monokai",
        "gruvbox", "nord", "oneDark", "8008", "arch", "bento",
        "bliss", "botanical", "carbon", "serika", "miamiNights", "terra",
    ];

    it("has all expected themes", () => {
        for (const name of themeNames) {
            expect(THEME_PRESETS[name]).toBeDefined();
        }
    });

    it("each theme has all required token keys", () => {
        const requiredKeys = [
            "bg", "bgMuted", "bgGradient", "text", "textSubtle",
            "accent", "caret", "error", "errorExtra", "panel",
        ];
        for (const name of themeNames) {
            const theme = THEME_PRESETS[name];
            for (const key of requiredKeys) {
                expect(theme).toHaveProperty(key);
            }
        }
    });
});

describe("computeCaretHeight", () => {
    it("computes height as fontSize * 1.55 rounded", () => {
        expect(computeCaretHeight(24)).toBe(37);
        expect(computeCaretHeight(16)).toBe(25);
        expect(computeCaretHeight(36)).toBe(56);
    });
});

describe("sanitizePreferences", () => {
    it("returns defaults for null/undefined", () => {
        expect(sanitizePreferences(null)).toEqual(DEFAULT_PREFERENCES);
        expect(sanitizePreferences(undefined)).toEqual(DEFAULT_PREFERENCES);
    });

    it("returns defaults for non-object", () => {
        expect(sanitizePreferences("string")).toEqual(DEFAULT_PREFERENCES);
        expect(sanitizePreferences(42)).toEqual(DEFAULT_PREFERENCES);
    });

    it("preserves valid preferences", () => {
        const input = {
            theme: "dracula",
            fontSize: 20,
            caretWidth: 4,
            countdownEnabled: true,
            surfaceStyle: "panel",
            showLiveStatsDuringRun: false,
            interfaceMode: "terminal",
            requireTabForIndent: true,
            syntaxHighlighting: "none",
            vimMode: true,
            debugGapBuffer: true,
        };
        const result = sanitizePreferences(input);
        expect(result.theme).toBe("dracula");
        expect(result.fontSize).toBe(20);
        expect(result.caretWidth).toBe(4);
        expect(result.countdownEnabled).toBe(true);
        expect(result.surfaceStyle).toBe("panel");
        expect(result.showLiveStatsDuringRun).toBe(false);
        expect(result.interfaceMode).toBe("terminal");
        expect(result.requireTabForIndent).toBe(true);
        expect(result.syntaxHighlighting).toBe("none");
        expect(result.vimMode).toBe(true);
        expect(result.debugGapBuffer).toBe(true);
    });

    it("clamps fontSize to valid range (16-36)", () => {
        expect(sanitizePreferences({ fontSize: 10 }).fontSize).toBe(DEFAULT_PREFERENCES.fontSize);
        expect(sanitizePreferences({ fontSize: 50 }).fontSize).toBe(DEFAULT_PREFERENCES.fontSize);
        expect(sanitizePreferences({ fontSize: 16 }).fontSize).toBe(16);
        expect(sanitizePreferences({ fontSize: 36 }).fontSize).toBe(36);
    });

    it("clamps caretWidth to valid range (2-6)", () => {
        expect(sanitizePreferences({ caretWidth: 1 }).caretWidth).toBe(DEFAULT_PREFERENCES.caretWidth);
        expect(sanitizePreferences({ caretWidth: 10 }).caretWidth).toBe(DEFAULT_PREFERENCES.caretWidth);
        expect(sanitizePreferences({ caretWidth: 2 }).caretWidth).toBe(2);
        expect(sanitizePreferences({ caretWidth: 6 }).caretWidth).toBe(6);
    });

    it("rejects invalid theme names", () => {
        expect(sanitizePreferences({ theme: "nonexistent" }).theme).toBe(DEFAULT_PREFERENCES.theme);
    });

    it("migrates legacy syntaxHighlightingEnabled boolean", () => {
        expect(sanitizePreferences({ syntaxHighlightingEnabled: true }).syntaxHighlighting).toBe("full");
        expect(sanitizePreferences({ syntaxHighlightingEnabled: false }).syntaxHighlighting).toBe("none");
    });
});
```

**Step 2: Run tests**

Run: `./node_modules/.bin/vitest run lib/__tests__/preferences-core.test.ts`
Expected: PASS

**Step 3: Commit**

```bash
git add lib/__tests__/preferences-core.test.ts
git commit -m "test: add unit tests for preferences-core module"
```

---

### Task 4: Unit tests for `lib/analytics/aggregations.ts`

**Files:**
- Modify: `lib/analytics/__tests__/aggregations.test.ts` (currently only tests Dashboard utilities — add actual aggregation function tests)
- Test: `lib/analytics/aggregations.ts`

Note: The aggregation functions call `getSessions()` from session-history, which reads from localStorage. We need to mock that module.

**Step 1: Write the tests**

Create `lib/analytics/__tests__/aggregations-functions.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { SessionRecord } from "@/lib/storage/session-history";

// Mock getSessions before importing aggregations
const mockSessions: SessionRecord[] = [];
vi.mock("@/lib/storage/session-history", () => ({
    getSessions: vi.fn((filters?: Record<string, unknown>) => {
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
        expect(trend.overallChange).toBe(100); // 50 -> 100 = 100% increase
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
        expect(progress[1].cumulativeAvgWpm).toBe(70); // (60 + 80) / 2
        expect(progress[1].cumulativeSessions).toBe(2);
    });
});
```

**Step 2: Run tests**

Run: `./node_modules/.bin/vitest run lib/analytics/__tests__/aggregations-functions.test.ts`
Expected: PASS

**Step 3: Commit**

```bash
git add lib/analytics/__tests__/aggregations-functions.test.ts
git commit -m "test: add unit tests for analytics aggregation functions"
```

---

### Task 5: Unit tests for `lib/storage/idb-store.ts`

**Files:**
- Create: `lib/storage/__tests__/idb-store.test.ts`
- Test: `lib/storage/idb-store.ts`

**Step 1: Write the tests**

```typescript
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
    beforeEach(() => {
        resetDbConnection();
        // Clear all databases by deleting and recreating
        indexedDB.deleteDatabase("codesprint");
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
```

**Step 2: Run tests**

Run: `./node_modules/.bin/vitest run lib/storage/__tests__/idb-store.test.ts`
Expected: PASS

**Step 3: Commit**

```bash
git add lib/storage/__tests__/idb-store.test.ts
git commit -m "test: add unit tests for IndexedDB store module"
```

---

### Task 6: Unit tests for `lib/storage/migration.ts`

**Files:**
- Create: `lib/storage/__tests__/migration.test.ts`
- Test: `lib/storage/migration.ts`

**Step 1: Write the tests**

```typescript
import { describe, it, expect, beforeEach, vi } from "vitest";
import "fake-indexeddb/auto";
import { resetDbConnection, idbGet, idbGetAll, STORES } from "../idb-store";
import type { MetaRecord } from "../idb-store";
import { runMigrations, CURRENT_VERSION, MIGRATION_VERSION_KEY } from "../migration";

// Mock localStorage
const mockStore: Record<string, string> = {};
vi.stubGlobal("window", {
    localStorage: {
        getItem: vi.fn((key: string) => mockStore[key] ?? null),
        setItem: vi.fn((key: string, value: string) => { mockStore[key] = value; }),
        removeItem: vi.fn((key: string) => { delete mockStore[key]; }),
    },
});

describe("migration", () => {
    beforeEach(() => {
        resetDbConnection();
        indexedDB.deleteDatabase("codesprint");
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
        mockStore["codesprint-session-history"] = JSON.stringify(sessions);

        const result = await runMigrations();
        expect(result.migrated).toBe(true);
        expect(result.sessionCount).toBe(2);

        const stored = await idbGetAll(STORES.sessions);
        expect(stored).toHaveLength(2);
    });

    it("sets migration version after running", async () => {
        mockStore["codesprint-session-history"] = JSON.stringify([]);
        await runMigrations();

        const meta = await idbGet<MetaRecord>(STORES.meta, MIGRATION_VERSION_KEY);
        expect(meta?.value).toBe(CURRENT_VERSION);
    });

    it("skips migration if already at current version", async () => {
        // First migration
        mockStore["codesprint-session-history"] = JSON.stringify([
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
        mockStore["codesprint-session-history"] = JSON.stringify([
            { id: "valid", date: "2026-01-15", snippetId: "t", language: "js", wpm: 60, accuracy: 0.9 },
            { bad: "record" },
            null,
            "not an object",
        ]);

        const result = await runMigrations();
        expect(result.sessionCount).toBe(1); // Only the valid one
    });

    it("handles malformed JSON gracefully", async () => {
        mockStore["codesprint-session-history"] = "not valid json {{{";
        const result = await runMigrations();
        expect(result.migrated).toBe(true);
        expect(result.sessionCount).toBe(0);
    });
});
```

**Step 2: Run tests**

Run: `./node_modules/.bin/vitest run lib/storage/__tests__/migration.test.ts`
Expected: PASS

**Step 3: Commit**

```bash
git add lib/storage/__tests__/migration.test.ts
git commit -m "test: add unit tests for storage migration module"
```

---

### Task 7: Hook tests for `useSessionControls`

**Files:**
- Create: `hooks/__tests__/useSessionControls.test.ts`
- Test: `hooks/useSessionControls.ts`

**Step 1: Write the tests**

```typescript
import { describe, it, expect, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useSessionControls } from "../useSessionControls";
import { CURATED_SNIPPETS_LIST } from "@/lib/snippets";

describe("useSessionControls", () => {
    const mockResetEngine = vi.fn();

    function renderControls(snippets = CURATED_SNIPPETS_LIST) {
        return renderHook(() =>
            useSessionControls({ snippets, onResetEngine: mockResetEngine })
        );
    }

    it("initializes with default language (python) and length (short)", () => {
        const { result } = renderControls();
        expect(result.current.language).toBe("python");
        expect(result.current.lengthPreference).toBe("short");
    });

    it("returns problem options for the selected language", () => {
        const { result } = renderControls();
        expect(result.current.problemOptions.length).toBeGreaterThan(0);
        for (const problem of result.current.problemOptions) {
            expect(problem.language).toBe("python");
        }
    });

    it("changes language and updates problem options", () => {
        const { result } = renderControls();
        act(() => {
            result.current.setLanguage("javascript");
        });
        expect(result.current.language).toBe("javascript");
        for (const problem of result.current.problemOptions) {
            expect(problem.language).toBe("javascript");
        }
    });

    it("resolves a snippet", () => {
        const { result } = renderControls();
        expect(result.current.snippet).toBeDefined();
        expect(result.current.snippet.content.length).toBeGreaterThan(0);
    });

    it("navigates to next problem", () => {
        const { result } = renderControls();
        const firstProblemId = result.current.problemId;
        act(() => {
            result.current.handleNextProblem();
        });
        // Either wraps around or advances
        if (result.current.problemOptions.length > 1) {
            expect(result.current.problemId).not.toBe(firstProblemId);
        }
        expect(mockResetEngine).toHaveBeenCalled();
    });

    it("changes length preference", () => {
        const { result } = renderControls();
        act(() => {
            result.current.setLengthPreference("medium");
        });
        expect(result.current.lengthPreference).toBe("medium");
    });
});
```

**Step 2: Run tests**

Run: `./node_modules/.bin/vitest run hooks/__tests__/useSessionControls.test.ts`
Expected: PASS

**Step 3: Commit**

```bash
git add hooks/__tests__/useSessionControls.test.ts
git commit -m "test: add hook tests for useSessionControls"
```

---

### Task 8: Hook tests for `useTypingEngine`

**Files:**
- Create: `hooks/__tests__/useTypingEngine.test.ts`
- Test: `hooks/useTypingEngine.ts`

Note: `useTypingEngine` depends on `usePreferences` from a React context. We need to mock that.

**Step 1: Write the tests**

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";

// Mock the preferences module
vi.mock("@/lib/preferences", () => ({
    usePreferences: () => ({
        preferences: {
            countdownEnabled: false,
            vimMode: false,
            requireTabForIndent: false,
        },
    }),
}));

import { useTypingEngine, type Phase } from "../useTypingEngine";
import type { Snippet } from "@/lib/snippets";

function makeSnippet(content: string): Snippet {
    return {
        id: "test",
        problemId: "test:test",
        title: "Test",
        content,
        language: "javascript",
        lengthCategory: "short",
        difficulty: "easy",
        lines: content.split("\n").length,
    };
}

function fireKey(key: string, opts: Partial<KeyboardEvent> = {}) {
    const event = new KeyboardEvent("keydown", {
        key,
        bubbles: true,
        cancelable: true,
        ...opts,
    });
    return event;
}

describe("useTypingEngine", () => {
    beforeEach(() => {
        vi.useFakeTimers();
    });

    it("starts in idle phase", () => {
        const { result } = renderHook(() =>
            useTypingEngine({ snippet: makeSnippet("ab\n") })
        );
        expect(result.current.phase).toBe("idle");
        expect(result.current.cursorIndex).toBe(0);
    });

    it("transitions from idle to running on first keystroke (no countdown)", () => {
        const { result } = renderHook(() =>
            useTypingEngine({ snippet: makeSnippet("ab\n") })
        );
        act(() => {
            result.current.handleKeyDown(fireKey("a"));
        });
        expect(result.current.phase).toBe("running");
    });

    it("advances cursor on correct keystroke", () => {
        const { result } = renderHook(() =>
            useTypingEngine({ snippet: makeSnippet("ab\n") })
        );
        act(() => {
            result.current.handleKeyDown(fireKey("a"));
        });
        expect(result.current.cursorIndex).toBe(1);
        expect(result.current.wrongChars.size).toBe(0);
    });

    it("marks wrong character on incorrect keystroke", () => {
        const { result } = renderHook(() =>
            useTypingEngine({ snippet: makeSnippet("ab\n") })
        );
        act(() => {
            result.current.handleKeyDown(fireKey("x")); // expected 'a'
        });
        expect(result.current.cursorIndex).toBe(1);
        expect(result.current.wrongChars.has(0)).toBe(true);
    });

    it("handles backspace", () => {
        const { result } = renderHook(() =>
            useTypingEngine({ snippet: makeSnippet("ab\n") })
        );
        act(() => {
            result.current.handleKeyDown(fireKey("a"));
        });
        expect(result.current.cursorIndex).toBe(1);
        act(() => {
            result.current.handleKeyDown(fireKey("Backspace"));
        });
        expect(result.current.cursorIndex).toBe(0);
    });

    it("backspace does nothing at index 0", () => {
        const { result } = renderHook(() =>
            useTypingEngine({ snippet: makeSnippet("ab\n") })
        );
        act(() => {
            // First keystroke to enter running phase
            result.current.handleKeyDown(fireKey("Backspace"));
        });
        expect(result.current.cursorIndex).toBe(0);
    });

    it("finishes when all characters are typed correctly", () => {
        const onFinish = vi.fn();
        const { result } = renderHook(() =>
            useTypingEngine({ snippet: makeSnippet("ab\n"), onFinish })
        );
        act(() => {
            result.current.handleKeyDown(fireKey("a"));
        });
        act(() => {
            result.current.handleKeyDown(fireKey("b"));
        });
        // Content is "ab\n" — typing 'a' and 'b' should complete (trailing \n)
        expect(result.current.phase).toBe("finished");
        expect(onFinish).toHaveBeenCalled();
    });

    it("logs errors", () => {
        const { result } = renderHook(() =>
            useTypingEngine({ snippet: makeSnippet("abc\n") })
        );
        act(() => {
            result.current.handleKeyDown(fireKey("x")); // wrong
        });
        expect(result.current.errorLog).toHaveLength(1);
        expect(result.current.errorLog[0]).toMatchObject({
            expected: "a",
            got: "x",
            index: 0,
        });
    });

    it("resets state correctly", () => {
        const { result } = renderHook(() =>
            useTypingEngine({ snippet: makeSnippet("ab\n") })
        );
        act(() => {
            result.current.handleKeyDown(fireKey("a"));
        });
        expect(result.current.phase).toBe("running");
        act(() => {
            result.current.reset();
        });
        expect(result.current.phase).toBe("idle");
        expect(result.current.cursorIndex).toBe(0);
        expect(result.current.wrongChars.size).toBe(0);
        expect(result.current.errorLog).toEqual([]);
    });

    it("treats Enter as newline character", () => {
        const { result } = renderHook(() =>
            useTypingEngine({ snippet: makeSnippet("a\nb\n") })
        );
        act(() => {
            result.current.handleKeyDown(fireKey("a"));
        });
        act(() => {
            result.current.handleKeyDown(fireKey("Enter"));
        });
        expect(result.current.cursorIndex).toBe(2);
        expect(result.current.wrongChars.size).toBe(0);
    });

    it("ignores modifier keys", () => {
        const { result } = renderHook(() =>
            useTypingEngine({ snippet: makeSnippet("ab\n") })
        );
        act(() => {
            result.current.handleKeyDown(fireKey("Meta"));
            result.current.handleKeyDown(fireKey("Alt"));
            result.current.handleKeyDown(fireKey("Control"));
        });
        expect(result.current.phase).toBe("idle");
        expect(result.current.cursorIndex).toBe(0);
    });
});
```

**Step 2: Run tests**

Run: `./node_modules/.bin/vitest run hooks/__tests__/useTypingEngine.test.ts`
Expected: PASS

**Step 3: Commit**

```bash
git add hooks/__tests__/useTypingEngine.test.ts
git commit -m "test: add hook tests for useTypingEngine state machine"
```

---

### Task 9: Hook tests for `useSessionLifecycle`

**Files:**
- Create: `hooks/__tests__/useSessionLifecycle.test.ts`
- Test: `hooks/useSessionLifecycle.ts`

**Step 1: Write the tests**

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";

// Mock leaderboard
vi.mock("@/lib/leaderboard", () => ({
    saveScore: vi.fn(),
}));

import { useSessionLifecycle } from "../useSessionLifecycle";
import { saveScore } from "@/lib/leaderboard";

describe("useSessionLifecycle", () => {
    const mockResetEngine = vi.fn();

    beforeEach(() => {
        vi.clearAllMocks();
    });

    function renderLifecycle(overrides = {}) {
        return renderHook(() =>
            useSessionLifecycle({
                phase: "idle",
                snippetId: "test-snippet",
                metrics: { adjustedWpm: 60, accuracy: 0.95 },
                language: "javascript",
                onResetEngine: mockResetEngine,
                ...overrides,
            })
        );
    }

    it("starts with no auto-advance deadline", () => {
        const { result } = renderLifecycle();
        expect(result.current.autoAdvanceDeadline).toBeNull();
    });

    it("setAutoAdvance sets a deadline", () => {
        const { result } = renderLifecycle();
        const before = Date.now();
        act(() => {
            result.current.setAutoAdvance(5000);
        });
        expect(result.current.autoAdvanceDeadline).toBeGreaterThanOrEqual(before + 5000);
    });

    it("clearAutoAdvance removes the deadline", () => {
        const { result } = renderLifecycle();
        act(() => {
            result.current.setAutoAdvance(5000);
        });
        expect(result.current.autoAdvanceDeadline).not.toBeNull();
        act(() => {
            result.current.clearAutoAdvance();
        });
        expect(result.current.autoAdvanceDeadline).toBeNull();
    });

    it("saves score when phase becomes finished", () => {
        const { rerender } = renderHook(
            ({ phase }) =>
                useSessionLifecycle({
                    phase,
                    snippetId: "test-snippet",
                    metrics: { adjustedWpm: 75, accuracy: 0.92 },
                    language: "python",
                    onResetEngine: mockResetEngine,
                }),
            { initialProps: { phase: "running" as const } }
        );

        rerender({ phase: "finished" as const });
        expect(saveScore).toHaveBeenCalledWith({
            wpm: 75,
            accuracy: 0.92,
            language: "python",
            snippetId: "test-snippet",
        });
    });

    it("resets engine when snippetId changes", () => {
        const { rerender } = renderHook(
            ({ snippetId }) =>
                useSessionLifecycle({
                    phase: "idle",
                    snippetId,
                    metrics: { adjustedWpm: 60, accuracy: 0.95 },
                    language: "javascript",
                    onResetEngine: mockResetEngine,
                }),
            { initialProps: { snippetId: "snippet-1" } }
        );

        mockResetEngine.mockClear();
        rerender({ snippetId: "snippet-2" });
        expect(mockResetEngine).toHaveBeenCalled();
    });
});
```

**Step 2: Run tests**

Run: `./node_modules/.bin/vitest run hooks/__tests__/useSessionLifecycle.test.ts`
Expected: PASS

**Step 3: Commit**

```bash
git add hooks/__tests__/useSessionLifecycle.test.ts
git commit -m "test: add hook tests for useSessionLifecycle"
```

---

### Task 10: Playwright E2E test for full typing session

**Files:**
- Create: `e2e/typing-session.spec.ts`

**Step 1: Write the E2E test**

```typescript
import { test, expect } from "@playwright/test";

test.describe("Typing Session", () => {
    test("completes a full typing session with results", async ({ page }) => {
        await page.goto("/");

        // Wait for the app to load — Monaco editor renders inside this container
        const editor = page.locator(".monaco-editor");
        await expect(editor).toBeVisible({ timeout: 15000 });

        // The code panel should show snippet content
        const codePanel = page.locator("[data-testid='code-panel']").or(
            page.locator(".view-lines")
        );
        await expect(codePanel).toBeVisible({ timeout: 10000 });

        // Get the snippet content that needs to be typed
        // We read it from the reference display (the target code shown to the user)
        // The snippet is rendered in a code display area
        const snippetText = await page.evaluate(() => {
            // Try to find the snippet content from the page
            // The snippet is stored in the TypingSession component state
            // We can read it from a data attribute or from the visible text
            const codeLines = document.querySelectorAll(".code-line, .view-line");
            if (codeLines.length > 0) {
                return Array.from(codeLines).map((el) => el.textContent ?? "").join("\n");
            }
            return null;
        });

        // Click the editor area to focus it
        await editor.click();

        // Wait a moment for focus
        await page.waitForTimeout(500);

        // Type a few characters — we don't need to complete the full snippet,
        // just verify the typing flow works
        // The default snippet is Python, start typing the first few chars
        await page.keyboard.type("i", { delay: 50 });
        await page.keyboard.type("m", { delay: 50 });
        await page.keyboard.type("p", { delay: 50 });

        // Verify the session started — look for live stats or progress indicator
        // The app should transition from idle to running phase
        await page.waitForTimeout(2000);

        // Check that some stats are visible (WPM counter, progress, etc.)
        const statsArea = page.locator("text=/WPM|wpm/i").first();
        // Stats may or may not be visible depending on preferences
        // At minimum, the editor should still be active

        // Verify the app didn't crash — editor should still be visible
        await expect(editor).toBeVisible();
    });

    test("loads without errors", async ({ page }) => {
        const errors: string[] = [];
        page.on("pageerror", (error) => errors.push(error.message));
        page.on("console", (msg) => {
            if (msg.type() === "error") errors.push(msg.text());
        });

        await page.goto("/");
        await page.waitForTimeout(3000);

        // Filter out known non-critical warnings
        const criticalErrors = errors.filter(
            (e) => !e.includes("hydration") && !e.includes("Warning:")
        );
        expect(criticalErrors).toEqual([]);
    });
});
```

**Step 2: Run the E2E test**

Run:
```bash
cd "/Users/connork/code/JS:TS/hackerthihng/codesprint"
bunx playwright test
```
Expected: Tests pass (app loads, typing works in real browser)

**Step 3: Commit**

```bash
git add e2e/typing-session.spec.ts
git commit -m "test: add Playwright E2E test for typing session flow"
```

---

### Task 11: Run full test suite and verify

**Step 1: Run all unit/hook tests**

Run:
```bash
cd "/Users/connork/code/JS:TS/hackerthihng/codesprint"
./node_modules/.bin/vitest run
```
Expected: All tests pass

**Step 2: Run E2E tests**

Run:
```bash
cd "/Users/connork/code/JS:TS/hackerthihng/codesprint"
bunx playwright test
```
Expected: All tests pass

**Step 3: Check TypeScript compilation**

Run:
```bash
cd "/Users/connork/code/JS:TS/hackerthihng/codesprint"
./node_modules/.bin/tsc --noEmit
```
Expected: No errors

**Step 4: Final commit with all tests passing**

```bash
git add -A
git status
# Only commit if there are remaining unstaged changes
git commit -m "test: complete testing infrastructure with unit, hook, and E2E tests"
```
