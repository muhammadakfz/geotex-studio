import type { DiagramModel, DiagramObject, GeometryAnchor, PointCoordinate } from "./diagram-types";

type LinearObject = Extract<DiagramObject, { type: "Line" | "Segment" | "Vector" }>;

interface ConnectorEndpoint {
  anchor: GeometryAnchor | null;
  point: PointCoordinate;
  index: 0 | 1;
}

function roundPoint(point: PointCoordinate): PointCoordinate {
  return {
    x: Number(point.x.toFixed(3)),
    y: Number(point.y.toFixed(3)),
  };
}

function pointAnchorFromId(pointId?: string): GeometryAnchor | null {
  return pointId ? { kind: "point", objectId: pointId } : null;
}

function pointIdFromAnchor(anchor: GeometryAnchor | null): string | undefined {
  return anchor?.kind === "point" ? anchor.objectId : undefined;
}

function objectMap(objects: DiagramObject[]): Map<string, DiagramObject> {
  return new Map(objects.map((object) => [object.id, object]));
}

function changedObjectIds(previous: DiagramObject[], next: DiagramObject[]): Set<string> {
  const previousMap = objectMap(previous);
  const changed = new Set<string>();

  next.forEach((object) => {
    const previousObject = previousMap.get(object.id);
    if (!previousObject || JSON.stringify(previousObject) !== JSON.stringify(object)) {
      changed.add(object.id);
    }
  });

  return changed;
}

export function resolveAnchorPoint(objects: DiagramObject[], anchor: GeometryAnchor | null): PointCoordinate | null {
  if (!anchor) return null;

  const object = objects.find((item) => item.id === anchor.objectId);
  if (!object) return null;

  if (anchor.kind === "point" && object.type === "Point") {
    return object.coordinates;
  }

  if (anchor.kind === "polygon-vertex" && object.type === "Polygon" && anchor.vertexIndex !== undefined) {
    return object.points[anchor.vertexIndex] ?? null;
  }

  return null;
}

function linearEndpoints(object: LinearObject): ConnectorEndpoint[] {
  if (object.type === "Line") {
    return [
      {
        anchor: object.anchors?.[0] ?? pointAnchorFromId(object.pointIds?.[0]),
        point: object.through[0],
        index: 0,
      },
      {
        anchor: object.anchors?.[1] ?? pointAnchorFromId(object.pointIds?.[1]),
        point: object.through[1],
        index: 1,
      },
    ];
  }

  return [
    {
      anchor: object.startAnchor ?? pointAnchorFromId(object.startPointId),
      point: object.start,
      index: 0,
    },
    {
      anchor: object.endAnchor ?? pointAnchorFromId(object.endPointId),
      point: object.end,
      index: 1,
    },
  ];
}

function withLinearEndpoint(object: LinearObject, index: 0 | 1, point: PointCoordinate): LinearObject {
  const nextPoint = roundPoint(point);

  if (object.type === "Line") {
    return index === 0
      ? { ...object, through: [nextPoint, object.through[1]] }
      : { ...object, through: [object.through[0], nextPoint] };
  }

  return index === 0 ? { ...object, start: nextPoint } : { ...object, end: nextPoint };
}

function moveAnchorTarget(objects: DiagramObject[], anchor: GeometryAnchor, point: PointCoordinate): DiagramObject[] {
  const nextPoint = roundPoint(point);

  return objects.map((object) => {
    if (object.id !== anchor.objectId) return object;

    if (anchor.kind === "point" && object.type === "Point") {
      return { ...object, coordinates: nextPoint };
    }

    if (anchor.kind === "polygon-vertex" && object.type === "Polygon" && anchor.vertexIndex !== undefined) {
      return {
        ...object,
        points: object.points.map((item, index) => (index === anchor.vertexIndex ? nextPoint : item)),
      };
    }

    return object;
  });
}

function syncLinearObject(object: DiagramObject, objects: DiagramObject[]): DiagramObject {
  if (object.type !== "Line" && object.type !== "Segment" && object.type !== "Vector") return object;

  return linearEndpoints(object).reduce<LinearObject>((current, endpoint) => {
    const linkedPoint = resolveAnchorPoint(objects, endpoint.anchor);
    return linkedPoint ? withLinearEndpoint(current, endpoint.index, linkedPoint) : current;
  }, object);
}

function syncAttachedAngle(object: DiagramObject, objects: DiagramObject[]): DiagramObject {
  if (object.type !== "Angle") {
    return object;
  }

  if (object.anchors) {
    const [start, vertex, end] = object.anchors.map((anchor) => resolveAnchorPoint(objects, anchor));

    return {
      ...object,
      start: start ?? object.start,
      vertex: vertex ?? object.vertex,
      end: end ?? object.end,
    };
  }

  if (object.pointIds?.length === 3) {
    const [start, vertex, end] = object.pointIds.map((pointId) => resolveAnchorPoint(objects, pointAnchorFromId(pointId)));

    return {
      ...object,
      start: start ?? object.start,
      vertex: vertex ?? object.vertex,
      end: end ?? object.end,
    };
  }

  if (!object.attachedObjectId || object.attachedVertexIndex === undefined) {
    return object;
  }

  const attached = objects.find((item) => item.id === object.attachedObjectId);
  if (attached?.type !== "Polygon" || attached.points.length < 3) return object;

  const vertexIndex = Math.max(0, Math.min(object.attachedVertexIndex, attached.points.length - 1));

  return {
    ...object,
    start: attached.points[(vertexIndex - 1 + attached.points.length) % attached.points.length],
    vertex: attached.points[vertexIndex],
    end: attached.points[(vertexIndex + 1) % attached.points.length],
  };
}

function syncPolygonObject(object: DiagramObject, objects: DiagramObject[]): DiagramObject {
  if (object.type !== "Polygon" || !object.pointIds) {
    return object;
  }

  return {
    ...object,
    points: object.points.map((point, index) =>
      resolveAnchorPoint(objects, pointAnchorFromId(object.pointIds?.[index])) ?? point,
    ),
  };
}

function syncPenPath(object: DiagramObject, objects: DiagramObject[]): DiagramObject {
  if (object.type !== "PenPath" || !object.anchors) {
    return object;
  }

  return {
    ...object,
    points: object.points.map((point, index) => resolveAnchorPoint(objects, object.anchors?.[index] ?? null) ?? point),
  };
}

export function applyConnectorAnchors(
  object: DiagramObject,
  anchors: [GeometryAnchor | null, GeometryAnchor | null],
): DiagramObject {
  if (object.type === "Line") {
    const pointIds =
      anchors[0]?.kind === "point" && anchors[1]?.kind === "point"
        ? [anchors[0].objectId, anchors[1].objectId] as [string, string]
        : undefined;
    return { ...object, anchors, pointIds };
  }

  if (object.type === "Segment" || object.type === "Vector") {
    return {
      ...object,
      startAnchor: anchors[0] ?? undefined,
      endAnchor: anchors[1] ?? undefined,
      startPointId: pointIdFromAnchor(anchors[0]),
      endPointId: pointIdFromAnchor(anchors[1]),
    };
  }

  return object;
}

export function syncLinkedDiagram(diagram: DiagramModel, previousDiagram?: DiagramModel): DiagramModel {
  let objects = diagram.objects;
  const changedIds = previousDiagram ? changedObjectIds(previousDiagram.objects, objects) : new Set<string>();
  const initiallyChangedIds = new Set(changedIds);

  if (previousDiagram) {
    objects.forEach((object) => {
      if (
        object.type !== "Line" &&
        object.type !== "Segment" &&
        object.type !== "Vector" &&
        object.type !== "Polygon" &&
        object.type !== "PenPath"
      ) return;
      if (!changedIds.has(object.id)) return;

      if (object.type === "Polygon") {
        object.pointIds?.forEach((pointId, index) => {
          if (initiallyChangedIds.has(pointId)) return;
          const point = object.points[index];
          if (point) objects = moveAnchorTarget(objects, { kind: "point", objectId: pointId }, point);
        });
        return;
      }

      if (object.type === "PenPath") {
        object.anchors?.forEach((anchor, index) => {
          if (!anchor || initiallyChangedIds.has(anchor.objectId)) return;
          const point = object.points[index];
          if (point) objects = moveAnchorTarget(objects, anchor, point);
        });
        return;
      }

      linearEndpoints(object).forEach((endpoint) => {
        if (!endpoint.anchor || initiallyChangedIds.has(endpoint.anchor.objectId)) return;
        objects = moveAnchorTarget(objects, endpoint.anchor, endpoint.point);
      });
    });
  }

  objects = objects.map((object) => syncLinearObject(object, objects));
  objects = objects.map((object) => syncPolygonObject(object, objects));
  objects = objects.map((object) => syncAttachedAngle(object, objects));
  objects = objects.map((object) => syncPenPath(object, objects));

  return objects === diagram.objects ? diagram : { ...diagram, objects };
}
