<h1 align="center">CodeSprint</h1>

<p align="center">
  <a href="https://nextjs.org/">
    <img src="https://img.shields.io/badge/Next.js-15-black?style=flat&logo=nextdotjs&logoColor=white" alt="Next.js 15">
  </a>
  <a href="https://react.dev/">
    <img src="https://img.shields.io/badge/React-19-61dafb?style=flat&logo=react&logoColor=white" alt="React 19">
  </a>
  <a href="https://microsoft.github.io/monaco-editor/">
    <img src="https://img.shields.io/badge/Monaco-Editor-blue?style=flat&logo=visualstudiocode&logoColor=white" alt="Monaco">
  </a>
</p>

<p align="center">
  <img src="https://github.com/user-attachments/assets/0fa880d2-714c-47cf-9c58-218524943d60" alt="codesprint demo" width="100%">
</p>

<p align="center">
  <strong>A code typing trainer that builds real syntax muscle memory.</strong>
  <br>
  Practice 1,800+ real LeetCode snippets across Python, JavaScript, Java, and C++ with syntax-aware scoring, spaced repetition, and adaptive difficulty.
</p>

<p align="center">
  <a href="#features">Features</a> · <a href="#how-it-works">How It Works</a> · <a href="#data-pipeline">Data Pipeline</a> · <a href="#running-locally">Running Locally</a>
</p>

## Why?

Most typing tests measure how fast you can type English. That doesn't translate when you're writing code full of brackets, operators, and indentation.

CodeSprint exists because syntax fluency matters in interviews and daily work. It lets you drill patterns like "Depth First Search in Python" or "Ring Buffer in C++" until your fingers know the shape of the code.

## Features

### Syntax-Aware Scoring

CodeSprint doesn't just count correct characters. It tokenizes each snippet by language and weights different constructs:

- **Keywords** and **operators** are weighted 1.5x
- **Delimiters** (brackets, parens) are weighted 1.2x
- **Whitespace** is weighted 0.5x

You get three metrics per session: raw WPM, adjusted WPM (only perfect words), and a pattern score that reflects how well you nailed the actual code constructs.

### Spaced Repetition

Built on the SM-2 algorithm (the same one behind Anki). CodeSprint tracks per-snippet mastery and schedules reviews based on your performance. Snippets you struggle with come back sooner; ones you've mastered fade into longer intervals.

### Adaptive Difficulty

The app tracks your proficiency per language and recommends what to practice next. It adjusts difficulty based on your recent accuracy and speed so you're always working at the right edge of your ability.

### Achievements & Progression

30+ achievements across speed, accuracy, consistency, and exploration categories with rarity tiers from common to legendary. An XP system with leveling tracks your overall progress, and streak tracking keeps you coming back daily.

### Customizable Editor

- 18+ color themes
- Vim mode support
- Configurable font size, caret width, and syntax highlighting level
- Panel mode or immersive/terminal mode for distraction-free practice
- Countdown timer before sessions (optional)

### Multi-Language Support

1,800+ real snippets sourced from LeetCode problems across four languages (JavaScript, Python, Java, C++) and three difficulty tiers (easy, medium, hard), categorized by length.

## How It Works

### The Editor

CodeSprint runs a heavily customized Monaco Editor instance. It uses `deltaDecorations` to paint correct/incorrect keystrokes directly onto the editor model without breaking syntax highlighting, and overlays a custom caret that animates smoother than the native DOM cursor.

### The Typing Engine

React's render cycle is too slow for a 100+ WPM feedback loop. The typing engine (`hooks/useTypingEngine.ts`) isolates keystroke logic from the React render tree, only triggering re-renders for specific UI updates like the WPM gauge. Metrics are recalculated on a throttled interval rather than every keystroke.

### Storage

Everything runs client-side with no backend required. Session history, achievements, mastery records, and XP live in IndexedDB with localStorage as a fallback for preferences. Data export is available in CSV and JSON formats.

## Data Pipeline

Snippets are sourced from LeetCode via a custom GraphQL scraper that reverse-engineers their API. To sync fresh snippets:

```bash
# Requires Bun (https://bun.sh)
npm run sync:leetcode -- --limit 50 --difficulties medium,hard
```

This queries the LeetCode `questionData` endpoint, extracts code snippets for all four languages, strips docstrings and excessive comments, normalizes indentation, and outputs a categorized JSON catalog.

After syncing, build the processed snippet files with tokenization metadata:

```bash
npm run build:snippets
```

## Running Locally

```bash
# Install dependencies
npm install

# Start the dev server (Next.js 15 + Turbopack)
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Testing

```bash
npm run test         # Unit tests (Vitest)
npm run test:watch   # Watch mode
npm run test:e2e     # E2E tests (Playwright)
```

### Production Build

```bash
npm run build
npm start
```

## Roadmap

- **Custom Renderer** - Migrating from Monaco to a WebGL/Canvas text renderer for zero DOM overhead (Gap Buffer implementation in progress).
- **Tree-sitter Integration** - Semantic typing that lets you skip whitespace and formatting irrelevant to code logic.
- **Advanced Analytics** - Pattern weakness identification across sessions.
- **Community Features** - Public leaderboards and challenge events.

## License

MIT.
