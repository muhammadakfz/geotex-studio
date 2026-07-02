import { describe, expect, it } from "vitest";
import { beautifyDiagram } from "@/lib/beautify";
import { geometryFixture } from "./fixtures";

describe("beautifyDiagram", () => {
  it("normalizes labels and construction lines without mutating the source", () => {
    const original = geometryFixture();
    const beautified = beautifyDiagram(original, "olympiad-geometry");
    const angle = beautified.objects.find((object) => object.id === "angle-a");
    const altitude = beautified.objects.find((object) => object.id === "construction");

    expect(angle?.label).toBe("$\\theta$");
    expect(altitude?.style.dashed).toBe(true);
    expect(original.objects.find((object) => object.id === "angle-a")?.label).toBe("theta");
  });
});
