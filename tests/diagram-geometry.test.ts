import { describe, expect, it } from "vitest";
import {
  angleRadiusHandlePoint,
  applyObjectGeometryPatch,
  insertPolygonVertex,
  mirrorObject,
  objectGeometry,
  rotateObject,
  updateObjectHandle,
} from "@/lib/diagram-geometry";
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

const penPath: Extract<DiagramObject, { type: "PenPath" }> = {
  id: "pen-1",
  name: "Pen 1",
  type: "PenPath",
  visibility: true,
  points: [
    { x: 0, y: 0 },
    { x: 2, y: 1 },
    { x: 4, y: 0 },
  ],
  semanticRole: "main-object",
  style: { stroke: "#111111", fill: "transparent", strokeWidth: 1.25 },
};

const angle: Extract<DiagramObject, { type: "Angle" }> = {
  id: "angle-1",
  name: "Angle 1",
  type: "Angle",
  visibility: true,
  start: { x: 4, y: 0 },
  vertex: { x: 0, y: 0 },
  end: { x: 0, y: 3 },
  radius: 0.55,
  semanticRole: "theorem-label",
  style: { stroke: "#111111", strokeWidth: 1.2 },
};

describe("diagram geometry helpers", () => {
  it("reports X and Y as the object center for bounded shapes", () => {
    expect(objectGeometry(rectangle)).toEqual({ x: 2, y: 1, w: 4, h: 2 });
  });

  it("moves bounded shapes by editing center X and Y", () => {
    const moved = applyObjectGeometryPatch(rectangle, { x: 5, y: 4 });

    expect(objectGeometry(moved)).toEqual({ x: 5, y: 4, w: 4, h: 2 });
  });

  it("resizes a centered square without coordinate offset", () => {
    const square = applyObjectGeometryPatch(rectangle, { x: 0, y: 0, w: 4, h: 4 });

    expect(square).toMatchObject({
      points: [
        { x: -2, y: -2 },
        { x: 2, y: -2 },
        { x: 2, y: 2 },
        { x: -2, y: 2 },
      ],
    });
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

  it("rotates a bounded shape around its center", () => {
    const rotated = rotateObject(rectangle, { x: 2, y: 1 }, Math.PI / 2);

    expect(rotated).toMatchObject({
      points: [
        { x: 3, y: -1 },
        { x: 3, y: 3 },
        { x: 1, y: 3 },
        { x: 1, y: -1 },
      ],
    });
  });

  it("mirrors a bounded shape from properties", () => {
    const mirrored = mirrorObject(rectangle, "horizontal");

    expect(mirrored).toMatchObject({
      points: [
        { x: 4, y: 0 },
        { x: 0, y: 0 },
        { x: 0, y: 2 },
        { x: 4, y: 2 },
      ],
    });
  });

  it("resizes pen paths from object geometry", () => {
    const resized = applyObjectGeometryPatch(penPath, { x: 0, y: 0, w: 2, h: 2 });

    expect(resized).toMatchObject({
      points: [
        { x: -1, y: -1 },
        { x: 0, y: 1 },
        { x: 1, y: -1 },
      ],
    });
  });

  it("places the angle radius handle on the arc bisector", () => {
    expect(angleRadiusHandlePoint(angle)).toEqual({ x: 0.389, y: 0.389 });
  });

  it("resizes angle arc radius without moving the angle rays", () => {
    const resized = updateObjectHandle(angle, "radius", { x: 1.2, y: 1.2 });
    const clamped = updateObjectHandle(angle, "radius", { x: 10, y: 10 });

    expect(resized).toMatchObject({
      start: angle.start,
      vertex: angle.vertex,
      end: angle.end,
      radius: 1.697,
    });
    expect(clamped).toMatchObject({
      radius: 2.76,
    });
  });
});
