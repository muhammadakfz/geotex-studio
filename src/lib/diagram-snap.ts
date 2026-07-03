import type { DiagramModel, DiagramObject, GeometryAnchor, PointCoordinate } from "./diagram-types";
import { applyConnectorAnchors } from "./diagram-links";
import type { AngleDraft } from "./diagram-angle";
import { type EditorTool, snapPoint } from "./diagram-editor";

export function pointDistance(a: PointCoordinate, b: PointCoordinate): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

export function closestPointOnSegment(point: PointCoordinate, start: PointCoordinate, end: PointCoordinate): PointCoordinate {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const lengthSquared = dx * dx + dy * dy;
  if (lengthSquared === 0) return start;

  const t = Math.max(0, Math.min(1, ((point.x - start.x) * dx + (point.y - start.y) * dy) / lengthSquared));
  return {
    x: Number((start.x + t * dx).toFixed(3)),
    y: Number((start.y + t * dy).toFixed(3)),
  };
}

export function closestPointOnLine(point: PointCoordinate, start: PointCoordinate, end: PointCoordinate): PointCoordinate {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const lengthSquared = dx * dx + dy * dy;
  if (lengthSquared === 0) return start;

  const t = ((point.x - start.x) * dx + (point.y - start.y) * dy) / lengthSquared;
  return {
    x: Number((start.x + t * dx).toFixed(3)),
    y: Number((start.y + t * dy).toFixed(3)),
  };
}

export function closestPointOnCircle(point: PointCoordinate, center: PointCoordinate, radius: number): PointCoordinate {
  const angle = Math.atan2(point.y - center.y, point.x - center.x);
  return {
    x: Number((center.x + Math.cos(angle) * radius).toFixed(3)),
    y: Number((center.y + Math.sin(angle) * radius).toFixed(3)),
  };
}

export interface ObjectSnapTarget {
  point: PointCoordinate;
  distance: number;
  objectId?: string;
  kind?: "point" | "segment" | "line" | "circle" | "polygon-edge" | "polygon-vertex" | "pen-edge" | "pen-vertex" | "pending-vertex";
  edgeIndex?: number;
  vertexIndex?: number;
}

export function findObjectSnapTarget(
  point: PointCoordinate,
  diagram: DiagramModel,
  extraSnapPoints: PointCoordinate[] = [],
): ObjectSnapTarget {
  const rangeX = diagram.viewport.maxX - diagram.viewport.minX;
  const rangeY = diagram.viewport.maxY - diagram.viewport.minY;
  const tolerance = Math.max(Math.max(rangeX, rangeY) / 55, 0.045);
  let nearest: ObjectSnapTarget = { point, distance: tolerance };

  function consider(candidate: PointCoordinate, target?: Omit<ObjectSnapTarget, "point" | "distance">) {
    const distance = pointDistance(point, candidate);
    if (distance < nearest.distance) {
      nearest = { point: candidate, distance, ...target };
    }
  }

  diagram.objects.forEach((object) => {
    if (!object.visibility) return;

    if (object.type === "Point") {
      consider(object.coordinates, { objectId: object.id, kind: "point" });
    } else if (object.type === "Segment" || object.type === "Vector") {
      consider(closestPointOnSegment(point, object.start, object.end), { objectId: object.id, kind: "segment" });
    } else if (object.type === "Line") {
      consider(closestPointOnLine(point, object.through[0], object.through[1]), { objectId: object.id, kind: "line" });
    } else if (object.type === "Circle") {
      consider(closestPointOnCircle(point, object.center, object.radius), { objectId: object.id, kind: "circle" });
    } else if (object.type === "Polygon") {
      object.points.forEach((vertex, vertexIndex) => {
        consider(vertex, { objectId: object.id, kind: "polygon-vertex", vertexIndex });
      });
      object.points.forEach((start, index) => {
        consider(
          closestPointOnSegment(point, start, object.points[(index + 1) % object.points.length]),
          { objectId: object.id, kind: "polygon-edge", edgeIndex: index },
        );
      });
    } else if (object.type === "PenPath") {
      object.points.forEach((vertex, vertexIndex) => {
        consider(vertex, { objectId: object.id, kind: "pen-vertex", vertexIndex });
      });
      object.points.slice(0, -1).forEach((start, index) => {
        consider(
          closestPointOnSegment(point, start, object.points[index + 1]),
          { objectId: object.id, kind: "pen-edge", edgeIndex: index },
        );
      });
    }
  });

  extraSnapPoints.forEach((extraPoint, vertexIndex) => {
    consider(extraPoint, { kind: "pending-vertex", vertexIndex });
  });

  return nearest;
}

export function anchorFromSnapTarget(target: ObjectSnapTarget): GeometryAnchor | null {
  if (!target.objectId) return null;

  if (target.kind === "point") {
    return { kind: "point", objectId: target.objectId };
  }

  if (target.kind === "polygon-vertex" && target.vertexIndex !== undefined) {
    return { kind: "polygon-vertex", objectId: target.objectId, vertexIndex: target.vertexIndex };
  }

  return null;
}

export function attachCreatedObject(
  object: DiagramObject,
  anchors: [GeometryAnchor | null, GeometryAnchor | null],
): DiagramObject {
  return applyConnectorAnchors(object, anchors);
}

export function pointIdsForAngle(anchors: AngleDraft["anchors"]): [string, string, string] | undefined {
  if (!anchors.every((anchor) => anchor?.kind === "point")) return undefined;
  return anchors.map((anchor) => anchor!.objectId) as [string, string, string];
}

export function createAngleObject(diagram: DiagramModel, draft: AngleDraft): Extract<DiagramObject, { type: "Angle" }> {
  const sequence = diagram.objects.length + 1;

  return {
    id: `angle-${sequence}-${Date.now()}`,
    name: `Angle ${sequence}`,
    type: "Angle",
    label: "",
    visibility: true,
    start: draft.start,
    vertex: draft.vertex,
    end: draft.end,
    pointIds: pointIdsForAngle(draft.anchors),
    anchors: draft.anchors,
    attachedObjectId: draft.attachedObjectId,
    attachedVertexIndex: draft.attachedVertexIndex,
    radius: 0.55,
    semanticRole: "theorem-label",
    style: { stroke: "#111111", strokeWidth: 1.2, labelPosition: "above-right" },
  };
}

export function isObjectSnapTool(tool: EditorTool): boolean {
  return ["point", "pen", "angle", "line", "segment", "vector", "triangle", "circle"].includes(tool);
}

export function snapCreationTarget(
  point: PointCoordinate,
  activeTool: EditorTool,
  diagram: DiagramModel,
  snapToGrid: boolean,
  snapStep: number,
  extraSnapPoints: PointCoordinate[] = [],
): { point: PointCoordinate; anchor: GeometryAnchor | null } {
  if (isObjectSnapTool(activeTool)) {
    const target = findObjectSnapTarget(point, diagram, extraSnapPoints);
    if (target.kind || pointDistance(point, target.point) > 0.0001) {
      return { point: target.point, anchor: anchorFromSnapTarget(target) };
    }
  }

  return { point: snapPoint(point, snapToGrid, snapStep), anchor: null };
}
