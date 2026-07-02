import { describe, expect, it } from "vitest";
import { applyObjectGeometryPatch, insertPolygonVertex, objectGeometry } from "@/lib/diagram-geometry";
import type { DiagramObject } from "@/lib/diagram-types";

const rectangle: Extract<DiagramObject, { type: "Polygon" }> = {
  id: "rectangle-1",
  name: "Rectangle 1",
  type: "Polygon",
  visibility: true,
  points: [
    { x: 0, y: 0 },
    { x: 4, y: 0 },
    { x: 4, y: 2 },
    { x: 0, y: 2 },
  ],
  semanticRole: "area-region",
  style: { stroke: "#111111", fill: "transparent", strokeWidth: 1.2 },
};

describe("diagram geometry helpers", () => {
  it("reports X and Y as the object center for bounded shapes", () => {
    expect(objectGeometry(rectangle)).toEqual({ x: 2, y: 1, w: 4.16, h: 2.16 });
  });

  it("moves bounded shapes by editing center X and Y", () => {
    const moved = applyObjectGeometryPatch(rectangle, { x: 5, y: 4 });

    expect(objectGeometry(moved)).toEqual({ x: 5, y: 4, w: 4.16, h: 2.16 });
  });

  it("inserts a pinned vertex into a polygon edge", () => {
    const pinned = insertPolygonVertex(rectangle, 1, { x: 4, y: 1 });

    expect(pinned.points).toEqual([
      { x: 0, y: 0 },
      { x: 4, y: 0 },
      { x: 4, y: 1 },
      { x: 4, y: 2 },
      { x: 0, y: 2 },
    ]);
  });
});
