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
// Fast character classification via charCode
// ---------------------------------------------------------------------------

function isWhitespace(c: number): boolean {
    return c === 32 /* ' ' */ || c === 9 /* '\t' */ || c === 10 /* '\n' */ || c === 13 /* '\r' */;
}

function isDigit(c: number): boolean {
    return c >= 48 && c <= 57; // 0-9
}

function isIdentStart(c: number): boolean {
    return (c >= 65 && c <= 90) || (c >= 97 && c <= 122) || c === 95 || c === 36; // A-Z, a-z, _, $
}

function isIdentChar(c: number): boolean {
    return (c >= 65 && c <= 90) || (c >= 97 && c <= 122) || (c >= 48 && c <= 57) || c === 95 || c === 36;
}

function isNumericChar(c: number): boolean {
    return (c >= 48 && c <= 57) // 0-9
        || (c >= 65 && c <= 70) // A-F
        || (c >= 97 && c <= 102) // a-f
        || c === 120 || c === 88 // x, X
        || c === 111 || c === 79 // o, O
        || c === 98 || c === 66 // b, B
        || c === 46 // .
        || c === 95 // _
        || c === 101 || c === 69 // e, E
        || c === 43 || c === 45; // +, -
}

// Precompute delimiter and operator lookup tables (by charCode)
const IS_DELIMITER = new Uint8Array(128);
for (const ch of ["(", ")", "[", "]", "{", "}", ",", ";", ":", "."]) {
    IS_DELIMITER[ch.charCodeAt(0)] = 1;
}

const IS_OPERATOR = new Uint8Array(128);
for (const ch of ["+", "-", "*", "/", "%", "=", "<", ">", "!", "&", "|", "^", "~", "?", "@"]) {
    IS_OPERATOR[ch.charCodeAt(0)] = 1;
}

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
    const len = content.length;
    let i = 0;

    while (i < len) {
        const cc = content.charCodeAt(i);

        // Whitespace run
        if (isWhitespace(cc)) {
            const start = i;
            i++;
            while (i < len && isWhitespace(content.charCodeAt(i))) i++;
            tokens.push({ category: "whitespace", start, end: i, text: content.slice(start, i) });
            continue;
        }

        // String literals
        if (cc === 34 /* " */ || cc === 39 /* ' */ || cc === 96 /* ` */) {
            const start = i;
            const quote = cc;

            // Check for triple quotes (Python)
            if (language === "python" && i + 2 < len && content.charCodeAt(i + 1) === quote && content.charCodeAt(i + 2) === quote) {
                i += 3;
                while (i + 2 < len && !(content.charCodeAt(i) === quote && content.charCodeAt(i + 1) === quote && content.charCodeAt(i + 2) === quote)) {
                    i++;
                }
                i = Math.min(i + 3, len);
                tokens.push({ category: "string", start, end: i, text: content.slice(start, i) });
                continue;
            }

            // Template literal (JS backtick) or regular string
            i++;
            while (i < len && content.charCodeAt(i) !== quote) {
                if (content.charCodeAt(i) === 92 /* \ */) i++; // skip escaped char
                i++;
            }
            if (i < len) i++; // closing quote
            tokens.push({ category: "string", start, end: i, text: content.slice(start, i) });
            continue;
        }

        // Line comments
        if (cc === 47 /* / */ && i + 1 < len && content.charCodeAt(i + 1) === 47) {
            const start = i;
            while (i < len && content.charCodeAt(i) !== 10) i++;
            tokens.push({ category: "comment", start, end: i, text: content.slice(start, i) });
            continue;
        }

        // Block comments
        if (cc === 47 /* / */ && i + 1 < len && content.charCodeAt(i + 1) === 42 /* * */) {
            const start = i;
            i += 2;
            while (i + 1 < len && !(content.charCodeAt(i) === 42 && content.charCodeAt(i + 1) === 47)) i++;
            i = Math.min(i + 2, len);
            tokens.push({ category: "comment", start, end: i, text: content.slice(start, i) });
            continue;
        }

        // Python hash comments
        if (language === "python" && cc === 35 /* # */) {
            const start = i;
            while (i < len && content.charCodeAt(i) !== 10) i++;
            tokens.push({ category: "comment", start, end: i, text: content.slice(start, i) });
            continue;
        }

        // Numeric literals
        if (isDigit(cc)) {
            const start = i;
            i++;
            while (i < len && isNumericChar(content.charCodeAt(i))) i++;
            tokens.push({ category: "literal", start, end: i, text: content.slice(start, i) });
            continue;
        }

        // Identifiers and keywords
        if (isIdentStart(cc)) {
            const start = i;
            i++;
            while (i < len && isIdentChar(content.charCodeAt(i))) i++;
            const text = content.slice(start, i);
            const category: TokenCategory = keywords.has(text) ? "keyword" : "identifier";
            tokens.push({ category, start, end: i, text });
            continue;
        }

        // Delimiters
        if (cc < 128 && IS_DELIMITER[cc]) {
            tokens.push({ category: "delimiter", start: i, end: i + 1, text: content[i] });
            i++;
            continue;
        }

        // Operators (may be multi-char: ==, !=, >=, <=, =>. ++, --, etc.)
        if (cc < 128 && IS_OPERATOR[cc]) {
            const start = i;
            i++;
            while (i < len) {
                const oc = content.charCodeAt(i);
                if (oc >= 128 || !IS_OPERATOR[oc]) break;
                i++;
            }
            tokens.push({ category: "operator", start, end: i, text: content.slice(start, i) });
            continue;
        }

        // Fallback: treat as identifier (e.g. unicode chars, # in non-python)
        tokens.push({ category: "identifier", start: i, end: i + 1, text: content[i] });
        i++;
    }

    return tokens;
}

/**
 * Build a lookup array mapping each character index to its token category.
 * This enables O(1) lookups during scoring.
 */
export function buildCategoryMap(tokens: Token[], length: number): TokenCategory[] {
    // Tokens are contiguous and cover all positions, so skip .fill()
    const map: TokenCategory[] = new Array(length);
    for (let t = 0; t < tokens.length; t++) {
        const tok = tokens[t];
        const cat = tok.category;
        const end = Math.min(tok.end, length);
        for (let i = tok.start; i < end; i++) {
            map[i] = cat;
        }
    }
    return map;
}
