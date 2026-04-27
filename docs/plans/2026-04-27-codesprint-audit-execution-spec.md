# CodeSprint Audit Execution Spec

**Date:** 2026-04-27  
**Status:** Phases 1-7 implemented in the local worktree  
**Goal:** Fix the highest-risk quality, integration, and measurement issues found in the CodeSprint audit, then prepare the codebase for next-generation practice features.

**Completion note:** Agent A completed Phases 1-3, Agent B completed Phases 4-6, and Phase 7 docs/product-truth updates were applied afterward. Live AI-provider verification still requires a configured provider API key.

## Executive Summary

CodeSprint is already more complete than the original agent guide implies: it has Monaco typing, syntax-aware scoring, session history, spaced repetition, adaptive difficulty, achievements, analytics, sharing, and optional AI drills. The next work should not be a broad redesign. It should first make the codebase trustworthy to work in, then repair the AI-drill and session-result integration gaps, then normalize scoring/analytics semantics.

The highest-priority problems are:

1. Local quality commands are polluted by `.claude/worktrees/` and dependency test files.
2. Accepted AI drills are saved but may not become the active exercise.
3. Component tests render Chakra components without a Chakra provider.
4. `ErrorBoundary` exists but does not wrap the main typing session.
5. Final result messaging and graph metrics can disagree with the actual model state.
6. Documentation overstates "no backend / no data leaves browser" now that AI drills proxy BYOK requests through `/api/generate`.

## Non-Negotiable Constraints

- Do not delete `.claude/worktrees/` unless the user explicitly asks. Fix scripts/config ignores instead.
- Do not rewrite the typing engine wholesale in this pass.
- Do not introduce a new UI framework or state library.
- Keep Monaco for now. Renderer replacement belongs in a later phase.
- Preserve Chakra UI 3 patterns. Use `Stack`/`Flex`, not removed Chakra v2 components like `VStack` unless already present and working.
- Keep feature changes narrowly tied to the audit findings.
- Run verification after each phase where feasible.

## Implementation Plan

### Phase 1: Quality Tooling Isolation

**Owner:** Agent A  
**Purpose:** Make lint, typecheck, tests, and build describe source code health instead of local artifact health.

**Files likely touched:**

- `eslint.config.mjs`
- `vitest.config.ts`
- `tsconfig.json`
- `.gitignore`
- `package.json` only if scripts need explicit globs

**Current evidence:**

- `bun run lint` currently recurses into `.claude/worktrees/` and reports thousands of generated-file errors.
- Clean lint with `.claude/**` ignored leaves one real warning in `components/analytics/AnalyticsDashboard.tsx`.
- `vitest.config.ts` uses `exclude: ["node_modules", "e2e"]`, which is not strong enough in the current environment.
- `tsconfig.json` includes `**/*.ts` and `**/*.tsx` and excludes only `node_modules` and `scripts`.

**Required changes:**

1. Add ignores for local agent/build artifacts:
   - `.claude/**`
   - `.next/**`
   - `coverage/**`
   - `playwright-report/**`
   - `test-results/**`
2. Make Vitest exclusions glob-safe:
   - `**/node_modules/**`
   - `**/.claude/**`
   - `**/.next/**`
   - `**/e2e/**`
3. Update TypeScript excludes to avoid local agent worktrees and generated output.
4. Add `.claude/` to `.gitignore`.
5. Fix the real lint warning in `components/analytics/AnalyticsDashboard.tsx` by removing the unused `_props` parameter if it is not used.

**Acceptance criteria:**

```bash
bun run lint
./node_modules/.bin/vitest run --exclude '**/.claude/**' --exclude '**/node_modules/**' --exclude '**/.next/**' --exclude '**/e2e/**'
bun run build
```

Expected:

- `bun run lint` has no source-code errors.
- Vitest no longer discovers `.claude`, `node_modules`, `.next`, or Playwright specs.
- Build still succeeds.
- If component tests still fail due to Chakra wrapping, note that as Phase 2, not Phase 1 failure.

### Phase 2: Test Harness Repair

**Owner:** Agent A  
**Purpose:** Restore reliable component tests for Chakra UI 3 components.

**Files likely touched:**

- `vitest.setup.ts`
- `components/__tests__/LiveStats.test.tsx`
- `components/__tests__/ErrorBoundary.test.tsx`
- Optional: `test-utils/render.tsx` or `lib/test-utils.tsx`

**Current evidence:**

Clean Vitest currently passes 496 tests and fails 4 tests because `LiveStats` and `ErrorBoundary` render Chakra components without `ChakraProvider`.

**Required changes:**

1. Create a reusable test render helper that wraps components in:
   - `ChakraProvider value={defaultSystem}`
   - Any minimal provider required by Chakra/Emotion in tests
2. Update affected component tests to use that helper.
3. Keep pure lib tests provider-free.

**Acceptance criteria:**

```bash
./node_modules/.bin/vitest run --exclude '**/.claude/**' --exclude '**/node_modules/**' --exclude '**/.next/**' --exclude '**/e2e/**'
```

Expected:

- All intended Vitest suites pass.
- No dependency tests or Playwright specs are collected by Vitest.

### Phase 3: Main Session Error Boundary

**Owner:** Agent A  
**Purpose:** Prevent Monaco/session runtime errors from taking down the whole app.

**Files likely touched:**

- `app/page.tsx`
- `components/ErrorBoundary.tsx`
- `components/__tests__/ErrorBoundary.test.tsx`

**Required changes:**

1. Wrap `TypingSession` with `ErrorBoundary` in `app/page.tsx`.
2. Ensure fallback UI works inside the app provider stack.
3. Consider changing `ErrorBoundary.handleReset` from hard reload to local state reset only if it can be done safely. A hard reload is acceptable for this phase.

**Acceptance criteria:**

- Component test for error fallback passes.
- `bun run build` passes.

### Phase 4: AI Drill Acceptance Integration

**Owner:** Agent B  
**Purpose:** Make accepted AI drills immediately loadable and selectable as the active typing snippet.

**Files likely touched:**

- `components/TypingSession.tsx`
- `components/AIDrillPanel.tsx`
- `hooks/useSnippets.ts`
- `hooks/useSessionControls.ts`
- `hooks/__tests__/useSessionControls.test.ts`
- Optional: `__tests__/ai/snippet-bridge.test.ts`

**Current evidence:**

- `useSnippets()` exposes `refreshAIDrills()`.
- `TypingSession` currently destructures only `{ snippets }`, then `handleDrillAccept` calls `controls.setSnippet(snippet)`.
- `useSessionControls` resolves the current snippet from `snippets`, `problemId`, and `snippetId`. If the accepted AI drill is not yet present in `snippets`, selection can fall back to another snippet.

**Required changes:**

1. Have `TypingSession` use `refreshAIDrills` from `useSnippets`.
2. On accepted drill:
   - save drill through existing `useAIDrills.acceptDrill()`
   - refresh AI drills in the snippet catalog
   - then select the accepted snippet
3. If state timing makes refresh/select racy, add a safe path in `useSessionControls` for an explicit current snippet override, but avoid duplicating snippet state unless necessary.
4. Ensure accepted AI drill language, difficulty, length category, and `problemId` semantics work with result screens and session history.

**Acceptance criteria:**

- Accepting an AI drill closes the panel and the code panel shows that generated drill.
- The next finished session records `isAIDrill` correctly.
- Reopening app later includes accepted AI drills in available snippets.
- Existing AI tests still pass.

### Phase 5: Adaptive Difficulty Transition Accuracy

**Owner:** Agent B  
**Purpose:** Display the real adaptive transition instead of inferring it from current suggested difficulty.

**Files likely touched:**

- `components/TypingSession.tsx`
- `hooks/useAdaptiveDifficulty.ts`
- `components/session/ResultScreen.tsx`
- `lib/adaptive.ts`
- `lib/__tests__/adaptive.test.ts`

**Current evidence:**

- `useAdaptiveDifficulty.updateSkillModel()` returns a `DifficultyTransition`.
- `TypingSession` ignores that return value.
- `ResultScreen` receives `difficultyTransition={adaptive.suggestedDifficulty !== controls.snippet.difficulty ? { newDifficulty: adaptive.suggestedDifficulty, reason: "promoted" } : undefined}`.

**Required changes:**

1. Store the transition returned by `adaptiveUpdateSkillModel`.
2. Pass that transition to `ResultScreen`.
3. Preserve `"promoted"`, `"demoted"`, and `"unchanged"` reason semantics.
4. Avoid showing a transition if adaptive difficulty is disabled.

**Acceptance criteria:**

- Promotion displays as promoted.
- Demotion displays as demoted or uses neutral copy like "Difficulty adjusted to easy".
- Disabled adaptive difficulty shows no transition.
- Existing adaptive tests pass or are updated to reflect the correct public behavior.

### Phase 6: Scoring and Result Consistency

**Owner:** Agent B, after Phase 5  
**Purpose:** Reduce disagreement between live metrics, history graph, result stats, and share card.

**Files likely touched:**

- `hooks/useTypingEngine.ts`
- `lib/scoring.ts`
- `components/ResultCard.tsx`
- `lib/share-card.ts`
- `lib/__tests__/scoring.test.ts`
- `hooks/__tests__/useTypingEngine.test.ts`

**Current evidence:**

- History graph uses approximate net WPM from `cursorIndex - wrongCharsSize`.
- Final metrics use strict perfect-word adjusted WPM.
- `ResultCard` derives "Raw" as `wpm / accuracy`, which is not the actual raw WPM.
- Share card bottom row labels "RAW" but receives adjusted WPM.

**Required changes:**

1. Decide and document metric semantics:
   - `rawWpm`: total keystroke speed
   - `adjustedWpm`: scoring WPM
   - `history.wpm`: either adjusted snapshot or clearly "net graph WPM"
2. Prefer passing actual `rawWpm` through `ResultScreen` into `ResultCard` and share-card data.
3. If exact adjusted history is too expensive, rename the graph concept in UI/tests so it is not presented as identical to final adjusted WPM.
4. Add tests for one error/backspace scenario where raw, adjusted, and accuracy diverge.

**Acceptance criteria:**

- Result card's Raw stat uses actual raw WPM.
- Share card's Raw stat uses actual raw WPM.
- Result graph labels do not imply a false metric.
- Typing engine tests cover raw vs adjusted divergence.

### Phase 7: Docs and Product Truth

**Owner:** Either agent after code changes  
**Purpose:** Keep README and user-facing copy honest.

**Files likely touched:**

- `README.md`
- `docs/AI_DRILLS_UI_PROMPT.md`
- `docs/plans/AI-DRILLS-SPEC.md` only if implementation details changed materially

**Required changes:**

1. Update README "No backend, no data leaves your browser" language.
2. Suggested wording:
   - "Core typing practice runs client-side. If AI drills are enabled, your browser sends the prompt context and your BYOK API key to this app's `/api/generate` route to proxy the provider request; keys are not stored server-side."
3. Update roadmap to reflect what is shipped versus pending.
4. If AI drill acceptance was fixed, mark UI integration as shipped.

**Acceptance criteria:**

- README no longer contradicts AI drill behavior.
- Build passes.

## Parallelization Strategy

Two agents can work in parallel with minimal collision if ownership is respected.

### Agent A: Tooling, Tests, Boundary

Owns:

- `eslint.config.mjs`
- `vitest.config.ts`
- `tsconfig.json`
- `.gitignore`
- `vitest.setup.ts`
- test utility files
- `app/page.tsx`
- `components/ErrorBoundary.tsx`
- component tests
- lint warning in `components/analytics/AnalyticsDashboard.tsx`

Avoid touching:

- AI drill hooks/components
- typing engine metrics
- adaptive difficulty logic

### Agent B: Product Integration and Metrics

Owns:

- `components/TypingSession.tsx`
- `components/AIDrillPanel.tsx`
- `hooks/useSnippets.ts`
- `hooks/useSessionControls.ts`
- `hooks/useAdaptiveDifficulty.ts`
- `hooks/useTypingEngine.ts`
- `components/session/ResultScreen.tsx`
- `components/ResultCard.tsx`
- `lib/share-card.ts`
- relevant hook/lib tests

Avoid touching:

- lint/test config
- global TypeScript config
- Chakra test harness
- `app/page.tsx` unless coordinating with Agent A

### Integration Rule

Agent B should wait to run full Vitest until Agent A lands test discovery fixes, but can run targeted tests by explicit file path. Agent A should avoid editing `TypingSession.tsx` beyond no-op imports unless coordinating.

## Verification Matrix

Run after all phases:

```bash
bun run lint
./node_modules/.bin/vitest run --exclude '**/.claude/**' --exclude '**/node_modules/**' --exclude '**/.next/**' --exclude '**/e2e/**'
bun run build
```

Run if AI drill flow changes:

```bash
./node_modules/.bin/vitest run __tests__/ai hooks/__tests__/useSessionControls.test.ts --exclude '**/.claude/**' --exclude '**/node_modules/**'
```

Run if typing metrics change:

```bash
./node_modules/.bin/vitest run lib/__tests__/scoring.test.ts hooks/__tests__/useTypingEngine.test.ts --exclude '**/.claude/**' --exclude '**/node_modules/**'
```

Run if browser verification is available:

```bash
bun run dev
```

Then manually verify:

1. Start a normal run.
2. Make one mistake, backspace, finish.
3. Confirm result metrics make sense.
4. Open preferences.
5. Open analytics.
6. If an API key is configured, generate and accept an AI drill.

## Suggested Next-Gen Work After Stabilization

Do not start these until Phases 1-7 are complete.

1. **Mistake replay:** after a run, generate a short local drill from exact failed spans before loading a new problem.
2. **Semantic mode:** Tree-sitter-backed scoring for AST constructs, with optional formatting tolerance.
3. **Personal curriculum:** a daily queue from spaced repetition, adaptive difficulty, and weak-pattern trends.
4. **Challenge links:** shareable seeded snippet sessions for racing the same code.
5. **Ghost replay:** show prior-best cadence for the same snippet.
6. **Renderer evolution:** purpose-built canvas/WebGL typing surface, with Monaco retained as preview/fallback.

## Paste-Ready Prompt For Another Agent

```text
You are working in /Users/connork/code/codesprint.

Read AGENTS.md/context if present, then read docs/plans/2026-04-27-codesprint-audit-execution-spec.md in full. Implement the spec task-by-task.

Important boundaries:
- Do not delete .claude/worktrees. Fix config/script ignores instead.
- Do not rewrite the typing engine wholesale.
- Keep Monaco and Chakra UI 3.
- Do not touch files outside your assigned ownership unless required and clearly explained.
- Preserve user changes and untracked files you did not create.

If working as Agent A:
- Own tooling, test harness, and ErrorBoundary integration.
- Focus on Phases 1, 2, and 3.
- Avoid AI drill hooks, adaptive difficulty, and typing metrics.

If working as Agent B:
- Own AI drill acceptance, adaptive transition accuracy, and metric/result consistency.
- Focus on Phases 4, 5, and 6.
- Avoid lint/test/TypeScript config unless Agent A has not been assigned.

Completion criteria:
1. Implement your assigned phases.
2. Add/update focused tests for changed behavior.
3. Run the relevant verification commands from the spec.
4. Final response must list files changed, tests run, any failures, and remaining handoff items.

Start by stating which agent role you are taking, then proceed without asking for confirmation unless a destructive operation or network install is required.
```
