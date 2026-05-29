import { describe, it, expect } from "vitest";
import {
    getTopicsForType,
    sanitizeContentType,
    sanitizeProblemTopics,
    sanitizeTemplateTopics,
    TEMPLATE_TOPICS,
    PROBLEM_TOPICS,
} from "../catalog";

describe("catalog", () => {
    it("exposes disjoint topic sets per content type", () => {
        expect(getTopicsForType("template")).toEqual(TEMPLATE_TOPICS);
        expect(getTopicsForType("problem")).toEqual(PROBLEM_TOPICS);
    });

    it("migrates legacy multi-select contentTypes to a single type", () => {
        expect(sanitizeContentType(undefined, ["template", "problem"])).toBe("problem");
        expect(sanitizeContentType(undefined, ["template"])).toBe("template");
    });

    it("sanitizes template and problem topic selections independently", () => {
        expect(sanitizeTemplateTopics(["bfs-tree", "not-a-topic"])).toEqual(["bfs-tree"]);
        expect(sanitizeProblemTopics(["graph", "bfs-tree"])).toEqual(["graph"]);
    });
});
