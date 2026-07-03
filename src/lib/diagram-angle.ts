import type { DiagramModel, DiagramObject, GeometryAnchor, PointCoordinate } from "./diagram-types";
import { resolveAnchorPoint } from "./diagram-links";

export interface AngleDraft {
  start: PointCoordinate;
  vertex: PointCoordinate;
  end: PointCoordinate;
  anchors: [GeometryAnchor | null, GeometryAnchor | null, GeometryAnchor | null];
  attachedObjectId?: string;
  attachedVertexIndex?: number;
}

interface RayCandidate {
  point: PointCoordinate;
  anchor: GeometryAnchor | null;
}

function pointAnchorFromId(pointId?: string): GeometryAnchor | null {
  return pointId ? { kind: "point", objectId: pointId } : null;
}

function anchorEquals(a: GeometryAnchor | null, b: GeometryAnchor | null): boolean {
  if (!a || !b) return false;
  return a.kind === b.kind && a.objectId === b.objectId && a.vertexIndex === b.vertexIndex;
}

function pointDistance(a: PointCoordinate, b: PointCoordinate): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function angleBetween(vertex: PointCoordinate, a: PointCoordinate, b: PointCoordinate): number {
  const first = Math.atan2(a.y - vertex.y, a.x - vertex.x);
  const second = Math.atan2(b.y - vertex.y, b.x - vertex.x);
  let delta = Math.abs(second - first);
  while (delta > Math.PI) delta = Math.abs(delta - Math.PI * 2);
  return delta;
}

function linearEndpointAnchors(object: Extract<DiagramObject, { type: "Line" | "Segment" | "Vector" }>): [GeometryAnchor | null, GeometryAnchor | null] {
  if (object.type === "Line") {
    return [
      object.anchors?.[0] ?? pointAnchorFromId(object.pointIds?.[0]),
      object.anchors?.[1] ?? pointAnchorFromId(object.pointIds?.[1]),
    ];
  }

  return [
    object.startAnchor ?? pointAnchorFromId(object.startPointId),
    object.endAnchor ?? pointAnchorFromId(object.endPointId),
  ];
}

function linearEndpointPoints(object: Extract<DiagramObject, { type: "Line" | "Segment" | "Vector" }>): [PointCoordinate, PointCoordinate] {
  if (object.type === "Line") return object.through;
  return [object.start, object.end];
}

function uniqueRays(rays: RayCandidate[], vertex: PointCoordinate): RayCandidate[] {
  return rays.filter((ray, index) => {
    if (pointDistance(ray.point, vertex) < 0.001) return false;

    return !rays.slice(0, index).some((previous) => {
      if (anchorEquals(previous.anchor, ray.anchor)) return true;
      return pointDistance(previous.point, ray.point) < 0.001;
    });
  });
}

function chooseAngleRays(rays: RayCandidate[], vertex: PointCoordinate): [RayCandidate, RayCandidate] | null {
  const candidates = uniqueRays(rays, vertex);
  if (candidates.length < 2) return null;

  let best: [RayCandidate, RayCandidate] = [candidates[0], candidates[1]];
  let bestAngle = angleBetween(vertex, best[0].point, best[1].point);

  for (let outer = 0; outer < candidates.length; outer += 1) {
    for (let inner = outer + 1; inner < candidates.length; inner += 1) {
      const angle = angleBetween(vertex, candidates[outer].point, candidates[inner].point);
      if (angle > bestAngle) {
        best = [candidates[outer], candidates[inner]];
        bestAngle = angle;
      }
    }
  }

  return best;
}

export function inferAngleAtAnchor(diagram: DiagramModel, anchor: GeometryAnchor): AngleDraft | null {
  const vertex = resolveAnchorPoint(diagram.objects, anchor);
  if (!vertex) return null;

  if (anchor.kind === "polygon-vertex" && anchor.vertexIndex !== undefined) {
    const polygon = diagram.objects.find((object) => object.id === anchor.objectId);
    if (polygon?.type !== "Polygon" || polygon.points.length < 3) return null;

    const vertexIndex = Math.max(0, Math.min(anchor.vertexIndex, polygon.points.length - 1));
    const previousIndex = (vertexIndex - 1 + polygon.points.length) % polygon.points.length;
    const nextIndex = (vertexIndex + 1) % polygon.points.length;

    return {
      start: polygon.points[previousIndex],
      vertex: polygon.points[vertexIndex],
      end: polygon.points[nextIndex],
      anchors: [
        { kind: "polygon-vertex", objectId: polygon.id, vertexIndex: previousIndex },
        { kind: "polygon-vertex", objectId: polygon.id, vertexIndex },
        { kind: "polygon-vertex", objectId: polygon.id, vertexIndex: nextIndex },
      ],
      attachedObjectId: polygon.id,
      attachedVertexIndex: vertexIndex,
    };
  }

  const rays: RayCandidate[] = [];

  diagram.objects.forEach((object) => {
    if (!object.visibility || (object.type !== "Line" && object.type !== "Segment" && object.type !== "Vector")) {
      return;
    }

    const anchors = linearEndpointAnchors(object);
    const points = linearEndpointPoints(object);
    const firstTouchesVertex = anchorEquals(anchors[0], anchor) || pointDistance(points[0], vertex) < 0.055;
    const secondTouchesVertex = anchorEquals(anchors[1], anchor) || pointDistance(points[1], vertex) < 0.055;

    if (firstTouchesVertex) {
      rays.push({ point: points[1], anchor: anchors[1] });
    }

    if (secondTouchesVertex) {
      rays.push({ point: points[0], anchor: anchors[0] });
    }
  });

  const selected = chooseAngleRays(rays, vertex);
  if (!selected) return null;

  return {
    start: selected[0].point,
    vertex,
    end: selected[1].point,
    anchors: [selected[0].anchor, anchor, selected[1].anchor],
  };
}

export function inferAngleAtPoint(diagram: DiagramModel, point: PointCoordinate): AngleDraft | null {
  const range = Math.max(
    diagram.viewport.maxX - diagram.viewport.minX,
    diagram.viewport.maxY - diagram.viewport.minY,
  );
  const tolerance = Math.max(range / 45, 0.12);
  const candidates: { anchor: GeometryAnchor; distance: number }[] = [];

  diagram.objects.forEach((object) => {
    if (!object.visibility) return;

    if (object.type === "Point") {
      const distance = pointDistance(point, object.coordinates);
      if (distance <= tolerance) {
        candidates.push({ anchor: { kind: "point", objectId: object.id }, distance });
      }
      return;
    }

    if (object.type === "Polygon") {
      object.points.forEach((vertex, vertexIndex) => {
        const distance = pointDistance(point, vertex);
        if (distance <= tolerance) {
          candidates.push({
            anchor: { kind: "polygon-vertex", objectId: object.id, vertexIndex },
            distance,
          });
        }
      });
    }
  });

  candidates.sort((a, b) => a.distance - b.distance);

  for (const candidate of candidates) {
    const draft = inferAngleAtAnchor(diagram, candidate.anchor);
    if (draft) return draft;
  }

  const looseEndpointDraft = inferLooseEndpointAngle(diagram, point, tolerance);
  if (looseEndpointDraft) return looseEndpointDraft;

  return null;
}

function inferLooseEndpointAngle(diagram: DiagramModel, point: PointCoordinate, tolerance: number): AngleDraft | null {
  const endpointHits: PointCoordinate[] = [];
  const rays: RayCandidate[] = [];

  diagram.objects.forEach((object) => {
    if (!object.visibility || (object.type !== "Line" && object.type !== "Segment" && object.type !== "Vector")) {
      return;
    }

    const anchors = linearEndpointAnchors(object);
    const points = linearEndpointPoints(object);
    const firstDistance = pointDistance(points[0], point);
    const secondDistance = pointDistance(points[1], point);

    if (firstDistance <= tolerance) {
      endpointHits.push(points[0]);
      rays.push({ point: points[1], anchor: anchors[1] });
    }

    if (secondDistance <= tolerance) {
      endpointHits.push(points[1]);
      rays.push({ point: points[0], anchor: anchors[0] });
    }
  });

  if (endpointHits.length < 2) return null;

  const vertex = endpointHits.reduce(
    (sum, hit) => ({ x: sum.x + hit.x / endpointHits.length, y: sum.y + hit.y / endpointHits.length }),
    { x: 0, y: 0 },
  );
  const selected = chooseAngleRays(rays, vertex);
  if (!selected) return null;

  return {
    start: selected[0].point,
    vertex: {
      x: Number(vertex.x.toFixed(3)),
      y: Number(vertex.y.toFixed(3)),
    },
    end: selected[1].point,
    anchors: [selected[0].anchor, null, selected[1].anchor],
  };
}
