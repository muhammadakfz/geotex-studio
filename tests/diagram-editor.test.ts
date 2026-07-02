import { describe, expect, it } from "vitest";
import { createBlankDiagram, createObjectFromDrag, createObjectFromTool, snapPoint } from "@/lib/diagram-editor";

describe("diagram editor helpers", () => {
  it("creates a blank editable figure with a visible grid", () => {
    const diagram = createBlankDiagram();

    expect(diagram.name).toBe("Untitled Figure");
    expect(diagram.gridVisible).toBe(true);
    expect(diagram.objects).toEqual([]);
  });

  it("snaps coordinates to grid increments", () => {
    expect(snapPoint({ x: 1.24, y: -0.26 }, true)).toEqual({ x: 1, y: -0.5 });
  });

  it("creates a segment after two canvas clicks", () => {
    const start = createObjectFromTool("segment", { x: 0, y: 0 }, [], [], "");
    const end = createObjectFromTool("segment", { x: 2, y: 1 }, start.pendingPoints, [], "");

    expect(start.object).toBeNull();
    expect(start.pendingPoints).toEqual([{ x: 0, y: 0 }]);
    expect(end.object).toMatchObject({
      type: "Segment",
      start: { x: 0, y: 0 },
      end: { x: 2, y: 1 },
    });
  });

  it("creates rectangles and triangles as exportable polygons", () => {
    const rectangleStart = createObjectFromTool("rectangle", { x: 2, y: 2 }, [], [], "");
    const rectangleEnd = createObjectFromTool("rectangle", { x: -1, y: 0 }, rectangleStart.pendingPoints, [], "");
    const triangleA = createObjectFromTool("triangle", { x: 0, y: 0 }, [], [], "");
    const triangleB = createObjectFromTool("triangle", { x: 1, y: 0 }, triangleA.pendingPoints, [], "");
    const triangleC = createObjectFromTool("triangle", { x: 0.5, y: 1 }, triangleB.pendingPoints, [], "");

    expect(rectangleEnd.object).toMatchObject({
      type: "Polygon",
      points: [
        { x: -1, y: 0 },
        { x: 2, y: 0 },
        { x: 2, y: 2 },
        { x: -1, y: 2 },
      ],
    });
    expect(triangleC.object).toMatchObject({
      type: "Polygon",
      points: [
        { x: 0, y: 0 },
        { x: 1, y: 0 },
        { x: 0.5, y: 1 },
      ],
    });
  });

  it("creates an angle from three clicks", () => {
    const start = createObjectFromTool("angle", { x: 1, y: 0 }, [], [], "");
    const vertex = createObjectFromTool("angle", { x: 0, y: 0 }, start.pendingPoints, [], "");
    const end = createObjectFromTool("angle", { x: 0, y: 1 }, vertex.pendingPoints, [], "");

    expect(end.object).toMatchObject({
      type: "Angle",
      start: { x: 1, y: 0 },
      vertex: { x: 0, y: 0 },
      end: { x: 0, y: 1 },
    });
  });

  it("creates resizable drawing objects from a single drag", () => {
    const rectangle = createObjectFromDrag("rectangle", { x: 2, y: 2 }, { x: -1, y: 0 }, [], "");
    const triangle = createObjectFromDrag("triangle", { x: 0, y: 0 }, { x: 2, y: 1.5 }, [], "");
    const angle = createObjectFromDrag("angle", { x: 0, y: 0 }, { x: 2, y: 1 }, [], "");

    expect(rectangle).toMatchObject({
      type: "Polygon",
      points: [
        { x: -1, y: 0 },
        { x: 2, y: 0 },
        { x: 2, y: 2 },
        { x: -1, y: 2 },
      ],
    });
    expect(triangle).toMatchObject({
      type: "Polygon",
      points: [
        { x: 0, y: 0 },
        { x: 2, y: 0 },
        { x: 1, y: 1.5 },
      ],
    });
    expect(angle).toMatchObject({
      type: "Angle",
      start: { x: 2, y: 0 },
      vertex: { x: 0, y: 0 },
      end: { x: 0, y: 1 },
    });
  });
});
