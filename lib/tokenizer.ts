/**
 * Regex-based tokenizers for JS, Python, Java, and C++.
 *
 * Each tokenizer produces a flat Token[] that covers the entire snippet content
 * character-by-character. Tokens are non-overlapping and contiguous.
 */

import type { SupportedLanguage } from "./snippets";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type TokenCategory =
    | "keyword"
    | "operator"
    | "delimiter"
    | "identifier"
    | "literal"
    | "whitespace"
    | "comment"
    | "string";

export type Token = {
    /** Category of this token */
    category: TokenCategory;
    /** Start index (inclusive) in the source string */
    start: number;
    /** End index (exclusive) in the source string */
    end: number;
    /** The raw text of this token */
    text: string;
};

// ---------------------------------------------------------------------------
// Language keyword sets
// ---------------------------------------------------------------------------

const JS_KEYWORDS = new Set([
    "abstract", "arguments", "async", "await", "boolean", "break", "byte", "case", "catch",
    "char", "class", "const", "continue", "debugger", "default", "delete", "do", "double",
    "else", "enum", "export", "extends", "false", "final", "finally", "float", "for",
    "function", "goto", "if", "implements", "import", "in", "instanceof", "int", "interface",
    "let", "long", "native", "new", "null", "of", "package", "private", "protected", "public",
    "return", "short", "static", "super", "switch", "synchronized", "this", "throw", "throws",
    "transient", "true", "try", "typeof", "undefined", "var", "void", "volatile", "while",
    "with", "yield",
]);

const PYTHON_KEYWORDS = new Set([
    "False", "None", "True", "and", "as", "assert", "async", "await", "break", "class",
    "continue", "def", "del", "elif", "else", "except", "finally", "for", "from", "global",
    "if", "import", "in", "is", "lambda", "nonlocal", "not", "or", "pass", "raise", "return",
    "try", "while", "with", "yield",
]);

const JAVA_KEYWORDS = new Set([
    "abstract", "assert", "boolean", "break", "byte", "case", "catch", "char", "class",
    "const", "continue", "default", "do", "double", "else", "enum", "extends", "false",
    "final", "finally", "float", "for", "goto", "if", "implements", "import", "instanceof",
    "int", "interface", "long", "native", "new", "null", "package", "private", "protected",
    "public", "return", "short", "static", "strictfp", "super", "switch", "synchronized",
    "this", "throw", "throws", "transient", "true", "try", "void", "volatile", "while",
]);

const CPP_KEYWORDS = new Set([
    "alignas", "alignof", "and", "and_eq", "asm", "auto", "bitand", "bitor", "bool", "break",
    "case", "catch", "char", "char8_t", "char16_t", "char32_t", "class", "compl", "concept",
    "const", "consteval", "constexpr", "constinit", "const_cast", "continue", "co_await",
    "co_return", "co_yield", "decltype", "default", "delete", "do", "double", "dynamic_cast",
    "else", "enum", "explicit", "export", "extern", "false", "float", "for", "friend", "goto",
    "if", "inline", "int", "long", "mutable", "namespace", "new", "noexcept", "not", "not_eq",
    "nullptr", "operator", "or", "or_eq", "private", "protected", "public", "register",
    "reinterpret_cast", "requires", "return", "short", "signed", "sizeof", "static",
    "static_assert", "static_cast", "struct", "switch", "template", "this", "thread_local",
    "throw", "true", "try", "typedef", "typeid", "typename", "union", "unsigned", "using",
    "virtual", "void", "volatile", "wchar_t", "while", "xor", "xor_eq",
    // common types used as keywords in practice
    "std", "string", "vector", "map", "set", "size_t", "uint8_t", "int32_t",
]);

const KEYWORD_SETS: Record<SupportedLanguage, Set<string>> = {
    javascript: JS_KEYWORDS,
    python: PYTHON_KEYWORDS,
    java: JAVA_KEYWORDS,
    cpp: CPP_KEYWORDS,
};

// ---------------------------------------------------------------------------
// Delimiter / operator character sets
// ---------------------------------------------------------------------------

const DELIMITERS = new Set([
    "(", ")", "[", "]", "{", "}", ",", ";", ":", ".",
]);

const OPERATOR_CHARS = new Set([
    "+", "-", "*", "/", "%", "=", "<", ">", "!", "&", "|", "^", "~", "?", "@",
]);

// ---------------------------------------------------------------------------
// Tokenizer
// ---------------------------------------------------------------------------

/**
 * Tokenize a snippet's content into a flat Token[] covering every character.
 *
 * The tokenizer is intentionally simple (regex + character scanning) rather than
 * a full parser. It's accurate enough for scoring weights and pattern analysis.
 */
export function tokenize(content: string, language: SupportedLanguage): Token[] {
    const keywords = KEYWORD_SETS[language];
    const tokens: Token[] = [];
    let i = 0;

    while (i < content.length) {
        const ch = content[i];

        // Whitespace run
        if (ch === " " || ch === "\t" || ch === "\n" || ch === "\r") {
            const start = i;
            while (i < content.length && (content[i] === " " || content[i] === "\t" || content[i] === "\n" || content[i] === "\r")) {
                i++;
            }
            tokens.push({ category: "whitespace", start, end: i, text: content.slice(start, i) });
            continue;
        }

        // String literals
        if (ch === '"' || ch === "'" || ch === "`") {
            const start = i;
            const quote = ch;

            // Check for triple quotes (Python)
            if (language === "python" && i + 2 < content.length && content[i + 1] === quote && content[i + 2] === quote) {
                i += 3;
                while (i + 2 < content.length && !(content[i] === quote && content[i + 1] === quote && content[i + 2] === quote)) {
                    i++;
                }
                i = Math.min(i + 3, content.length);
                tokens.push({ category: "string", start, end: i, text: content.slice(start, i) });
                continue;
            }

            // Template literal (JS backtick) or regular string
            i++;
            while (i < content.length && content[i] !== quote) {
                if (content[i] === "\\") i++; // skip escaped char
                i++;
            }
            if (i < content.length) i++; // closing quote
            tokens.push({ category: "string", start, end: i, text: content.slice(start, i) });
            continue;
        }

        // Line comments
        if (ch === "/" && i + 1 < content.length && content[i + 1] === "/") {
            const start = i;
            while (i < content.length && content[i] !== "\n") i++;
            tokens.push({ category: "comment", start, end: i, text: content.slice(start, i) });
            continue;
        }

        // Block comments
        if (ch === "/" && i + 1 < content.length && content[i + 1] === "*") {
            const start = i;
            i += 2;
            while (i + 1 < content.length && !(content[i] === "*" && content[i + 1] === "/")) i++;
            i = Math.min(i + 2, content.length);
            tokens.push({ category: "comment", start, end: i, text: content.slice(start, i) });
            continue;
        }

        // Python hash comments
        if (language === "python" && ch === "#") {
            const start = i;
            while (i < content.length && content[i] !== "\n") i++;
            tokens.push({ category: "comment", start, end: i, text: content.slice(start, i) });
            continue;
        }

        // Numeric literals
        if (ch >= "0" && ch <= "9") {
            const start = i;
            while (i < content.length && /[0-9a-fA-FxXoObB._eE+\-]/.test(content[i])) i++;
            tokens.push({ category: "literal", start, end: i, text: content.slice(start, i) });
            continue;
        }

        // Identifiers and keywords
        if (/[a-zA-Z_$]/.test(ch)) {
            const start = i;
            while (i < content.length && /[a-zA-Z0-9_$]/.test(content[i])) i++;
            const text = content.slice(start, i);
            const category: TokenCategory = keywords.has(text) ? "keyword" : "identifier";
            tokens.push({ category, start, end: i, text });
            continue;
        }

        // Delimiters
        if (DELIMITERS.has(ch)) {
            tokens.push({ category: "delimiter", start: i, end: i + 1, text: ch });
            i++;
            continue;
        }

        // Operators (may be multi-char: ==, !=, >=, <=, =>. ++, --, etc.)
        if (OPERATOR_CHARS.has(ch)) {
            const start = i;
            while (i < content.length && OPERATOR_CHARS.has(content[i])) i++;
            tokens.push({ category: "operator", start, end: i, text: content.slice(start, i) });
            continue;
        }

        // Fallback: treat as identifier (e.g. unicode chars, # in non-python)
        tokens.push({ category: "identifier", start: i, end: i + 1, text: ch });
        i++;
    }

    return tokens;
}

/**
 * Build a lookup array mapping each character index to its token category.
 * This enables O(1) lookups during scoring.
 */
export function buildCategoryMap(tokens: Token[], length: number): TokenCategory[] {
    const map: TokenCategory[] = new Array(length).fill("whitespace");
    for (const token of tokens) {
        for (let i = token.start; i < token.end && i < length; i++) {
            map[i] = token.category;
        }
    }
    return map;
}
