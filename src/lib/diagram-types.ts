export type DiagramObjectType =
  | "Point"
  | "Segment"
  | "Line"
  | "Circle"
  | "Vector"
  | "Angle"
  | "Label"
  | "FunctionPlot"
  | "Polygon"
  | "PenPath";

export type DiagramKind = "geometry" | "physics" | "calculus" | "custom";

export type SemanticRole =
  | "main-object"
  | "construction-line"
  | "force-vector"
  | "velocity-vector"
  | "acceleration-vector"
  | "electric-field-vector"
  | "theorem-label"
  | "auxiliary-point"
  | "function-curve"
  | "area-region"
  | "axis"
  | "tangent-line";

export type LabelPosition =
  | "above"
  | "below"
  | "left"
  | "right"
  | "above-left"
  | "above-right"
  | "below-left"
  | "below-right"
  | "center";

export interface PointCoordinate {
  x: number;
  y: number;
}

export type GeometryAnchorKind = "point" | "polygon-vertex";

export interface GeometryAnchor {
  kind: GeometryAnchorKind;
  objectId: string;
  vertexIndex?: number;
}

export interface DiagramStyle {
  stroke?: string;
  fill?: string;
  strokeWidth?: number;
  dashed?: boolean;
  opacity?: number;
  pointSize?: number;
  fontSize?: number;
  labelPosition?: LabelPosition;
  arrow?: boolean;
}

export interface BaseDiagramObject {
  id: string;
  name: string;
  type: DiagramObjectType;
  label?: string;
  visibility: boolean;
  style: DiagramStyle;
  semanticRole: SemanticRole;
}

export interface PointObject extends BaseDiagramObject {
  type: "Point";
  coordinates: PointCoordinate;
}

export interface SegmentObject extends BaseDiagramObject {
  type: "Segment";
  start: PointCoordinate;
  end: PointCoordinate;
  startPointId?: string;
  endPointId?: string;
  startAnchor?: GeometryAnchor;
  endAnchor?: GeometryAnchor;
}

export interface LineObject extends BaseDiagramObject {
  type: "Line";
  through: [PointCoordinate, PointCoordinate];
  pointIds?: [string, string];
  anchors?: [GeometryAnchor | null, GeometryAnchor | null];
}

export interface CircleObject extends BaseDiagramObject {
  type: "Circle";
  center: PointCoordinate;
  centerPointId?: string;
  radius: number;
}

export interface VectorObject extends BaseDiagramObject {
  type: "Vector";
  start: PointCoordinate;
  end: PointCoordinate;
  startPointId?: string;
  endPointId?: string;
  startAnchor?: GeometryAnchor;
  endAnchor?: GeometryAnchor;
}

export interface AngleObject extends BaseDiagramObject {
  type: "Angle";
  start: PointCoordinate;
  vertex: PointCoordinate;
  end: PointCoordinate;
  pointIds?: [string, string, string];
  anchors?: [GeometryAnchor | null, GeometryAnchor | null, GeometryAnchor | null];
  attachedObjectId?: string;
  attachedVertexIndex?: number;
  radius: number;
}

export interface LabelObject extends BaseDiagramObject {
  type: "Label";
  position: PointCoordinate;
  text: string;
}

export interface FunctionPlotObject extends BaseDiagramObject {
  type: "FunctionPlot";
  expression: string;
  domain: [number, number];
  samples: PointCoordinate[];
}

export interface PolygonObject extends BaseDiagramObject {
  type: "Polygon";
  points: PointCoordinate[];
  pointIds?: string[];
}

export interface PenPathObject extends BaseDiagramObject {
  type: "PenPath";
  points: PointCoordinate[];
  anchors?: (GeometryAnchor | null)[];
  smooth?: boolean;
}

export type DiagramObject =
  | PointObject
  | SegmentObject
  | LineObject
  | CircleObject
  | VectorObject
  | AngleObject
  | LabelObject
  | FunctionPlotObject
  | PolygonObject
  | PenPathObject;

export interface DiagramViewport {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

export interface DiagramModel {
  id: string;
  name: string;
  description?: string;
  diagramType: DiagramKind;
  objects: DiagramObject[];
  viewport: DiagramViewport;
  gridVisible: boolean;
  coordinatesVisible?: boolean;
  metadata?: {
    source?: "sample" | "geogebra" | "manual";
    preset?: string;
    updatedAt?: string;
  };
}

export const DEFAULT_VIEWPORT: DiagramViewport = {
  minX: -1,
  maxX: 6,
  minY: -1,
  maxY: 5,
};

export function cloneDiagram(diagram: DiagramModel): DiagramModel {
  return structuredClone(diagram);
}

export function isPointObject(object: DiagramObject): object is PointObject {
  return object.type === "Point";
}

export function isVectorRole(role: SemanticRole): boolean {
  return (
    role === "force-vector" ||
    role === "velocity-vector" ||
    role === "acceleration-vector" ||
    role === "electric-field-vector"
  );
}
