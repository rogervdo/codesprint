import { describe, it, expect } from "vitest";
import {
    normalizeCatalog,
    filterSnippets,
    getProblems,
    PLACEHOLDER_SNIPPET,
} from "../snippets";

describe("normalizeCatalog", () => {
    it("returns empty array for invalid input", () => {
        expect(normalizeCatalog(null)).toEqual([]);
    });

    it("parses valid catalog entries", () => {
        const result = normalizeCatalog([
            {
                id: "py-bfs-template",
                title: "BFS Template",
                language: "python",
                type: "template",
                topics: ["bfs-tree"],
                content: "from collections import deque\n\ndef bfs():\n    pass\n",
            },
        ]);
        expect(result).toHaveLength(1);
        expect(result[0].type).toBe("template");
        expect(result[0].topics).toContain("bfs-tree");
    });

    it("skips entries without topics or type", () => {
        expect(
            normalizeCatalog([
                { id: "x", language: "python", content: "print(1)\n", type: "template", topics: [] },
            ])
        ).toEqual([]);
    });
});

describe("filterSnippets", () => {
    const snippets = normalizeCatalog([
        {
            id: "js-graph-problem",
            title: "Graph Problem",
            language: "javascript",
            type: "problem",
            topics: ["graph"],
            content: "function solve() {\n  return 1;\n}\n",
        },
        {
            id: "py-graph-template",
            title: "Graph Template",
            language: "python",
            type: "template",
            topics: ["bfs-graph"],
            content: "def dfs():\n    pass\n",
        },
    ]);

    it("filters by language, type, and topics", () => {
        const filtered = filterSnippets(snippets, "python", {
            types: ["template"],
            topics: ["bfs-graph"],
        });
        expect(filtered).toHaveLength(1);
        expect(filtered[0].id).toBe("py-graph-template");
    });
});

describe("getProblems", () => {
    it("returns empty when catalog is empty", () => {
        expect(
            getProblems([], "python", { types: ["template", "problem"], topics: ["graph"] })
        ).toEqual([]);
    });
});

describe("PLACEHOLDER_SNIPPET", () => {
    it("is excluded from filters", () => {
        const filtered = filterSnippets([PLACEHOLDER_SNIPPET], "python", {
            types: ["template"],
            topics: ["binary-search"],
        });
        expect(filtered).toHaveLength(0);
    });
});
