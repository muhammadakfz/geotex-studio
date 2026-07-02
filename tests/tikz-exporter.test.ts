import { describe, expect, it } from "vitest";
import { beautifyDiagram } from "@/lib/beautify";
import { createBlankDiagram, createObjectFromTool } from "@/lib/diagram-editor";
import { exportTikz } from "@/lib/tikz-exporter";
import { geometryFixture } from "./fixtures";

describe("tikz exporter", () => {
  it("exports semantic coordinates, styles, and package hints", () => {
    const diagram = beautifyDiagram(geometryFixture(), "olympiad-geometry");
    const exportResult = exportTikz(diagram);

    expect(exportResult.code).toContain("% \\usepackage{tikz}");
    expect(exportResult.code).toContain("% \\usepackage{xcolor}");
    expect(exportResult.code).toContain("\\coordinate (A) at");
    expect(exportResult.code).toContain("main line/.style");
    expect(exportResult.code).toContain("\\draw[main line");
    expect(exportResult.code).toContain("(A) -- (B) -- (C) -- cycle;");
    expect(exportResult.pureTikz).toBe(true);
  });

  it("exports custom colors, fill, line width, and opacity overrides", () => {
    const diagram = geometryFixture();
    diagram.objects[0] = {
      ...diagram.objects[0],
      style: {
        ...diagram.objects[0].style,
        fill: "#ff0000",
        opacity: 0.6,
      },
    };
    diagram.objects[3] = {
      ...diagram.objects[3],
      style: {
        ...diagram.objects[3].style,
        stroke: "#2563eb",
        fill: "#dbeafe",
        strokeWidth: 2.4,
        opacity: 0.75,
      },
    };

    const exportResult = exportTikz(diagram);

    expect(exportResult.code).toContain("\\definecolor{gtcolor");
    expect(exportResult.code).toContain("fill=gtcolor");
    expect(exportResult.code).toContain("line width=2.4pt");
    expect(exportResult.code).toContain("opacity=0.75");
  });

  it("exports rectangle and triangle tools as polygon cycles", () => {
    const diagram = createBlankDiagram();
    const rectangleStart = createObjectFromTool("rectangle", { x: 0, y: 0 }, [], [], "");
    const rectangleEnd = createObjectFromTool("rectangle", { x: 2, y: 1 }, rectangleStart.pendingPoints, [], "");
    const triangleA = createObjectFromTool("triangle", { x: 3, y: 0 }, [], [], "");
    const triangleB = createObjectFromTool("triangle", { x: 4, y: 0 }, triangleA.pendingPoints, [], "");
    const triangleC = createObjectFromTool("triangle", { x: 3.5, y: 1 }, triangleB.pendingPoints, [], "");

    diagram.objects = [rectangleEnd.object!, triangleC.object!];
    const exportResult = exportTikz(diagram);

    expect(exportResult.code).toContain("(0,0) -- (2,0) -- (2,1) -- (0,1) -- cycle;");
    expect(exportResult.code).toContain("(3,0) -- (4,0) -- (3.5,1) -- cycle;");
  });

  it("keeps cartesian guides out of exports unless requested", () => {
    const diagram = geometryFixture();

    expect(exportTikz(diagram).code).not.toContain("Optional cartesian guide");
    expect(exportTikz(diagram, { includeCartesian: true }).code).toContain("Optional cartesian guide");
  });
});
