import type { DiagramModel, DiagramObject, PointCoordinate } from "./diagram-types";

export type EditorTool =
  | "select"
  | "hand"
  | "point"
  | "segment"
  | "circle"
  | "rectangle"
  | "triangle"
  | "vector"
  | "label";

export interface CreatedObjectResult {
  object: DiagramObject | null;
  pendingPoints: PointCoordinate[];
}

export function snapPoint(point: PointCoordinate, enabled: boolean, step = 0.5): PointCoordinate {
  if (!enabled) return roundPoint(point);

  return {
    x: Number((Math.round(point.x / step) * step).toFixed(2)),
    y: Number((Math.round(point.y / step) * step).toFixed(2)),
  };
}

export function roundPoint(point: PointCoordinate): PointCoordinate {
  return {
    x: Number(point.x.toFixed(2)),
    y: Number(point.y.toFixed(2)),
  };
}

export function createBlankDiagram(): DiagramModel {
  return {
    id: "untitled-figure",
    name: "Untitled Figure",
    description: "Semantic mathematical figure.",
    diagramType: "custom",
    gridVisible: true,
    coordinatesVisible: true,
    viewport: { minX: -5, maxX: 5, minY: -3.5, maxY: 3.5 },
    metadata: { source: "manual", preset: "thesis-paper" },
    objects: [],
  };
}

export function nextPointLabel(objects: DiagramObject[]): string {
  const used = new Set(
    objects
      .filter((object) => object.type === "Point")
      .map((object) => (object.label ?? object.name).replace(/\$/g, "")),
  );

  for (let index = 0; index < 26; index += 1) {
    const label = String.fromCharCode(65 + index);
    if (!used.has(label)) return label;
  }

  return `P_${objects.filter((object) => object.type === "Point").length + 1}`;
}

export function createObjectFromTool(
  tool: EditorTool,
  point: PointCoordinate,
  pendingPoints: PointCoordinate[],
  objects: DiagramObject[],
  labelInput: string,
): CreatedObjectResult {
  const sequence = objects.length + 1;
  const label = labelInput.trim();

  if (tool === "select" || tool === "hand") {
    return { object: null, pendingPoints: [] };
  }

  if (tool === "point") {
    const name = label || nextPointLabel(objects);
    return {
      pendingPoints: [],
      object: {
        id: `point-${sequence}-${Date.now()}`,
        name,
        type: "Point",
        label: name,
        visibility: true,
        coordinates: point,
        semanticRole: "main-object",
        style: { fill: "#111111", pointSize: 3.2, labelPosition: "above-right" },
      },
    };
  }

  if (tool === "label") {
    const text = label || `L_${sequence}`;
    return {
      pendingPoints: [],
      object: {
        id: `label-${sequence}-${Date.now()}`,
        name: `Label ${sequence}`,
        type: "Label",
        label: text,
        text,
        visibility: true,
        position: point,
        semanticRole: "theorem-label",
        style: { fontSize: 13, labelPosition: "above-right" },
      },
    };
  }

  if (pendingPoints.length === 0) {
    return { object: null, pendingPoints: [point] };
  }

  const start = pendingPoints[0];

  if (tool === "segment") {
    return {
      pendingPoints: [],
      object: {
        id: `segment-${sequence}-${Date.now()}`,
        name: label || `Segment ${sequence}`,
        type: "Segment",
        label,
        visibility: true,
        start,
        end: point,
        semanticRole: "main-object",
        style: { stroke: "#111111", strokeWidth: 1.2 },
      },
    };
  }

  if (tool === "vector") {
    return {
      pendingPoints: [],
      object: {
        id: `vector-${sequence}-${Date.now()}`,
        name: label || `Vector ${sequence}`,
        type: "Vector",
        label: label || "F",
        visibility: true,
        start,
        end: point,
        semanticRole: "force-vector",
        style: { stroke: "#111111", strokeWidth: 1.6, arrow: true, labelPosition: "above-right" },
      },
    };
  }

  if (tool === "rectangle") {
    const minX = Math.min(start.x, point.x);
    const maxX = Math.max(start.x, point.x);
    const minY = Math.min(start.y, point.y);
    const maxY = Math.max(start.y, point.y);
    return {
      pendingPoints: [],
      object: {
        id: `rectangle-${sequence}-${Date.now()}`,
        name: label || `Rectangle ${sequence}`,
        type: "Polygon",
        label,
        visibility: true,
        points: [
          { x: minX, y: minY },
          { x: maxX, y: minY },
          { x: maxX, y: maxY },
          { x: minX, y: maxY },
        ],
        semanticRole: "area-region",
        style: { stroke: "#111111", fill: "transparent", strokeWidth: 1.2 },
      },
    };
  }

  if (tool === "triangle") {
    if (pendingPoints.length < 2) {
      return { object: null, pendingPoints: [...pendingPoints, point] };
    }

    return {
      pendingPoints: [],
      object: {
        id: `triangle-${sequence}-${Date.now()}`,
        name: label || `Triangle ${sequence}`,
        type: "Polygon",
        label,
        visibility: true,
        points: [pendingPoints[0], pendingPoints[1], point],
        semanticRole: "area-region",
        style: { stroke: "#111111", fill: "transparent", strokeWidth: 1.2 },
      },
    };
  }

  if (tool !== "circle") {
    return { object: null, pendingPoints: [] };
  }

  const radius = Math.hypot(point.x - start.x, point.y - start.y);
  return {
    pendingPoints: [],
    object: {
      id: `circle-${sequence}-${Date.now()}`,
      name: label || `Circle ${sequence}`,
      type: "Circle",
      label,
      visibility: true,
      center: start,
      radius: Number(radius.toFixed(2)),
      semanticRole: "main-object",
      style: { stroke: "#111111", strokeWidth: 1.1 },
    },
  };
}
