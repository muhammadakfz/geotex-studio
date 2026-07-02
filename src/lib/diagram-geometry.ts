import type { DiagramObject, PointCoordinate } from "./diagram-types";

export interface ObjectBounds {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

export interface ObjectGeometry {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface ObjectGeometryPatch {
  x?: number;
  y?: number;
  w?: number;
  h?: number;
}

const minSize = 0.01;

function round(value: number): number {
  return Number(value.toFixed(3));
}

function pointsBounds(points: PointCoordinate[], padding = 0): ObjectBounds {
  const xs = points.map((point) => point.x);
  const ys = points.map((point) => point.y);
  return {
    minX: Math.min(...xs) - padding,
    maxX: Math.max(...xs) + padding,
    minY: Math.min(...ys) - padding,
    maxY: Math.max(...ys) + padding,
  };
}

function normalizeBounds(bounds: ObjectBounds): ObjectBounds {
  return {
    minX: Math.min(bounds.minX, bounds.maxX),
    maxX: Math.max(bounds.minX, bounds.maxX),
    minY: Math.min(bounds.minY, bounds.maxY),
    maxY: Math.max(bounds.minY, bounds.maxY),
  };
}

export function objectBounds(object: DiagramObject): ObjectBounds {
  switch (object.type) {
    case "Point": {
      const pad = Math.max((object.style.pointSize ?? 3.2) / 42, 0.08);
      return pointsBounds([object.coordinates], pad);
    }
    case "Segment":
    case "Vector":
      return pointsBounds([object.start, object.end], 0.08);
    case "Line":
      return pointsBounds(object.through, 0.08);
    case "Circle":
      return {
        minX: object.center.x - object.radius,
        maxX: object.center.x + object.radius,
        minY: object.center.y - object.radius,
        maxY: object.center.y + object.radius,
      };
    case "Polygon":
      return pointsBounds(object.points, 0.08);
    case "Angle":
      return pointsBounds([object.start, object.vertex, object.end], 0.08);
    case "Label":
      return pointsBounds([object.position], 0.18);
    case "FunctionPlot":
      return pointsBounds(object.samples, 0.08);
  }
}

export function objectGeometry(object: DiagramObject): ObjectGeometry {
  if (object.type === "Point") {
    return { x: round(object.coordinates.x), y: round(object.coordinates.y), w: 0, h: 0 };
  }

  if (object.type === "Label") {
    return { x: round(object.position.x), y: round(object.position.y), w: 0, h: 0 };
  }

  const bounds = objectBounds(object);
  return {
    x: round((bounds.minX + bounds.maxX) / 2),
    y: round((bounds.minY + bounds.maxY) / 2),
    w: round(bounds.maxX - bounds.minX),
    h: round(bounds.maxY - bounds.minY),
  };
}

function scalePoint(point: PointCoordinate, from: ObjectBounds, to: ObjectBounds): PointCoordinate {
  const fromWidth = from.maxX - from.minX;
  const fromHeight = from.maxY - from.minY;
  const toWidth = to.maxX - to.minX;
  const toHeight = to.maxY - to.minY;

  const ratioX = Math.abs(fromWidth) < minSize ? 0.5 : (point.x - from.minX) / fromWidth;
  const ratioY = Math.abs(fromHeight) < minSize ? 0.5 : (point.y - from.minY) / fromHeight;

  return {
    x: round(to.minX + ratioX * toWidth),
    y: round(to.minY + ratioY * toHeight),
  };
}

export function translatePoint(point: PointCoordinate, dx: number, dy: number): PointCoordinate {
  return {
    x: round(point.x + dx),
    y: round(point.y + dy),
  };
}

export function translateObject(object: DiagramObject, dx: number, dy: number): DiagramObject {
  switch (object.type) {
    case "Point":
      return { ...object, coordinates: translatePoint(object.coordinates, dx, dy) };
    case "Segment":
    case "Vector":
      return { ...object, start: translatePoint(object.start, dx, dy), end: translatePoint(object.end, dx, dy) };
    case "Line":
      return { ...object, through: [translatePoint(object.through[0], dx, dy), translatePoint(object.through[1], dx, dy)] };
    case "Circle":
      return { ...object, center: translatePoint(object.center, dx, dy) };
    case "Polygon":
      return { ...object, points: object.points.map((point) => translatePoint(point, dx, dy)) };
    case "Angle":
      return {
        ...object,
        start: translatePoint(object.start, dx, dy),
        vertex: translatePoint(object.vertex, dx, dy),
        end: translatePoint(object.end, dx, dy),
      };
    case "Label":
      return { ...object, position: translatePoint(object.position, dx, dy) };
    case "FunctionPlot":
      return {
        ...object,
        domain: [round(object.domain[0] + dx), round(object.domain[1] + dx)],
        samples: object.samples.map((point) => translatePoint(point, dx, dy)),
      };
  }
}

export function insertPolygonVertex(
  object: Extract<DiagramObject, { type: "Polygon" }>,
  edgeIndex: number,
  point: PointCoordinate,
): Extract<DiagramObject, { type: "Polygon" }> {
  const index = Math.max(0, Math.min(edgeIndex, object.points.length - 1));
  return {
    ...object,
    points: [
      ...object.points.slice(0, index + 1),
      { x: round(point.x), y: round(point.y) },
      ...object.points.slice(index + 1),
    ],
  };
}

export function resizeObjectToBounds(object: DiagramObject, rawBounds: ObjectBounds): DiagramObject {
  const target = normalizeBounds(rawBounds);
  const source = objectBounds(object);
  const width = Math.max(minSize, target.maxX - target.minX);
  const height = Math.max(minSize, target.maxY - target.minY);

  switch (object.type) {
    case "Point":
      return {
        ...object,
        coordinates: {
          x: round(target.minX + width / 2),
          y: round(target.minY + height / 2),
        },
      };
    case "Label":
      return {
        ...object,
        position: {
          x: round(target.minX + width / 2),
          y: round(target.minY + height / 2),
        },
      };
    case "Circle": {
      const radius = Math.max(width, height) / 2;
      return {
        ...object,
        center: {
          x: round(target.minX + width / 2),
          y: round(target.minY + height / 2),
        },
        radius: round(radius),
      };
    }
    case "Segment":
    case "Vector":
      return {
        ...object,
        start: scalePoint(object.start, source, target),
        end: scalePoint(object.end, source, target),
      };
    case "Line":
      return {
        ...object,
        through: [scalePoint(object.through[0], source, target), scalePoint(object.through[1], source, target)],
      };
    case "Polygon":
      return { ...object, points: object.points.map((point) => scalePoint(point, source, target)) };
    case "Angle":
      return {
        ...object,
        start: scalePoint(object.start, source, target),
        vertex: scalePoint(object.vertex, source, target),
        end: scalePoint(object.end, source, target),
      };
    case "FunctionPlot": {
      const samples = object.samples.map((point) => scalePoint(point, source, target));
      return {
        ...object,
        domain: [samples[0]?.x ?? object.domain[0], samples[samples.length - 1]?.x ?? object.domain[1]],
        samples,
      };
    }
  }
}

export function updateObjectHandle(object: DiagramObject, handle: string, point: PointCoordinate): DiagramObject {
  const nextPoint = { x: round(point.x), y: round(point.y) };

  if (handle.startsWith("bounds-")) {
    const bounds = objectBounds(object);
    const next = { ...bounds };
    const direction = handle.replace("bounds-", "");

    if (direction.includes("w")) next.minX = nextPoint.x;
    if (direction.includes("e")) next.maxX = nextPoint.x;
    if (direction.includes("s")) next.minY = nextPoint.y;
    if (direction.includes("n")) next.maxY = nextPoint.y;

    return resizeObjectToBounds(object, next);
  }

  switch (object.type) {
    case "Point":
      return { ...object, coordinates: nextPoint };
    case "Segment":
    case "Vector":
      return handle === "start" ? { ...object, start: nextPoint } : { ...object, end: nextPoint };
    case "Line":
      return handle === "through-0"
        ? { ...object, through: [nextPoint, object.through[1]] }
        : { ...object, through: [object.through[0], nextPoint] };
    case "Circle":
      if (handle === "center") return { ...object, center: nextPoint };
      return {
        ...object,
        radius: round(Math.max(0.05, Math.hypot(nextPoint.x - object.center.x, nextPoint.y - object.center.y))),
      };
    case "Polygon": {
      const index = Number(handle.replace("vertex-", ""));
      return {
        ...object,
        points: object.points.map((item, itemIndex) => (itemIndex === index ? nextPoint : item)),
      };
    }
    case "Angle":
      if (handle === "start") return { ...object, start: nextPoint };
      if (handle === "vertex") return { ...object, vertex: nextPoint };
      return { ...object, end: nextPoint };
    case "Label":
      return { ...object, position: nextPoint };
    case "FunctionPlot":
      return object;
  }
}

export function applyObjectGeometryPatch(object: DiagramObject, patch: ObjectGeometryPatch): DiagramObject {
  if (object.type === "Point") {
    return {
      ...object,
      coordinates: {
        x: round(patch.x ?? object.coordinates.x),
        y: round(patch.y ?? object.coordinates.y),
      },
    };
  }

  if (object.type === "Label") {
    return {
      ...object,
      position: {
        x: round(patch.x ?? object.position.x),
        y: round(patch.y ?? object.position.y),
      },
    };
  }

  const current = objectGeometry(object);
  const centerX = patch.x ?? current.x;
  const centerY = patch.y ?? current.y;
  const width = Math.max(minSize, patch.w ?? current.w);
  const height = Math.max(minSize, patch.h ?? current.h);

  return resizeObjectToBounds(object, {
    minX: centerX - width / 2,
    minY: centerY - height / 2,
    maxX: centerX + width / 2,
    maxY: centerY + height / 2,
  });
}
