import { describe, expect, it } from "vitest";
import { normalizeLatexLabel, isLatexSafeLabel } from "@/lib/latex-normalizer";

describe("latex normalizer", () => {
  it("normalizes greek labels and point labels", () => {
    expect(normalizeLatexLabel("theta")).toBe("$\\theta$");
    expect(normalizeLatexLabel("A", { type: "Point" })).toBe("$A$");
  });

  it("normalizes physics vector labels", () => {
    expect(normalizeLatexLabel("Fnet")).toBe("$\\vec{F}_{net}$");
    expect(normalizeLatexLabel("N", { type: "Vector" })).toBe("$\\vec{N}$");
  });

  it("detects labels that should be normalized", () => {
    expect(isLatexSafeLabel("theta")).toBe(false);
    expect(isLatexSafeLabel("$\\theta$")).toBe(true);
  });
});
