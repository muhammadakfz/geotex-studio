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

  it("exports free edge labels on polygon sides", () => {
    const diagram = createBlankDiagram();
    const rectangleStart = createObjectFromTool("rectangle", { x: 0, y: 0 }, [], [], "");
    const rectangleEnd = createObjectFromTool("rectangle", { x: 2, y: 1 }, rectangleStart.pendingPoints, [], "");

    diagram.objects = [
      {
        ...rectangleEnd.object!,
        edgeLabels: ["a", "12", "CD", ""],
      },
    ];
    const exportResult = exportTikz(diagram);

    expect(exportResult.code).toContain("node[midway, below] {$a$}");
    expect(exportResult.code).toContain("node[midway, right] {$12$}");
    expect(exportResult.code).toContain("node[midway, above] {$CD$}");
    expect(exportResult.code).not.toContain(" -- cycle;");
  });

  it("keeps cartesian guides out of exports unless requested", () => {
    const diagram = geometryFixture();

    expect(exportTikz(diagram).code).not.toContain("Optional cartesian guide");
    expect(exportTikz(diagram, { includeCartesian: true }).code).toContain("Optional cartesian guide");
  });

  it("keeps default exports free of gray styling", () => {
    const diagram = geometryFixture();
    const exportResult = exportTikz(diagram, { includeCartesian: true });

    expect(exportResult.code).not.toMatch(/gr[ae]y/i);
    expect(exportResult.code).toContain("area region/.style={draw=black}");
  });

  it("exports line objects as solid unless dashed is explicitly enabled", () => {
    const diagram = createBlankDiagram();
    const lineStart = createObjectFromTool("line", { x: -1, y: -1 }, [], [], "");
    const lineEnd = createObjectFromTool("line", { x: 2, y: 2 }, lineStart.pendingPoints, [], "");

    diagram.objects = [lineEnd.object!];
    const solidExport = exportTikz(diagram).code;

    expect(solidExport).toContain("construction line/.style={thin}");
    expect(solidExport).toContain("\\draw[construction line, draw=black, line width=1pt] (-1,-1) -- (2,2);");
    expect(solidExport).not.toContain("construction line/.style={thin, dashed}");

    diagram.objects = [{ ...lineEnd.object!, style: { ...lineEnd.object!.style, dashed: true } }];
    expect(exportTikz(diagram).code).toContain("\\draw[construction line, draw=black, line width=1pt, dashed] (-1,-1) -- (2,2);");
  });

  it("exports pen paths as solid TikZ polylines", () => {
    const diagram = createBlankDiagram();
    diagram.objects = [
      {
        id: "pen-1",
        name: "Pen 1",
        type: "PenPath",
        visibility: true,
        points: [
          { x: 0, y: 0 },
          { x: 0.5, y: 1 },
          { x: 1, y: 0 },
        ],
        semanticRole: "main-object",
        style: { stroke: "#111111", fill: "transparent", strokeWidth: 1.25 },
      },
    ];

    expect(exportTikz(diagram).code).toContain("\\draw[main line, draw=black, line width=1.25pt] (0,0) -- (0.5,1) -- (1,0);");
  });
});
