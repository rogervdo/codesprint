# CodeSprint — Predicted Issues Spec Sheet

> Generated: 2026-03-21 | Branch: `fix/bugfix-sweep`
> Sorted by **effort (lowest first)**, then by **risk severity**.

---

## Quick Wins (< 1 hour each)

### P-06 · Unsafe leaderboard JSON parse
| Field | Value |
|-------|-------|
| **Severity** | HIGH |
| **Category** | Data Integrity / Crash |
| **Effort** | ~10 min |
| **File** | `lib/leaderboard.ts:38-39` |
| **Timeline** | Any time — localStorage is a hostile environment |

**Problem:**
`getLeaderboard()` parses localStorage JSON and casts directly to `LeaderboardEntry[]` with no runtime validation. If the stored value is corrupted (browser extension, manual edit, version mismatch, another app writing to the same key), `parsed.slice()` throws on a non-array value, crashing the leaderboard modal.

**Current code:**
```ts
const parsed = JSON.parse(stored) as LeaderboardEntry[];
return parsed.slice(0, limit);
```

**Fix:**
Add an `Array.isArray(parsed)` guard — identical to what `session-history.ts:51` already does:
```ts
const parsed = JSON.parse(stored);
if (!Array.isArray(parsed)) return [];
return (parsed as LeaderboardEntry[]).slice(0, limit);
```

**Acceptance criteria:**
- [ ] `getLeaderboard()` returns `[]` on non-array JSON
- [ ] Unit test: corrupt localStorage → no crash, empty array returned
- [ ] `saveScore()` similarly validates before appending

---

### P-12 · Swallowed error in AppShell progress summary
| Field | Value |
|-------|-------|
| **Severity** | MEDIUM |
| **Category** | Observability / UX |
| **Effort** | ~10 min |
| **File** | `components/AppShell.tsx:46` |
| **Timeline** | Any IDB failure (quota, corruption, blocked by browser) |

**Problem:**
```ts
}).catch(() => {});
```
If IndexedDB fails to load XP/streak/achievements, the header silently shows nothing — no level, no streak, no error indicator. Combined with the dual-write divergence (P-02), this masks data corruption from the user.

**Fix:**
- Log the error: `.catch((err) => console.warn("Failed to load progress summary:", err))`
- Optionally show a subtle "data unavailable" indicator in the header

**Acceptance criteria:**
- [ ] IDB failure is logged to console
- [ ] Header gracefully handles `null` data (already does, just needs the log)

---

### P-09 · `requestIdleCallback` / `setTimeout` leak in useSnippets
| Field | Value |
|-------|-------|
| **Severity** | LOW |
| **Category** | Memory Leak |
| **Effort** | ~15 min |
| **File** | `hooks/useSnippets.ts:88-93` |
| **Timeline** | If routing/navigation is added; currently single-page so low risk |

**Problem:**
The `setTimeout` fallback (line 92) is never stored or cleared on unmount. The `requestIdleCallback` also has no `cancelIdleCallback`. If the component unmounts during background loading, the callbacks fire against an unmounted component.

The `mounted` flag partially mitigates this (prevents `setState` on unmount), but the callbacks still run unnecessarily and hold references to closed-over state.

**Fix:**
```ts
const timeoutId = useRef<number | null>(null);
const idleId = useRef<number | null>(null);

// In the effect:
if (typeof requestIdleCallback !== "undefined") {
    idleId.current = requestIdleCallback(() => loadInBackground());
} else {
    timeoutId.current = window.setTimeout(() => loadInBackground(), 100);
}

// In cleanup:
return () => {
    mounted = false;
    if (idleId.current !== null) cancelIdleCallback(idleId.current);
    if (timeoutId.current !== null) clearTimeout(timeoutId.current);
};
```

**Acceptance criteria:**
- [ ] No warnings about setState on unmounted component
- [ ] Timeout/idle IDs are cleaned up on unmount

---

### P-07 · `handleSessionFinished` callback identity instability
| Field | Value |
|-------|-------|
| **Severity** | HIGH |
| **Category** | Performance / Correctness |
| **Effort** | ~20 min |
| **File** | `components/TypingSession.tsx:129-149` |
| **Timeline** | Now (latent) — causes unnecessary effect re-evaluations every render |

**Problem:**
`handleSessionFinished` depends on `[sr, adaptive]` — both are hook return objects that likely have new references every render. This means the callback is recreated every render, causing `useSessionLifecycle`'s dependency array to fire, potentially re-triggering the save-score effect.

**Fix:**
Extract stable method references:
```ts
const srUpdateMastery = sr.updateMastery;
const adaptiveUpdateSkillModel = adaptive.updateSkillModel;

const handleSessionFinished = useCallback((sessionData) => {
    srUpdateMastery({ ... });
    adaptiveUpdateSkillModel({ ... });
}, [srUpdateMastery, adaptiveUpdateSkillModel]);
```

Or use refs for the callbacks to completely decouple identity:
```ts
const sessionFinishedRef = useRef(handleSessionFinished);
sessionFinishedRef.current = handleSessionFinished;
```

**Acceptance criteria:**
- [ ] `handleSessionFinished` has stable identity across renders
- [ ] No duplicate score saves on session finish
- [ ] React DevTools profiler shows fewer re-renders in `useSessionLifecycle`

---

## Medium Effort (1–3 hours each)

### P-11 · `computePatternScore` full-content iteration every 1.5s
| Field | Value |
|-------|-------|
| **Severity** | MEDIUM |
| **Category** | Performance |
| **Effort** | ~1 hour |
| **File** | `lib/scoring.ts:75-105` |
| **Timeline** | When snippets exceed ~5000 chars (large dataset snippets) |

**Problem:**
`buildCategoryMap` creates a full-length array and `computePatternScore` iterates the entire `contentLength` on every call. Called every 1.5s during typing via `calculateAndPublishMetrics`. For a 2000-char snippet: O(2000) every 1.5s. Not a problem now, but scales linearly.

**Fix:**
Cache `categoryMap` and `totalWeight` once per snippet (they don't change). Only recalculate `errorWeight` from the error set on each call.

```ts
// Memoize per snippet:
const cachedMap = useMemo(() => buildCategoryMap(tokens, contentLength), [tokens, contentLength]);
const cachedTotalWeight = useMemo(() => {
    const weights = getWeights(language);
    return cachedMap.reduce((sum, cat) => sum + weights[cat], 0);
}, [cachedMap, language]);
```

**Acceptance criteria:**
- [ ] `buildCategoryMap` called once per snippet, not per metrics tick
- [ ] Pattern score results unchanged (unit test regression)
- [ ] Measurable reduction in CPU time during typing (profiler)

---

### P-01 · Unbounded `Set` cloning on every keystroke in useTypingEngine
| Field | Value |
|-------|-------|
| **Severity** | CRITICAL |
| **Category** | Performance |
| **Effort** | ~2 hours |
| **File** | `hooks/useTypingEngine.ts:376-421` |
| **Timeline** | Weeks — noticeable jank on long snippets at high WPM |

**Problem:**
Every keystroke creates a new `Set` via `new Set(prev)` inside `setWrongChars`. For a 500-char snippet at 100 WPM (~8 keystrokes/sec), that's 8 Set copy+allocations per second. On long snippets with accumulated errors, this is O(n) per keystroke where n = `wrongChars.size`.

Multiple call sites:
- Line 282: `new Set(prev)` — Tab auto-advance
- Line 308: `new Set(prev)` — Manual tab
- Line 324: `new Set(prev)` — Literal tab
- Line 376: `new Set(prev)` — Backspace
- Line 393: `new Set(prev)` — Auto-indent on regular typing
- Line 416: `new Set(prev)` — Correct char (delete from set)
- Line 421: `new Set(prev).add(currentIndex)` — Wrong char

**Fix options:**
1. **Ref + throttled publish:** Track `wrongChars` in a mutable `Set` ref. Publish to state on the metrics interval (every 1.5s) or on phase change. Decorations in `CodePanel` would read from the ref via a callback.
2. **Immutable bitmap:** Use a `Uint8Array` instead of `Set<number>` — O(1) clone via `.slice()`, O(1) set/clear.
3. **Batched state:** Accumulate changes in a ref during the event handler, flush once via `flushSync` or `startTransition`.

**Acceptance criteria:**
- [ ] No new `Set()` allocation per keystroke
- [ ] Typing feel unchanged (no visual regression)
- [ ] Benchmark: >30% reduction in GC pressure on a 40-line snippet at 100 WPM
- [ ] All existing typing engine tests pass

---

### P-05 · Monaco `deltaDecorations` full rebuild on every cursor move
| Field | Value |
|-------|-------|
| **Severity** | HIGH |
| **Category** | Performance |
| **Effort** | ~2 hours |
| **File** | `components/CodePanel.tsx:435-472` |
| **Timeline** | Weeks — frame drops at high typing speeds on medium+ snippets |

**Problem:**
Every `cursorChar` change triggers:
1. An O(cursorIndex) loop building `completedDecorations`
2. `Array.from(wrongChars).map(...)` building `errorDecorations`
3. `editor.deltaDecorations(...)` diffing the entire array

At 100 WPM on a 500-char snippet: ~8 full decoration rebuilds/sec.

**Fix:**
- Split decorations into two stable arrays tracked in refs
- For "completed" range: incrementally extend the last decoration range (cursor only moves forward during typing)
- For "error" decorations: only rebuild when `wrongChars` set identity changes (not on every cursor move)
- Use `useMemo` or a ref comparison to skip rebuilds when inputs haven't meaningfully changed

**Acceptance criteria:**
- [ ] Decorations only rebuild when `wrongChars` changes or cursor crosses a boundary
- [ ] Visual rendering identical (green = typed, red = error)
- [ ] Profiler shows <2ms per decoration update at 100 WPM
- [ ] Backspace correctly removes completed decoration ranges

---

### P-08 · Comment-stripping regex mangles string literals
| Field | Value |
|-------|-------|
| **Severity** | MEDIUM |
| **Category** | Correctness |
| **Effort** | ~2 hours |
| **File** | `lib/snippets.ts:765-783` |
| **Timeline** | When LeetCode snippets contain URLs, regex literals, or strings with `//` |

**Problem:**
`stripComments` uses `//.*$/gm` to remove line comments in JS/Java/C++. This will incorrectly strip content inside string literals:

```js
// Input:
const url = "https://example.com";
const pattern = /\/\//;

// After stripComments:
const url = "https:
const pattern = /\/\
```

Similarly, the Python docstring removal `"""[\s\S]*?"""` could match across unrelated triple-quoted strings in edge cases.

**Fix options:**
1. **State machine parser:** Walk the string char-by-char, tracking whether we're inside a string (`'`, `"`, `` ` ``), regex, or comment. Only strip when in comment context.
2. **Tokenizer-based:** Use the existing `tokenize()` function to identify comment tokens, then remove only those ranges.
3. **Pragmatic:** Since this runs at build time (`build-snippets.ts`), manually verify the output and accept edge cases. Add a validation step that flags snippets where stripping removed content inside quotes.

**Acceptance criteria:**
- [ ] `stripComments('const x = "https://foo"')` → `'const x = "https://foo"'` (unchanged)
- [ ] `stripComments('x = 1 // comment')` → `'x = 1 '`
- [ ] Python docstrings still stripped correctly
- [ ] Unit tests for edge cases: URLs in strings, template literals, regex

---

### P-04 · Achievements effect race condition on rapid re-finish
| Field | Value |
|-------|-------|
| **Severity** | HIGH |
| **Category** | Data Integrity |
| **Effort** | ~2 hours |
| **File** | `hooks/useAchievements.ts:75-225` |
| **Timeline** | Now (latent) — observable with auto-advance or fast "backspace + re-finish" |

**Problem:**
The `useEffect` runs on `[phase, session, preferences]`. The `session` prop is a new object every render (destructured from engine state), making the dep array unstable. The `hasProcessedRef` guard prevents *initial* re-execution, but:

1. User finishes → effect fires, `hasProcessedRef = true`, async work begins (7 IDB reads + writes)
2. User hits backspace → `phase` changes to `"running"`, guard resets: `hasProcessedRef = false`
3. User re-finishes quickly → effect fires again while previous async work is still in flight
4. Both async operations complete → duplicate XP, duplicate streak update, duplicate achievement saves

**Fix:**
```ts
const processingRef = useRef(false);

useEffect(() => {
    if (phase !== "finished" || hasProcessedRef.current || processingRef.current) return;
    hasProcessedRef.current = true;
    processingRef.current = true;

    const abortController = new AbortController();

    process(abortController.signal).finally(() => {
        processingRef.current = false;
    });

    return () => abortController.abort();
}, [phase, ...stableDeps]);
```

Also: stabilize `session` by extracting primitive values into the dep array instead of the object.

**Acceptance criteria:**
- [ ] Rapid backspace → re-finish does not produce duplicate XP
- [ ] Achievements are not double-saved to IDB
- [ ] Streak counter increments exactly once per session
- [ ] Test: simulate fast re-finish, assert single IDB write

---

## Large Effort (3+ hours each)

### P-03 · `getSessionsAsync` loads ALL sessions into memory
| Field | Value |
|-------|-------|
| **Severity** | CRITICAL |
| **Category** | Performance / Memory |
| **Effort** | ~4 hours |
| **File** | `lib/storage/session-history.ts:112-129` |
| **Timeline** | ~3 months of active daily use |

**Problem:**
`getSessionsAsync()` calls `idbGetAll(STORES.sessions)` which loads **every session ever recorded** into memory, then sorts in-memory with `Date` parsing. Each `SessionRecord` includes `history: HistoryEntry[]` (typically ~30 entries per session).

Growth model:
- 10 sessions/day × 90 days = 900 sessions
- 900 × ~30 history entries × ~50 bytes each ≈ **1.3 MB** loaded into memory
- Called by `useAchievements` on every session finish
- Called by analytics dashboard (user may open multiple times)

At 1000+ sessions, this causes a visible UI freeze during the sort.

**Fix:**
1. Use the existing `by-date` IDB index with a cursor + limit:
```ts
const store = await tx(STORES.sessions, "readonly");
const index = store.index("by-date");
const request = index.openCursor(null, "prev"); // newest first
// Collect up to `limit` records from cursor
```

2. Add a `getRecentSessionsAsync(limit)` that only fetches what's needed.

3. For `getSessionStatsAsync`, maintain running aggregates in the `meta` store instead of recomputing from all records.

**Acceptance criteria:**
- [ ] `getSessionsAsync({ limit: 50 })` only fetches 50 records from IDB
- [ ] `getSessionStatsAsync()` does not load all sessions
- [ ] Memory usage stays constant regardless of total session count
- [ ] Analytics dashboard still shows correct aggregates
- [ ] Migration: existing users' stats remain accurate

---

### P-02 · Dual-write localStorage / IndexedDB divergence
| Field | Value |
|-------|-------|
| **Severity** | CRITICAL |
| **Category** | Data Integrity |
| **Effort** | ~6 hours |
| **File** | `lib/storage/session-history.ts:71-94` |
| **Timeline** | Any user hitting 500+ sessions (weeks of daily use) |

**Problem:**
`createSessionAsync` writes to IDB, then *always* mirrors to localStorage (line 88-91). But:

1. **Truncation divergence:** localStorage is capped at 500 records (`MAX_RECORDS`). IDB has no limit. After 500 sessions, sync reads (`getSessions`) return fewer records than async reads (`getSessionsAsync`).

2. **Failure divergence:** If IDB write succeeds but localStorage is full (`QuotaExceededError`), the catch on line 62-64 silently drops the localStorage write. Future sync reads miss the record.

3. **Stale reads:** `useAchievements` uses `getSessionsAsync` (IDB), but `getSessionStats` (sync, localStorage) is used elsewhere. They return different data.

4. **Delete divergence:** `deleteSessionAsync` deletes from both stores independently. If one fails, stores diverge permanently.

**Fix strategy:**
1. **Elect IDB as single source of truth.** Remove all localStorage mirroring from the async path.
2. **Deprecate sync API.** Replace `getSessions()`, `getSessionStats()`, etc. with their async counterparts throughout the codebase.
3. **Add a one-time migration:** On first load, import any localStorage-only records into IDB, then clear the localStorage copy.
4. **Keep localStorage only for `leaderboard.ts`** (simple, bounded, already working).

**Acceptance criteria:**
- [ ] `createSessionAsync` writes only to IDB
- [ ] All callers use async API (no sync `getSessions` outside migration)
- [ ] Migration imports localStorage records into IDB on first run
- [ ] `getSessionStatsAsync` and sync `getSessionStats` return identical results (or sync is removed)
- [ ] `MAX_RECORDS` limit removed (IDB handles scale via cursors)
- [ ] E2E test: 600 sessions → stats are accurate

---

### P-10 · No data backup/export strategy for IndexedDB
| Field | Value |
|-------|-------|
| **Severity** | MEDIUM |
| **Category** | Data Loss / UX |
| **Effort** | ~8 hours |
| **File** | `lib/storage/idb-store.ts`, `lib/export.ts` |
| **Timeline** | First user complaint after clearing browser data |

**Problem:**
IndexedDB is browser-scoped and ephemeral. It can be wiped by:
- User clearing browsing data
- Browser updates (rare but documented)
- Private/incognito mode
- Storage pressure eviction (especially on mobile Safari)

Power users who accumulate months of achievements, streaks, XP, and session history will lose everything. The `lib/export.ts` file exists but there's no UI to trigger it, and no automatic backup.

**Fix (phased):**

**Phase 1 — Manual export/import (4h):**
- Add "Export Data" / "Import Data" buttons to Preferences drawer
- Export as JSON file download (all IDB stores)
- Import validates schema, merges with existing data (dedup by ID)

**Phase 2 — Auto-backup to localStorage (2h):**
- On every session finish, write a compressed summary to localStorage:
  - Total XP, level, streak state, achievement IDs, session count
- On IDB failure/empty, offer to restore from this summary
- This doesn't preserve full history but saves progression

**Phase 3 — Cloud sync (future, separate project):**
- Optional account system with server-side storage
- Out of scope for this spec

**Acceptance criteria:**
- [ ] Export button produces a valid JSON file with all stores
- [ ] Import button restores data, shows count of imported records
- [ ] Import deduplicates by record ID (no double achievements)
- [ ] Auto-backup summary survives IDB wipe
- [ ] Restore from summary recovers XP, level, streak, achievements

---

## Dependency Graph

```
P-06 (leaderboard parse)     ─── standalone
P-12 (swallowed error)       ─── standalone
P-09 (idle callback leak)    ─── standalone
P-07 (callback identity)     ─── standalone
P-11 (pattern score cache)   ─── standalone
P-08 (comment regex)         ─── standalone

P-01 (Set cloning)           ─── blocks ──→ P-05 (decoration rebuild)
                                             (fixing P-01 changes how wrongChars
                                              is exposed, which P-05 depends on)

P-04 (achievements race)     ─── blocked by ──→ P-07 (callback identity)
                                                  (stabilizing callbacks helps
                                                   stabilize the effect deps)

P-03 (load all sessions)     ─── blocks ──→ P-02 (dual-write divergence)
                                             (cursor-based reads are needed
                                              before removing localStorage fallback)

P-02 (dual-write)            ─── blocks ──→ P-10 (backup strategy)
                                             (single source of truth needed
                                              before building export/import)
```

---

## Recommended Execution Order

| Phase | Issues | Total Effort | Goal |
|-------|--------|-------------|------|
| **1 — Quick wins** | P-06, P-12, P-09, P-07 | ~1 hour | Eliminate crash risks & stabilize callbacks |
| **2 — Performance** | P-01, P-05, P-11 | ~5 hours | Smooth typing at high WPM on long snippets |
| **3 — Correctness** | P-04, P-08 | ~4 hours | Fix race conditions & snippet corruption |
| **4 — Data layer** | P-03, P-02 | ~10 hours | Single source of truth, scalable storage |
| **5 — Resilience** | P-10 | ~8 hours | Protect user data from browser wipes |

**Total estimated effort: ~28 hours**
