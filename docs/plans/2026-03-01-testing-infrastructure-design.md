# Testing Infrastructure Design

## Goal

Comprehensive test coverage for CodeSprint across three layers: unit tests for pure logic, hook tests for React state machines, and E2E tests for the critical typing flow.

## Layer 1: Unit Tests (Vitest)

### New test files

| Module | Test File | Coverage |
|--------|-----------|----------|
| `lib/snippets.ts` | `lib/__tests__/snippets.test.ts` | Content sanitization, `isSkeletal` filtering, problem classification, language loading |
| `lib/token-weights.ts` | `lib/__tests__/token-weights.test.ts` | Weight lookup by category, default weights, all languages |
| `lib/analytics/aggregations.ts` | `lib/analytics/__tests__/aggregations.test.ts` | WPM trends, language stats, personal averages (the actual functions, not just Dashboard utilities) |
| `lib/storage/idb-store.ts` | `lib/storage/__tests__/idb-store.test.ts` | Store init, CRUD, typed object stores (mock with `fake-indexeddb`) |
| `lib/storage/migration.ts` | `lib/storage/__tests__/migration.test.ts` | localStorage -> IndexedDB migration, schema versioning |
| `lib/preferences-core.ts` | `lib/__tests__/preferences-core.test.ts` | Theme generation, migration, preference defaults |

### Existing tests (no changes needed)

- `lib/__tests__/tokenizer.test.ts`
- `lib/__tests__/scoring.test.ts`
- `lib/__tests__/pattern-analysis.test.ts`
- `lib/__tests__/export.test.ts`
- `lib/storage/__tests__/session-history.test.ts`
- `components/analytics/__tests__/AnalyticsDashboard.test.tsx`

## Layer 2: Hook Tests (Vitest + renderHook)

| Hook | Test File | Coverage |
|------|-----------|----------|
| `useTypingEngine` | `hooks/__tests__/useTypingEngine.test.ts` | Phase transitions (idle -> countdown -> running -> finished), keystroke handling (correct/wrong), WPM/accuracy calculation, error logging, history tracking |
| `useSnippets` | `hooks/__tests__/useSnippets.test.ts` | Snippet loading, language filtering, progressive loading, problem selection |
| `useSessionLifecycle` | `hooks/__tests__/useSessionLifecycle.test.ts` | Auto-advance, score persistence |
| `useSessionControls` | `hooks/__tests__/useSessionControls.test.ts` | Problem/snippet selection state |

### Mocking strategy

- Monaco editor: mock `@monaco-editor/react` to expose a thin wrapper that captures `onDidChangeModelContent` callbacks
- Preferences context: mock `usePreferences` to return configurable defaults
- Storage: mock localStorage/IndexedDB as in existing tests

### Hooks NOT unit tested (covered by E2E)

- `useFocusManagement` — DOM-heavy, better as E2E
- `useAutoScroll` — scroll behavior, better as E2E
- `useKeyboardShortcuts` — keyboard event hierarchy, better as E2E

## Layer 3: E2E (Playwright)

### Infrastructure

- Install `@playwright/test`
- `playwright.config.ts` at project root with `webServer` pointing to `next dev`
- `e2e/` directory for test files
- Single Chromium browser (Monaco requires real browser)

### Test: Full Typing Session (`e2e/typing-session.spec.ts`)

1. Navigate to app (`/`)
2. Wait for Monaco editor to load (wait for `.monaco-editor` selector)
3. Verify a snippet is displayed
4. Click editor to focus
5. Wait for countdown to complete
6. Type characters matching the snippet content (`page.keyboard.type()`)
7. Verify real-time stats update (WPM > 0, progress advancing)
8. Complete the snippet (type all characters)
9. Verify result screen shows WPM, accuracy, and completion state

## Out of Scope

- Component render tests for simple display components (LiveStats, ResultGraph, ThemeIndicator)
- Config/style modules (`motion.ts`, `motion-config.ts`, `session-styles.ts`)
- `leaderboard.ts`, `shortcuts.ts` (minimal logic)

## Dependencies to Install

- `fake-indexeddb` — for idb-store unit tests
- `@playwright/test` — for E2E tests
