import { describe, expect, it } from "vitest";
import { syncLinkedDiagram } from "@/lib/diagram-links";
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

const polygon: Extract<DiagramObject, { type: "Polygon" }> = {
  id: "poly",
  name: "Rectangle",
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

const line: Extract<DiagramObject, { type: "Line" }> = {
  id: "line",
  name: "Line",
  type: "Line",
  visibility: true,
  through: [
    { x: 0, y: 0 },
    { x: 4, y: 0 },
  ],
  anchors: [
    { kind: "polygon-vertex", objectId: "poly", vertexIndex: 0 },
    { kind: "polygon-vertex", objectId: "poly", vertexIndex: 1 },
  ],
  semanticRole: "construction-line",
  style: { stroke: "#111111", strokeWidth: 1 },
};

describe("diagram link constraints", () => {
  it("moves anchored polygon vertices when a linked line endpoint is edited", () => {
    const previous = model([polygon, line]);
    const editedLine: typeof line = {
      ...line,
      through: [
        { x: -1, y: -0.5 },
        { x: 5, y: 0.5 },
      ],
    };
    const synced = syncLinkedDiagram(model([polygon, editedLine]), previous);
    const syncedPolygon = synced.objects.find((object) => object.id === "poly");
    const syncedLine = synced.objects.find((object) => object.id === "line");

    expect(syncedPolygon).toMatchObject({
      points: [
        { x: -1, y: -0.5 },
        { x: 5, y: 0.5 },
        { x: 4, y: 2 },
        { x: 0, y: 2 },
      ],
    });
    expect(syncedLine).toMatchObject({
      through: [
        { x: -1, y: -0.5 },
        { x: 5, y: 0.5 },
      ],
    });
  });

  it("keeps attached angle markers aligned to polygon edges", () => {
    const angle: Extract<DiagramObject, { type: "Angle" }> = {
      id: "angle",
      name: "Angle",
      type: "Angle",
      visibility: true,
      start: polygon.points[0],
      vertex: polygon.points[1],
      end: polygon.points[2],
      attachedObjectId: "poly",
      attachedVertexIndex: 1,
      radius: 0.55,
      semanticRole: "theorem-label",
      style: { stroke: "#111111", strokeWidth: 1.2 },
    };
    const movedPolygon: typeof polygon = {
      ...polygon,
      points: [
        { x: 0, y: 0 },
        { x: 6, y: 1 },
        { x: 5, y: 3 },
        { x: 0, y: 2 },
      ],
    };
    const synced = syncLinkedDiagram(model([movedPolygon, angle]), model([polygon, angle]));

    expect(synced.objects.find((object) => object.id === "angle")).toMatchObject({
      start: { x: 0, y: 0 },
      vertex: { x: 6, y: 1 },
      end: { x: 5, y: 3 },
    });
  });

  it("keeps polygons aligned to linked point ids", () => {
    const previous = model([polygon]);
    const pointA: Extract<DiagramObject, { type: "Point" }> = {
      id: "A",
      name: "A",
      type: "Point",
      visibility: true,
      coordinates: { x: 0, y: 0 },
      semanticRole: "main-object",
      style: { fill: "#111111", pointSize: 3.2 },
    };
    const pointB: typeof pointA = { ...pointA, id: "B", name: "B", coordinates: { x: 4, y: 0 } };
    const pointC: typeof pointA = { ...pointA, id: "C", name: "C", coordinates: { x: 4, y: 2 } };
    const linkedPolygon: typeof polygon = {
      ...polygon,
      pointIds: ["A", "B", "C"],
      points: [pointA.coordinates, pointB.coordinates, pointC.coordinates],
    };
    const movedPointB: typeof pointB = { ...pointB, coordinates: { x: 5, y: 1 } };
    const synced = syncLinkedDiagram(
      model([pointA, movedPointB, pointC, linkedPolygon]),
      model([pointA, pointB, pointC, linkedPolygon]),
    );

    expect(previous.objects).toHaveLength(1);
    expect(synced.objects.find((object) => object.id === "poly")).toMatchObject({
      points: [
        { x: 0, y: 0 },
        { x: 5, y: 1 },
        { x: 4, y: 2 },
      ],
    });
  });

  it("moves linked point ids when polygon vertices are edited", () => {
    const pointA: Extract<DiagramObject, { type: "Point" }> = {
      id: "A",
      name: "A",
      type: "Point",
      visibility: true,
      coordinates: { x: 0, y: 0 },
      semanticRole: "main-object",
      style: { fill: "#111111", pointSize: 3.2 },
    };
    const pointB: typeof pointA = { ...pointA, id: "B", name: "B", coordinates: { x: 4, y: 0 } };
    const pointC: typeof pointA = { ...pointA, id: "C", name: "C", coordinates: { x: 4, y: 2 } };
    const linkedPolygon: typeof polygon = {
      ...polygon,
      pointIds: ["A", "B", "C"],
      points: [pointA.coordinates, pointB.coordinates, pointC.coordinates],
    };
    const editedPolygon: typeof linkedPolygon = {
      ...linkedPolygon,
      points: [
        { x: -1, y: -1 },
        { x: 4, y: 0 },
        { x: 4, y: 2 },
      ],
    };
    const synced = syncLinkedDiagram(
      model([pointA, pointB, pointC, editedPolygon]),
      model([pointA, pointB, pointC, linkedPolygon]),
    );

    expect(synced.objects.find((object) => object.id === "A")).toMatchObject({
      coordinates: { x: -1, y: -1 },
    });
  });

  it("keeps point-based angle markers aligned to linked point anchors", () => {
    const pointA: Extract<DiagramObject, { type: "Point" }> = {
      id: "A",
      name: "A",
      type: "Point",
      visibility: true,
      coordinates: { x: 0, y: 0 },
      semanticRole: "main-object",
      style: { fill: "#111111", pointSize: 3.2 },
    };
    const pointB: typeof pointA = { ...pointA, id: "B", name: "B", coordinates: { x: 2, y: 0 } };
    const pointC: typeof pointA = { ...pointA, id: "C", name: "C", coordinates: { x: 0, y: 2 } };
    const angle: Extract<DiagramObject, { type: "Angle" }> = {
      id: "angle",
      name: "Angle",
      type: "Angle",
      visibility: true,
      start: pointB.coordinates,
      vertex: pointA.coordinates,
      end: pointC.coordinates,
      anchors: [
        { kind: "point", objectId: "B" },
        { kind: "point", objectId: "A" },
        { kind: "point", objectId: "C" },
      ],
      radius: 0.55,
      semanticRole: "theorem-label",
      style: { stroke: "#111111", strokeWidth: 1.2 },
    };
    const movedB: typeof pointB = { ...pointB, coordinates: { x: 3, y: 1 } };
    const synced = syncLinkedDiagram(model([pointA, movedB, pointC, angle]), model([pointA, pointB, pointC, angle]));

    expect(synced.objects.find((object) => object.id === "angle")).toMatchObject({
      start: { x: 3, y: 1 },
      vertex: { x: 0, y: 0 },
      end: { x: 0, y: 2 },
    });
  });

  it("keeps pen path pins aligned to linked point anchors", () => {
    const pointA: Extract<DiagramObject, { type: "Point" }> = {
      id: "A",
      name: "A",
      type: "Point",
      visibility: true,
      coordinates: { x: 0, y: 0 },
      semanticRole: "main-object",
      style: { fill: "#111111", pointSize: 3.2 },
    };
    const pointB: typeof pointA = { ...pointA, id: "B", name: "B", coordinates: { x: 2, y: 0 } };
    const penPath: Extract<DiagramObject, { type: "PenPath" }> = {
      id: "pen",
      name: "Pen",
      type: "PenPath",
      visibility: true,
      points: [pointA.coordinates, { x: 1, y: 1 }, pointB.coordinates],
      anchors: [{ kind: "point", objectId: "A" }, null, { kind: "point", objectId: "B" }],
      semanticRole: "main-object",
      style: { stroke: "#111111", fill: "transparent", strokeWidth: 1.25 },
    };
    const movedB: typeof pointB = { ...pointB, coordinates: { x: 3, y: 2 } };
    const synced = syncLinkedDiagram(model([pointA, movedB, penPath]), model([pointA, pointB, penPath]));

    expect(synced.objects.find((object) => object.id === "pen")).toMatchObject({
      points: [
        { x: 0, y: 0 },
        { x: 1, y: 1 },
        { x: 3, y: 2 },
      ],
    });
  });
});
