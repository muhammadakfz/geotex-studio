import { describe, expect, it } from "vitest";
import { beautifyDiagram } from "@/lib/beautify";
import { lintDiagram } from "@/lib/linter";
import { physicsFixture } from "./fixtures";

describe("diagram linter", () => {
  it("produces a bounded score and improves after beautify", () => {
    const raw = physicsFixture();
    const rawResult = lintDiagram(raw);
    const fixedResult = lintDiagram(beautifyDiagram(raw, "physics-report"));

    expect(rawResult.score).toBeGreaterThanOrEqual(0);
    expect(rawResult.score).toBeLessThanOrEqual(100);
    expect(fixedResult.score).toBeGreaterThanOrEqual(rawResult.score);
  });
});
