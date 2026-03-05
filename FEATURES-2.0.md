# CodeSprint 2.0 Feature Specification

## Vision

Transform CodeSprint from a typing practice tool into a structured learning platform with progression, competition, and virality. The 1.0 foundation (Monaco editor, 4 languages, 18 themes, vim mode, analytics, session history) becomes the base for a system that knows *what* you're typing, *where* you struggle, and *what to practice next*.

---

## Tier 1: Core 2.0 (Must-Have for Launch)

---

### Feature 1: Syntax-Aware Scoring Engine

**What it is.**
Replace character-level perfect-word scoring with a scoring system that understands code structure. Instead of treating `const` as five independent characters, the engine recognizes it as a keyword token. Instead of counting every whitespace character equally, it understands that indentation blocks, bracket pairs, and semicolons have different significance for muscle memory.

The system produces three score dimensions:
- **Raw WPM**: All keystrokes (unchanged)
- **Net WPM**: Correct characters via perfect-word algorithm (unchanged)
- **Pattern Score**: A new metric that weights syntactically important tokens higher than boilerplate

After each session, the system identifies the user's weakest token categories (e.g., "you consistently mis-type arrow functions but nail for-loops").

**Why it matters.**
This is the single biggest differentiator from every typing site. Monkeytype, keybr, and typing.io all score character-by-character. No existing tool tells you "you struggle with arrow functions." The Pattern Score makes CodeSprint the only typing tool that understands *what* you are typing, not just *that* you are typing.

**Technical approach.**
- Add a build-time tokenization step to `scripts/build-snippets.ts` using a lightweight regex-based tokenizer per language. Each snippet gets an array of tokens stored alongside its content:
  ```typescript
  type Token = {
      start: number;    // Character index in snippet content
      end: number;      // End index (exclusive)
      type: string;     // "keyword" | "operator" | "delimiter" | "identifier" | "literal" | "whitespace"
      weight: number;   // Scoring weight: keywords 1.5x, operators 1.5x, delimiters 1.2x, identifiers 1.0x, whitespace 0.5x
  };
  ```
- Extend the `Snippet` type in `lib/snippets.ts` to include an optional `tokens: Token[]` field. Backward-compatible -- snippets without tokens fall back to character scoring.
- Modify `calculateAndPublishMetrics` in `hooks/useTypingEngine.ts` (line 515) to compute the Pattern Score by iterating over tokens the cursor has passed, checking if each token was typed with zero errors.
- Add a new `PatternAnalysis` type that identifies the user's weakest token categories. Surface this in the result screen.
- Token weights are configurable per language in a new `lib/token-weights.ts` file.

**Token categories per language:**

| Category | JavaScript | Python | Java | C++ |
|----------|-----------|--------|------|-----|
| Keywords | `const`, `let`, `function`, `return`, `if`, `else`, `for`, `while`, `class`, `new`, `import`, `export`, `async`, `await` | `def`, `class`, `return`, `if`, `else`, `for`, `while`, `import`, `from`, `with`, `as`, `yield`, `lambda` | `public`, `private`, `static`, `final`, `class`, `void`, `return`, `if`, `else`, `for`, `while`, `new`, `import` | `#include`, `template`, `typename`, `const`, `auto`, `return`, `if`, `else`, `for`, `while`, `class`, `struct`, `new` |
| Operators | `=>`, `===`, `!==`, `&&`, `\|\|`, `??`, `?.`, `...` | `==`, `!=`, `and`, `or`, `not`, `in`, `is`, `**` | `==`, `!=`, `&&`, `\|\|`, `instanceof` | `::`, `->`, `<<`, `>>`, `&&`, `\|\|` |
| Delimiters | `{}`, `()`, `[]`, `;`, `,`, `:` | `()`, `[]`, `{}`, `:`, `,` | `{}`, `()`, `[]`, `;`, `,` | `{}`, `()`, `[]`, `;`, `,`, `<>` |

**Complexity:** M (2-3 weeks)
**Dependencies:** None -- builds on existing pipeline
**Critical files:** `scripts/build-snippets.ts`, `lib/snippets.ts`, `hooks/useTypingEngine.ts`, `lib/scoring.ts`

---

### Feature 2: Spaced Repetition with Weak-Pattern Targeting

**What it is.**
An SM-2 (SuperMemo 2) algorithm that tracks mastery at two levels:
1. **Per-snippet**: Have you typed this problem well?
2. **Per-pattern**: Are you good at arrow functions, destructuring, list comprehensions?

When a user finishes a session, the system updates mastery scores and queues snippets for review. The "Next" button becomes a smart recommendation rather than a sequential cycle. A new "Review Queue" section shows snippets due for practice with their mastery levels.

**Why it matters.**
Random practice is dramatically less effective than targeted repetition. This transforms CodeSprint from "I typed some code" to "I am systematically building muscle memory for Python decorators because the system detected I am weak there." Spaced repetition is proven (Anki, Duolingo) but no coding typing tool implements it.

**Technical approach.**
- New module: `lib/spaced-repetition.ts`
  ```typescript
  type MasteryRecord = {
      snippetId: string;
      patterns: string[];          // Token types this snippet exercises
      easeFactor: number;          // 2.5 default, adjusted by quality
      interval: number;            // Days until next review
      repetitions: number;         // Consecutive successful reviews
      nextReviewDate: string;      // ISO date
      lastQuality: number;         // 0-5 SM-2 quality rating
      lastReviewDate: string;      // ISO date
  };
  ```

- **Quality rating** (0-5) derived from performance:
  - 5: >98% accuracy AND >90% pattern score
  - 4: >95% accuracy AND >80% pattern score
  - 3: >90% accuracy (passed)
  - 2: >80% accuracy (barely passed)
  - 1: >70% accuracy (failed)
  - 0: <70% accuracy (complete fail)

- **SM-2 algorithm:**
  ```
  if quality >= 3:
      if repetitions == 0: interval = 1
      elif repetitions == 1: interval = 6
      else: interval = round(interval * easeFactor)
      repetitions += 1
  else:
      repetitions = 0
      interval = 1

  easeFactor = max(1.3, easeFactor + 0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02))
  nextReviewDate = today + interval days
  ```

- Storage: new localStorage key `codesprint-mastery` with `Map<snippetId, MasteryRecord>`. Max 2000 records with LRU eviction.

- **Pattern-level aggregation:** `lib/pattern-mastery.ts` aggregates mastery records by token type across all snippets. This powers the "Weak Patterns" insight card.

- **Integration with useSessionControls:** Add `recommendationMode: "sequential" | "spaced-repetition"` toggle. When in SR mode, `handleNextProblem` picks the snippet with the most overdue review date matching current language/length filters.

- **UI additions:**
  - Mastery indicator (colored ring) next to each problem in the selector: green = mastered, yellow = learning, red = due for review, gray = new
  - "Review Queue" badge showing count of due items
  - After session: "Mastery updated" toast showing the quality rating and next review date

**Complexity:** M (2-3 weeks)
**Dependencies:** Feature 1 for pattern-level granularity (works without it at snippet-level only)
**Critical files:** `hooks/useSessionControls.ts`, `hooks/useSessionLifecycle.ts`, `components/session/SessionControlBar.tsx`

---

### Feature 3: Achievement & Streak System

**What it is.**
A gamification layer with three components:

1. **Achievements** -- Unlockable badges for milestones
2. **Daily streaks** -- Visual streak counter with freeze protection
3. **XP and levels** -- Every session earns XP, accumulating into levels that unlock cosmetic rewards

**Why it matters.**
Gamification is the single strongest retention lever for a free tool. Duolingo's entire business model is built on streaks. The achievement popup after hitting 100 WPM for the first time creates a dopamine hit that makes users come back. Combined with spaced repetition, this creates a daily practice habit.

**Achievement definitions (40 total):**

| Category | Name | Condition | Rarity |
|----------|------|-----------|--------|
| Speed | First Steps | Complete first session | Common |
| Speed | Quick Fingers | Reach 60 WPM | Common |
| Speed | Speed Demon | Reach 100 WPM | Rare |
| Speed | Lightning | Reach 120 WPM | Epic |
| Speed | Supersonic | Reach 150 WPM | Legendary |
| Speed | Burst Master | 180+ burst WPM in any 1-second window | Epic |
| Accuracy | Sharpshooter | 95% accuracy in a session | Common |
| Accuracy | Perfectionist | 100% accuracy (zero errors) in any session | Rare |
| Accuracy | Perfect Ten | 10 consecutive sessions with >95% accuracy | Epic |
| Accuracy | Untouchable | 100% accuracy on a Hard snippet | Legendary |
| Consistency | Daily Driver | 7-day streak | Common |
| Consistency | Two Weeks | 14-day streak | Rare |
| Consistency | Monthly | 30-day streak | Epic |
| Consistency | Century | 100-day streak | Legendary |
| Consistency | Early Bird | Session before 7 AM local time | Common |
| Consistency | Night Owl | Session after midnight | Common |
| Consistency | Weekend Warrior | Sessions on both Saturday and Sunday | Common |
| Exploration | Polyglot | Complete sessions in all 4 languages | Common |
| Exploration | Deep Dive | Complete 10 sessions in a single language | Common |
| Exploration | Theme Explorer | Try 5 different themes | Common |
| Exploration | Vim Master | Complete 10 sessions in Vim mode | Rare |
| Exploration | Hard Mode | Complete a Hard difficulty snippet | Common |
| Exploration | Marathon | Complete a Long snippet | Common |
| Exploration | Sprint | Complete a Short snippet in under 15 seconds | Rare |
| Milestone | Ten Down | Complete 10 total sessions | Common |
| Milestone | Fifty Club | Complete 50 total sessions | Rare |
| Milestone | Centurion | Complete 100 total sessions | Epic |
| Milestone | Five Hundred | Complete 500 total sessions | Legendary |
| Milestone | Level 10 | Reach level 10 | Rare |
| Milestone | Level 25 | Reach level 25 | Epic |
| Improvement | Getting Better | Improve average WPM by 10 over last 20 sessions | Common |
| Improvement | Comeback | Beat your previous best WPM on a snippet you scored poorly on | Rare |
| Improvement | Mastery | Master (SM-2 interval > 30 days) any snippet | Epic |
| Improvement | Full Mastery | Master all snippets in one language | Legendary |
| Challenge | No Backspace | Complete a session with zero backspace presses | Epic |
| Challenge | Speed Run | Complete any medium snippet in under 60 seconds | Rare |
| Challenge | Endurance | Type for 10 continuous minutes | Rare |
| Challenge | Double Up | Complete 2 sessions in under 5 minutes total | Rare |
| Special | First Blood | Your first error ever (consolation badge) | Common |
| Special | Zen Mode | Complete 5 sessions with live stats hidden | Rare |

**XP formula:**
```
sessionXP = base(10)
  + wpmBonus(wpm * 0.5)
  + accuracyBonus(accuracy > 0.95 ? 20 : 0)
  * difficultyMultiplier(easy: 1, medium: 1.5, hard: 2)
  * lengthMultiplier(short: 1, medium: 1.3, long: 1.6)
```

**Level curve:** Level N requires `N * 100 * 1.2^(N-1)` cumulative XP.

| Level | Total XP Required |
|-------|------------------|
| 1 | 100 |
| 2 | 340 |
| 3 | 772 |
| 5 | 2,486 |
| 10 | 25,961 |
| 25 | 5,339,893 |

**Streak mechanics:**
- A "day" is defined in user's local timezone
- Streak increments when user completes at least one session
- Streak resets after missing a full calendar day
- No streak freeze in v1 (keep it simple)
- Store: `{ currentStreak: number, longestStreak: number, lastActiveDate: string, streakStartDate: string }`

**Technical approach:**
- `lib/achievements.ts`: 40 achievements as a declarative array with pure predicate functions
- `lib/streaks.ts`: Streak tracking with timezone-aware day boundaries
- `lib/xp.ts`: XP calculation and level curve
- `hooks/useAchievements.ts`: Called from `useSessionLifecycle` on session finish. Checks all unearned achievements. Returns newly unlocked ones for toast/modal.
- UI: Achievement toast (Framer Motion slide-in), streak flame icon in header, level badge, achievement gallery in preferences drawer

**Complexity:** M (2-3 weeks)
**Dependencies:** Session history (exists). Feature 1 unlocks pattern-based achievements.
**Critical files:** `hooks/useSessionLifecycle.ts`, `components/AppShell.tsx`, `components/ResultCard.tsx`

---

### Feature 4: Custom Snippet Library

**What it is.**
Users can paste their own code snippets to practice. Snippets are stored locally and appear alongside curated/LeetCode snippets with a "Custom" badge. Users can:
- Paste raw code with a title
- Import from a GitHub Gist URL
- Export and import collections as JSON for sharing
- Auto-detect language from content

**Why it matters.**
The curated LeetCode set covers algorithms, but developers also need to practice their own patterns -- React hooks, Django views, Terraform configs, SQL queries, Go goroutines. This makes CodeSprint useful for *any* codebase, not just interview prep. It also opens the door to community snippet sharing without needing a backend.

**Technical approach:**
- New module: `lib/custom-snippets.ts`
  ```typescript
  type CustomSnippet = Snippet & {
      source: "user" | "import";
      createdAt: string;
      tags: string[];
  };
  ```
- CRUD operations backed by `codesprint-custom-snippets` localStorage key. Max 100 custom snippets.

- **Language auto-detection heuristics:**
  ```
  Python:  def/class/import from/self./elif → python
  JS/TS:  const/let/=>/function/require/import from → javascript
  Java:   public class/private/System.out/void main → java
  C++:    #include/std::/template/cout/nullptr → cpp
  ```
  Falls back to user selection if confidence is low.

- **Validation rules:**
  - Reject empty content
  - Reject content < 2 lines
  - Reject content > 500 lines
  - Run through existing `normalizeContent` pipeline
  - Generate tokens at creation time (runtime tokenization for custom snippets)

- **GitHub Gist import:**
  - Parse Gist URL → extract Gist ID
  - Fetch via GitHub API (unauthenticated, 60 req/hour)
  - Extract file content, detect language from file extension
  - Preview before import

- **Export/Import:**
  - Export: serialize all custom snippets to JSON blob, downloadable
  - Import: validate, deduplicate by content hash (first 200 chars + length), merge

- **Integration with useSnippets:**
  - Custom snippets merged into the snippet pool with `difficulty: "custom"`
  - Appear in a "Custom" problem group
  - Filterable alongside curated/LeetCode snippets

- **UI:**
  - "+" button in SessionControlBar (visible when not in running phase)
  - Modal with: textarea, title input, language selector (with auto-detect), optional tags
  - Preview panel showing how snippet will render in the editor
  - "My Snippets" section in preferences drawer with edit/delete
  - Import/Export buttons

**Complexity:** M (2-3 weeks)
**Dependencies:** None
**Critical files:** `hooks/useSnippets.ts`, `components/session/SessionControlBar.tsx`, `lib/snippets.ts`

---

### Feature 5: Storage Upgrade & Data Export

**What it is.**
Three improvements to the data layer:
1. **IndexedDB migration**: Move from localStorage to IndexedDB for larger storage capacity
2. **Data export/import**: Download sessions as JSON/CSV, import from file
3. **Schema migration system**: Versioned migrations to handle data changes across app updates

**Why it matters.**
localStorage has a 5-10 MB limit (browser-dependent). With 500 session records each containing a full `history` array (WPM datapoints every second), users who practice daily will hit the limit within months. IndexedDB removes this constraint (hundreds of MB to GB). Data export addresses the "I changed browsers and lost everything" problem without requiring a backend. The migration system prevents data loss on upgrades.

**Technical approach:**

- **IndexedDB store** (`lib/storage/idb-store.ts`):
  ```typescript
  // Using raw IndexedDB API (no dependency needed)
  const DB_NAME = "codesprint";
  const DB_VERSION = 1;

  // Object stores:
  // - "sessions" (keyPath: "id", indexes: ["date", "language", "snippetId"])
  // - "mastery" (keyPath: "snippetId")
  // - "achievements" (keyPath: "id")
  // - "custom-snippets" (keyPath: "id")
  // - "meta" (keyPath: "key") -- for version, streak data, preferences
  ```

- **Migration system** (`lib/storage/migration.ts`):
  ```typescript
  type Migration = {
      version: number;
      name: string;
      up: () => Promise<void>;
  };

  // Version 1: Current localStorage format
  // Version 2: Migrate session-history from localStorage to IndexedDB
  // Version 3: Migrate mastery records to IndexedDB
  // etc.
  ```
  - Checks a version number in `meta` store
  - Runs migration functions in sequence
  - Rolls back on failure (where possible)

- **Export module** (`lib/export.ts`):
  - `exportToJSON()`: Full dump of all data (sessions, preferences, mastery, achievements, custom snippets)
  - `exportToCSV()`: Sessions only, one row per session, columns for all `SessionRecord` fields (excluding `history` array)
  - `importFromJSON(file: File)`: Validate schema, merge with existing data (newer records win on conflict)

- **Integration:**
  - Replace `readStorage`/`writeStorage` in `session-history.ts` with async wrappers
  - Add synchronous localStorage fallback for SSR safety (Next.js)
  - Preferences remain in localStorage (small, needs synchronous access for theme initialization)
  - Progressive migration: on first load after upgrade, migrate existing localStorage data to IndexedDB

- **UI:**
  - "Export Data" and "Import Data" buttons in preferences drawer
  - Export format selector (JSON or CSV)
  - Import file picker with validation summary ("Found 234 sessions, 12 achievements. Import?")
  - Storage usage indicator ("Using 2.3 MB of local storage")

**Complexity:** S-M (1-2 weeks)
**Dependencies:** None -- foundational, should be built first
**Critical files:** `lib/storage/session-history.ts`, `lib/preferences-core.ts`

---

## Tier 2: Differentiation (Makes It Special)

---

### Feature 6: Interview Prep Mode

**What it is.**
A structured practice mode that simulates real coding interview conditions. The user selects a prep plan, and the app presents problems in sequence with configurable time limits.

**Components:**
- **Prep plans**: Blind 75, NeetCode 150, Google Top Questions, Quick Warmup (10 easy), Hard Mode Sprint
- **Time pressure**: Configurable per-problem timer (default 20 minutes, adjustable 5/10/15/20/30/none)
- **Progress tracker**: Shows completion across the plan with scores per problem
- **LeetCode links**: After each problem, link to the actual LeetCode problem page
- **Interview readiness score**: Aggregate metric based on average WPM + accuracy across the plan

**Why it matters.**
This is the highest-intent use case. Someone preparing for a Google interview would pay for this. No typing site connects typing practice to specific interview question sets. The time pressure element trains the real skill: typing code fast under pressure.

**Technical approach:**
- New module: `lib/interview-prep.ts`
  ```typescript
  type InterviewPlan = {
      id: string;
      name: string;
      description: string;
      category: "comprehensive" | "warmup" | "challenge";
      snippetIds: string[];        // Ordered list
      defaultTimeLimitMs: number;
      estimatedDurationMin: number;
  };

  type InterviewProgress = {
      planId: string;
      completed: Map<string, {
          wpm: number;
          accuracy: number;
          timeMs: number;
          completionPercent: number;  // For timed-out sessions
          date: string;
      }>;
      startedAt: string;
      lastSessionAt: string;
  };
  ```

- **Plan curation:**
  - Map Blind 75 problem slugs to snippet IDs via `sourceSlug` field
  - Create a JSON manifest: `data/interview-plans.json`
  - Each plan entry: `{ name, description, problemSlugs: string[] }`

- **Timer integration:**
  - Add optional `timeLimitMs` to `useTypingEngine` props
  - When timer expires, trigger `onFinish` even if snippet incomplete
  - Result screen shows "Completed X% in time limit" for timed-out sessions
  - Visual timer bar at the top (changes color: green -> yellow -> red)

- **LeetCode integration:**
  - `Snippet.sourceSlug` already exists, construct URL: `https://leetcode.com/problems/${sourceSlug}/`
  - "View on LeetCode" button in result screen
  - "View Solution" expandable section

- **Interview readiness formula:**
  ```
  readiness = (avgWpm / 80) * 0.4 + (avgAccuracy / 1.0) * 0.3 + (completionRate) * 0.3
  ```
  Scale: 0-100. Displayed as a gauge/meter.

- **UI:**
  - "Interview Prep" toggle/tab in SessionControlBar
  - Plan selector dropdown with descriptions
  - Plan progress view: grid of problems with green/yellow/red/gray status
  - Timer overlay (optional, configurable)
  - Readiness score dashboard

**Complexity:** M (2-3 weeks)
**Dependencies:** LeetCode snippet data with `sourceSlug` (exists)
**Critical files:** `hooks/useSessionControls.ts`, `hooks/useTypingEngine.ts`, `components/session/SessionControlBar.tsx`

---

### Feature 7: Error Analytics & Heatmaps

**What it is.**
A deep-dive error analysis system with four visualization layers:

1. **Character-level heatmap**: The snippet text with colored backgrounds showing where errors occurred (intensity = error frequency)
2. **Confusion pairs table**: "You typed `{` when `(` was expected 12 times" -- the most common character mix-ups
3. **Keyboard heatmap**: An SVG keyboard rendering showing which physical keys cause the most errors
4. **Pattern weakness report**: "You struggle with Python list comprehension syntax -- 73% accuracy on `[x for x in ...]` patterns vs 95% overall"

**Why it matters.**
"89% accuracy" is not actionable. "You confuse `{` and `[` 12 times per session" is. This is the coach that makes practice deliberate rather than random. The character confusion matrix is especially valuable -- knowing your specific mix-ups lets you focus on exactly what needs work.

**Technical approach:**
- The `errorLog` already exists as `ErrorEntry[]` with `{ expected, got, index }` -- all the raw data is captured.

- New module: `lib/error-analysis.ts`
  ```typescript
  type ConfusionPair = {
      expected: string;
      got: string;
      count: number;
      percentage: number;  // Of total errors
  };

  type ErrorCluster = {
      startIndex: number;
      endIndex: number;
      density: number;      // Errors per character in this region
      snippetSubstring: string;
  };

  type KeyboardHeatmapData = Record<string, {
      errorCount: number;
      totalPresses: number;
      errorRate: number;
  }>;

  type PatternWeakness = {
      pattern: string;       // Token type or syntax pattern
      accuracy: number;      // Accuracy within this pattern
      examples: string[];    // Snippet substrings showing the pattern
      overallAccuracy: number;
  };

  function analyzeErrors(
      errorLog: ErrorEntry[],
      content: string,
      tokens?: Token[]
  ): {
      confusionPairs: ConfusionPair[];
      errorClusters: ErrorCluster[];
      keyboardHeatmap: KeyboardHeatmapData;
      patternWeaknesses: PatternWeakness[];
  };
  ```

- **Confusion pairs**: Aggregate `errorLog` by `(expected, got)` tuples, sorted by frequency. Show top 8.

- **Error clusters**: Sliding window (10 chars) over snippet content, compute error density. Highlight regions with >2x average density as "trouble spots."

- **Keyboard heatmap**: Map each `got` character to a physical key position (US QWERTY layout). Render as SVG keyboard with opacity/color scaled by error count. Color scale: transparent (0 errors) -> yellow (few) -> red (many).

- **Pattern weaknesses**: If tokens are available (Feature 1), group errors by the token type they occurred within. Compare per-token accuracy to overall accuracy. Flag tokens with accuracy >10% below overall.

- **Persistence**: Aggregate error data across sessions in `codesprint-error-aggregate` localStorage key. Structure: `Map<confusionPairKey, { count: number, lastSeen: string }>`. This enables long-term weakness tracking beyond a single session.

- **UI**: Expand `ResultCard` with a tabbed interface:
  - Tab 1: "Summary" (current result view)
  - Tab 2: "Error Analysis" (heatmap + confusion pairs + keyboard)
  - Tab 3: "History" (existing WPM graph)

**Complexity:** M (2-3 weeks)
**Dependencies:** Feature 1 (tokenization) for pattern-level analysis. Works without it at character level.
**Critical files:** `components/ResultCard.tsx`, `components/ResultGraph.tsx`

---

### Feature 8: Adaptive Difficulty System

**What it is.**
The app dynamically adjusts which snippets it suggests based on the user's current skill level per language. If a user is consistently typing Python at 80 WPM with 95% accuracy on "medium" difficulty, the system starts suggesting "hard" snippets. If they struggle, it backs off.

**Why it matters.**
This solves the "what should I practice next?" problem automatically. Users don't need to manually select difficulty -- the system keeps them in their zone of proximal development (challenging enough to learn, not so hard they give up). This is how Duolingo, chess ratings, and adaptive learning platforms work.

**Technical approach:**
- New module: `lib/adaptive.ts`
  ```typescript
  type SkillModel = {
      language: SupportedLanguage;
      estimatedWpm: number;          // Exponential moving average
      estimatedAccuracy: number;     // Exponential moving average
      currentDifficulty: Difficulty;
      confidenceLevel: number;       // 0-1, increases with more sessions
      sessionHistory: Array<{
          wpm: number;
          accuracy: number;
          difficulty: Difficulty;
          date: string;
      }>;  // Last 20 sessions for this language
  };
  ```

- **Exponential moving average** with alpha = 0.3:
  ```
  newEstimate = alpha * latestValue + (1 - alpha) * previousEstimate
  ```

- **Promotion rules** (advance to harder difficulty):
  - Accuracy > 92% AND WPM > estimated * 0.9
  - For 3 consecutive sessions at current difficulty
  - Confidence level > 0.5 (at least 5 sessions total)

- **Demotion rules** (retreat to easier difficulty):
  - Accuracy < 78% OR WPM < estimated * 0.7
  - For 2 consecutive sessions at current difficulty

- **Integration:**
  - `useSessionControls` gains an `adaptiveMode: boolean` toggle
  - When adaptive mode is on, the difficulty filter auto-adjusts after each session
  - UI shows the recommended difficulty with reasoning: "Hard recommended: your medium accuracy is 96% over last 3 sessions"
  - User can always override manually

- Storage: `codesprint-skill-model` in localStorage/IndexedDB, one `SkillModel` per language

- The algorithm is deliberately simple and transparent. Users can see their skill model and understand why recommendations are made.

**Complexity:** S (1-2 weeks)
**Dependencies:** Session history (exists)
**Critical files:** `hooks/useSessionControls.ts`, `hooks/useSessionLifecycle.ts`

---

### Feature 9: Shareable Result Cards

**What it is.**
After completing a session, users can generate a shareable image card. The card includes: WPM, accuracy, time, snippet title, difficulty, language, theme colors, and a miniature WPM sparkline. Downloadable as PNG with a "codesprint.dev" watermark. Also supports text-based summary for Discord/Slack.

**Why it matters.**
This is the viral growth mechanism. When a user posts "Just hit 120 WPM on a Hard LeetCode problem" to Twitter/LinkedIn/Discord with a beautiful branded card, it's free marketing. Monkeytype has this feature and it drives significant organic discovery. CodeSprint's version is differentiated by showing code-specific metrics and the actual problem name.

**Technical approach:**
- New module: `lib/share-card.ts`
  ```typescript
  type ShareCardData = {
      wpm: number;
      accuracy: number;
      timeMs: number;
      snippetTitle: string;
      language: SupportedLanguage;
      difficulty: Difficulty;
      percentile: number;
      sparklineData: number[];     // WPM values for miniature graph
      theme: ThemePreset;
      level?: number;
      streak?: number;
  };

  function generateCardCanvas(data: ShareCardData): Promise<HTMLCanvasElement>;
  function generateTextSummary(data: ShareCardData): string;
  ```

- **Card rendering:**
  - Render an off-screen React component styled with current theme colors
  - Capture to canvas using `html-to-image` library (or manual Canvas API drawing for more control)
  - Card dimensions: 1200x630 (OpenGraph standard for social previews)
  - Layout: Large WPM number, percentile, accuracy, snippet title, language badge, difficulty badge, mini sparkline, "codesprint.dev" watermark

- **Text summary:**
  ```
  CodeSprint | Two Sum (Python, Hard) | 118 WPM | 97.2% accuracy | 42.3s
  Try it: codesprint.dev
  ```
  Copyable to clipboard with one click.

- **Web Share API:**
  - On mobile/supported browsers: use `navigator.share()` with the generated image
  - Fallback: "Copy to clipboard" and "Download PNG" buttons

- **Integration:**
  - Add "Share" and "Download" buttons to `ResultCard.tsx`
  - Share button opens a preview modal showing the card before sharing
  - Download triggers browser file download

**Complexity:** S (1-2 weeks)
**Dependencies:** None
**Critical files:** `components/ResultCard.tsx`

---

## Tier 3: Growth (Drives Adoption & Retention)

---

### Feature 10: Multiplayer Race Mode

**What it is.**
Real-time competitive typing races between 2-8 players. Players join a room (by link or matchmaking), agree on a snippet, and race to type it first. Each player sees a progress bar for all participants updating in real-time. Results show a leaderboard ranked by adjusted WPM. Optional "ranked mode" with an Elo-like rating system.

**Why it matters.**
Competition is the most powerful engagement driver. TypeRacer proved that typing races are intrinsically fun. A coding-specific race mode is novel and creates social engagement that single-player practice cannot. It also gives users a reason to share the app with friends ("race me on this LeetCode problem").

**Technical approach:**
- **Server**: PartyKit (serverless WebSocket platform on Cloudflare). Zero infrastructure management, generous free tier, global edge deployment.

- **Room lifecycle:**
  ```
  Create Room → Share Link → Players Join → Host Selects Snippet →
  Countdown (3-2-1) → Race → First Finish / All Finish → Results
  ```

- **Server module** (`party/race.ts`):
  ```typescript
  type RaceRoom = {
      id: string;
      snippet: { id: string; content: string; language: SupportedLanguage };
      players: Map<string, PlayerState>;
      phase: "waiting" | "countdown" | "racing" | "finished";
      startTime: number | null;
      maxPlayers: 8;
  };

  type PlayerState = {
      id: string;
      name: string;
      cursorIndex: number;
      wpm: number;
      accuracy: number;
      progress: number;      // 0-1 percentage
      finishedAt: number | null;
      rank: number | null;
  };

  // Messages:
  // Client → Server: { type: "progress", cursorIndex, wpm, accuracy }
  // Server → Client: { type: "state", players: PlayerState[] }
  // Server → Client: { type: "countdown", value: 3|2|1|0 }
  // Server → Client: { type: "finish", rankings: PlayerState[] }
  ```

- **Client hook** (`hooks/useMultiplayerRace.ts`):
  - Manages WebSocket connection to PartyKit
  - Sends cursor position updates throttled to 10/second
  - Receives and merges other players' state
  - Handles disconnection/reconnection gracefully

- **Anti-cheat:**
  - Server validates cursor progress is monotonically increasing
  - Max WPM cap: 250 (world record for prose is ~220, code is slower)
  - No jumps > 10 characters per update (100ms window)
  - Server is source of truth for timing and rankings

- **UI:**
  - New route `/race` (or modal from main page)
  - Room creation: "Create Race" button generates a shareable link
  - Lobby: player list with ready indicators, snippet preview, host controls
  - During race: horizontal progress bars for each player above the editor, ghost cursor positions
  - Post-race: leaderboard with WPM/accuracy/time for each player, rematch button

- **Matchmaking (v2):**
  - Queue system: players indicate language preference and difficulty
  - Match players within similar skill ranges (based on recent average WPM)
  - Auto-start when enough players (2+) are queued

**Complexity:** XL (5-6 weeks)
**Dependencies:** Deployment platform with WebSocket support (PartyKit/Cloudflare)
**Critical files:** New files; extends `hooks/useTypingEngine.ts` for progress reporting

---

### Feature 11: Cloud Sync & Authentication

**What it is.**
Optional user accounts (GitHub or Google OAuth) with bidirectional cloud sync of all data: session history, preferences, achievements, mastery records, custom snippets. Users without accounts continue using localStorage with zero degradation.

**Why it matters.**
Removes the biggest limitation of the current architecture. Users who practice across devices need their data to follow them. Cloud sync also enables global leaderboards and eventually community features.

**Technical approach:**
- **Backend**: Supabase (Postgres + Auth + Realtime + Edge Functions)
  - GitHub and Google OAuth out of the box
  - Row-level security policies
  - Generous free tier (50K monthly active users)

- **Schema:**
  ```sql
  -- Users (managed by Supabase Auth)
  profiles (
      id UUID PRIMARY KEY REFERENCES auth.users,
      display_name TEXT,
      avatar_url TEXT,
      created_at TIMESTAMPTZ
  )

  -- Session history
  sessions (
      id UUID PRIMARY KEY,
      user_id UUID REFERENCES profiles,
      snippet_id TEXT,
      language TEXT,
      difficulty TEXT,
      length_category TEXT,
      wpm REAL,
      raw_wpm REAL,
      accuracy REAL,
      elapsed_ms INTEGER,
      total_keystrokes INTEGER,
      correct_keystrokes INTEGER,
      error_count INTEGER,
      history JSONB,
      created_at TIMESTAMPTZ
  )

  -- Preferences (JSONB blob for flexibility)
  preferences (
      user_id UUID PRIMARY KEY REFERENCES profiles,
      data JSONB,
      updated_at TIMESTAMPTZ
  )

  -- Mastery records
  mastery (
      user_id UUID,
      snippet_id TEXT,
      ease_factor REAL,
      interval INTEGER,
      repetitions INTEGER,
      next_review_date DATE,
      last_quality INTEGER,
      PRIMARY KEY (user_id, snippet_id)
  )

  -- Achievements
  user_achievements (
      user_id UUID REFERENCES profiles,
      achievement_id TEXT,
      unlocked_at TIMESTAMPTZ,
      PRIMARY KEY (user_id, achievement_id)
  )

  -- Custom snippets
  custom_snippets (
      id UUID PRIMARY KEY,
      user_id UUID REFERENCES profiles,
      content TEXT,
      language TEXT,
      title TEXT,
      tags TEXT[],
      created_at TIMESTAMPTZ
  )
  ```

- **Sync strategy:**
  - Last-write-wins with timestamp comparison
  - On login: merge local data with cloud (prefer newer record for each entity)
  - On logout: data remains in localStorage for offline use
  - Real-time: use Supabase Realtime subscriptions for immediate cross-device sync

- **Client integration:**
  - `lib/storage/cloud-store.ts`: Wraps Supabase SDK calls
  - `SyncProvider` context: manages auth state, sync status, conflict resolution
  - Every storage call checks `isAuthenticated()`. If true, write to both local + cloud. If false, local only.
  - Auth UI: "Sign In" button in header, account menu with avatar/name when signed in

**Complexity:** L (4-5 weeks)
**Dependencies:** Feature 5 (storage upgrade) should ship first for safe migration
**Critical files:** `lib/storage/session-history.ts`, `app/providers.tsx`, `components/AppShell.tsx`

---

### Feature 12: Global Leaderboards

**What it is.**
Public leaderboard showing top performers across various categories:
- Overall highest WPM
- Per-language rankings
- Per-difficulty rankings
- Per-snippet rankings (who typed Two Sum the fastest?)
- Time-scoped: daily, weekly, monthly, all-time

Users see their rank and percentile ("You are in the top 5% of Python typists").

**Why it matters.**
Leaderboards create aspiration and competition without requiring synchronous multiplayer. "Top 5% of Python typists" is a powerful motivational message and a shareable stat. Combined with shareable result cards, this drives organic discovery.

**Technical approach:**
- Requires cloud sync (Feature 11) for server-side score aggregation
- Supabase materialized views for performance:
  ```sql
  -- Refresh hourly
  CREATE MATERIALIZED VIEW leaderboard_weekly AS
  SELECT user_id, language,
         MAX(wpm) as best_wpm,
         AVG(wpm) as avg_wpm,
         COUNT(*) as session_count,
         PERCENT_RANK() OVER (ORDER BY MAX(wpm)) as percentile
  FROM sessions
  WHERE created_at > NOW() - INTERVAL '7 days'
  GROUP BY user_id, language;
  ```

- **Anti-cheat:**
  - Server-side validation: reject WPM > 250
  - Minimum session length: 10 seconds
  - Minimum snippet length: 3 lines
  - Flag accounts with suspicious patterns (sudden WPM jumps >50)

- **UI:**
  - Replace current local `LeaderboardModal` with global version
  - Tabs: Overall | By Language | By Snippet
  - Time filter: Today | This Week | This Month | All Time
  - Personal rank card: "You are #847 overall (top 12%)"
  - Highlight friends (if social features are added later)

**Complexity:** M (2-3 weeks, assuming cloud sync exists)
**Dependencies:** Feature 11 (cloud sync)
**Critical files:** `components/LeaderboardModal.tsx`

---

### Feature 13: VS Code Extension

**What it is.**
A VS Code extension that brings CodeSprint practice into the editor. Users trigger it via Command Palette ("CodeSprint: Start Session"). It opens a WebView panel showing the full typing interface. The extension auto-detects the current file's language and suggests relevant snippets. Session data syncs with the web app via cloud sync.

**Why it matters.**
Developers live in VS Code. Reducing friction from "open browser, navigate to site" to "Cmd+Shift+P, start" dramatically increases practice frequency. VS Code Marketplace also serves as a distribution channel -- developers browsing for tools discover CodeSprint.

**Technical approach:**
- Separate package: `packages/vscode-extension/`
- The extension is a WebView that loads a bundled version of the CodeSprint typing interface
- Reuses all existing React components rendered in WebView context
- Communication between extension host and WebView via `postMessage`:
  - Extension -> WebView: current file language, workspace theme
  - WebView -> Extension: session results, sync requests
- Status bar item: "CodeSprint: 7-day streak | 85 WPM avg"
- Settings sync: VS Code extension settings mirror web app preferences

**Complexity:** L (3-4 weeks)
**Dependencies:** Feature 11 for cross-platform sync (works standalone without it)
**Critical files:** New package; shares `lib/` modules with web app

---

## Implementation Phasing

| Phase | Weeks | Features | Theme | Status |
|-------|-------|----------|-------|--------|
| **1: Foundation** | 1-4 | #5 Storage Upgrade, #1 Syntax-Aware Scoring, #9 Shareable Cards | Better core + growth seed | **DONE** |
| **2: Engagement** | 5-10 | #3 Achievements/Streaks, #2 Spaced Repetition, #8 Adaptive Difficulty | Daily habit loop | Next up |
| **3: Differentiation** | 11-16 | #4 Custom Snippets, #6 Interview Prep, #7 Error Heatmaps | Unique value prop | — |
| **4: Scale** | 17-26 | #11 Cloud Sync, #10 Multiplayer, #12 Leaderboards, #13 VS Code | Network effects | — |

### Phase 1 Completed

All three Phase 1 features are implemented, tested (127 tests passing), and build-verified.

**#5 Storage Upgrade & Data Export**
- `lib/storage/idb-store.ts` — IndexedDB wrapper with typed stores (sessions, mastery, achievements, custom-snippets, meta)
- `lib/storage/migration.ts` — Versioned migration system (localStorage → IndexedDB)
- `lib/storage/session-history.ts` — Async CRUD API with IndexedDB primary + localStorage fallback; sync API preserved for backward compat
- `lib/export.ts` — JSON/CSV export, import with validation and deduplication
- Export JSON / Export CSV / Import Data buttons in Preferences drawer

**#1 Syntax-Aware Scoring Engine**
- `lib/tokenizer.ts` — Regex tokenizers for JS, Python, Java, C++ (8 token categories)
- `lib/token-weights.ts` — Per-language weight config (keywords 1.5x, operators 1.5x, whitespace 0.5x, etc.)
- `lib/pattern-analysis.ts` — Identifies top 3 weakest token categories by weighted error rate
- `lib/scoring.ts` — `computePatternScore()` (0-100) based on weighted token errors
- `lib/snippets.ts` — Snippet type extended with optional `tokens?: Token[]`
- `hooks/useTypingEngine.ts` — Pattern score computed in metrics via runtime tokenization
- `scripts/build-snippets.ts` — Validates tokenization of all 5838 snippets at build time
- Pattern Score and Weak Patterns displayed on result screen

**#9 Shareable Result Cards**
- `lib/share-card.ts` — Canvas rendering with theme colors, WPM/accuracy/pattern score, sparkline
- Share button (Web Share API with clipboard/download fallback) and Download button on result screen
- Text summary generation for Discord/Slack sharing

### Phase 2 Preview

Next up: the engagement loop.

- **#3 Achievements & Streaks** — 40 unlockable badges, daily streak counter, XP/level system
- **#2 Spaced Repetition** — SM-2 algorithm for per-snippet and per-pattern mastery tracking, smart "Next" recommendations
- **#8 Adaptive Difficulty** — Auto-adjusts difficulty based on skill level per language

Phase 1's storage (IndexedDB) and tokenization infrastructure directly supports all three.

---

## Architectural Principles

1. **Build-time over runtime**: Tokenization, snippet processing, and plan manifests computed at build time. Only custom snippets use runtime processing.
2. **Tiered storage**: localStorage (preferences, small state <50KB) -> IndexedDB (sessions, mastery, up to 100MB) -> Supabase (cloud sync, leaderboards)
3. **Progressive enhancement**: Every feature works without auth. Cloud sync is additive, not required.
4. **Immutable state**: All state updates create new objects (existing pattern, enforced).
5. **Feature flags**: New features behind toggles for gradual rollout and A/B testing.
