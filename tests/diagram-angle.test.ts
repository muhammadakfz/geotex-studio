import { describe, expect, it } from "vitest";
import { inferAngleAtAnchor, inferAngleAtPoint } from "@/lib/diagram-angle";
import type { DiagramModel, DiagramObject } from "@/lib/diagram-types";

function model(objects: DiagramObject[]): DiagramModel {
  return {
    id: "test",
    name: "Test",
    diagramType: "custom",
    gridVisible: true,
    coordinatesVisible: true,
    viewport: { minX: -5, maxX: 5, minY: -5, maxY: 5 },
    objects,
  };
}

function point(id: string, x: number, y: number): Extract<DiagramObject, { type: "Point" }> {
  return {
    id,
    name: id,
    type: "Point",
    label: id,
    visibility: true,
    coordinates: { x, y },
    semanticRole: "main-object",
    style: { fill: "#111111", pointSize: 3.2 },
  };
}

describe("angle inference", () => {
  it("infers an angle from a clicked point with two linked connectors", () => {
    const objects: DiagramObject[] = [
      point("A", 0, 0),
      point("B", 2, 0),
      point("C", 0, 2),
      {
        id: "ab",
        name: "Line AB",
        type: "Line",
        visibility: true,
        through: [
          { x: 0, y: 0 },
          { x: 2, y: 0 },
        ],
        anchors: [
          { kind: "point", objectId: "A" },
          { kind: "point", objectId: "B" },
        ],
        semanticRole: "construction-line",
        style: { stroke: "#111111", strokeWidth: 1 },
      },
      {
        id: "ac",
        name: "Line AC",
        type: "Line",
        visibility: true,
        through: [
          { x: 0, y: 0 },
          { x: 0, y: 2 },
        ],
        anchors: [
          { kind: "point", objectId: "A" },
          { kind: "point", objectId: "C" },
        ],
        semanticRole: "construction-line",
        style: { stroke: "#111111", strokeWidth: 1 },
      },
    ];

    const draft = inferAngleAtAnchor(model(objects), { kind: "point", objectId: "A" });

    expect(draft).toMatchObject({
      start: { x: 2, y: 0 },
      vertex: { x: 0, y: 0 },
      end: { x: 0, y: 2 },
      anchors: [
        { kind: "point", objectId: "B" },
        { kind: "point", objectId: "A" },
        { kind: "point", objectId: "C" },
      ],
    });
  });

  it("infers an angle from nearby geometric endpoints even without anchor links", () => {
    const objects: DiagramObject[] = [
      point("A", 0, 0),
      {
        id: "ab",
        name: "Segment AB",
        type: "Segment",
        visibility: true,
        start: { x: 0, y: 0 },
        end: { x: 2, y: 0 },
        semanticRole: "main-object",
        style: { stroke: "#111111", strokeWidth: 1.2 },
      },
      {
        id: "ac",
        name: "Segment AC",
        type: "Segment",
        visibility: true,
        start: { x: 0, y: 0 },
        end: { x: 0, y: 2 },
        semanticRole: "main-object",
        style: { stroke: "#111111", strokeWidth: 1.2 },
      },
    ];

    const draft = inferAngleAtPoint(model(objects), { x: 0.04, y: 0.03 });

    expect(draft).toMatchObject({
      start: { x: 2, y: 0 },
      vertex: { x: 0, y: 0 },
      end: { x: 0, y: 2 },
    });
  });

  it("infers an angle from two connected segments without a point object", () => {
    const objects: DiagramObject[] = [
      {
        id: "ab",
        name: "Segment AB",
        type: "Segment",
        visibility: true,
        start: { x: 0, y: 0 },
        end: { x: 2, y: 0 },
        semanticRole: "main-object",
        style: { stroke: "#111111", strokeWidth: 1.2 },
      },
      {
        id: "ac",
        name: "Segment AC",
        type: "Segment",
        visibility: true,
        start: { x: 0, y: 0 },
        end: { x: 0, y: 2 },
        semanticRole: "main-object",
        style: { stroke: "#111111", strokeWidth: 1.2 },
      },
    ];

    const draft = inferAngleAtPoint(model(objects), { x: 0.02, y: -0.02 });

    expect(draft).toMatchObject({
      start: { x: 2, y: 0 },
      vertex: { x: 0, y: 0 },
      end: { x: 0, y: 2 },
      anchors: [null, null, null],
    });
  });
});
