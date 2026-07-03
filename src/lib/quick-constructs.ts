import type { DiagramObject, DiagramViewport, PointCoordinate } from "./diagram-types";

type PointDiagramObject = Extract<DiagramObject, { type: "Point" }>;

export type QuickConstructKind = "right-triangle" | "free-body" | "vector-basis";

export interface FunctionPlotResult {
  object: DiagramObject | null;
  error?: string;
}

const mathFunctions = [
  "abs",
  "acos",
  "asin",
  "atan",
  "ceil",
  "cos",
  "exp",
  "floor",
  "log",
  "max",
  "min",
  "pow",
  "round",
  "sin",
  "sqrt",
  "tan",
];

function makeId(prefix: string, sequence: number, offset = 0): string {
  return `${prefix}-${sequence + offset}-${Date.now()}`;
}

function round(value: number): number {
  return Number(value.toFixed(3));
}

function stripFunctionPrefix(expression: string): string {
  return expression
    .trim()
    .replace(/^y\s*=/i, "")
    .replace(/^f\s*\(\s*x\s*\)\s*=/i, "")
    .trim();
}

function addImplicitMultiplication(expression: string): string {
  const functionPattern = mathFunctions.join("|");
  return expression
    .replace(/(\d|\))\s*(x\b|pi\b|e\b)/gi, "$1*$2")
    .replace(new RegExp(`(\\d|\\))\\s*(${functionPattern})\\s*\\(`, "gi"), "$1*$2(")
    .replace(/\)\s*(?=(\d|x\b|pi\b|e\b))/gi, ")*");
}

export function normalizeFunctionExpression(rawExpression: string): string {
  const stripped = addImplicitMultiplication(stripFunctionPrefix(rawExpression).replaceAll("^", "**"));
  if (!stripped) {
    throw new Error("Enter an expression.");
  }

  const identifiers = stripped.match(/[A-Za-z_][A-Za-z0-9_]*/g) ?? [];
  const allowed = new Set(["x", "pi", "e", "ln", ...mathFunctions]);
  const unknown = identifiers.find((identifier) => !allowed.has((identifier ?? "").toLowerCase()));
  if (unknown) {
    throw new Error(`Unknown symbol: ${unknown}`);
  }

  return stripped
    .replace(/\bln\s*\(/gi, "Math.log(")
    .replace(/\bpi\b/gi, "Math.PI")
    .replace(/\be\b/g, "Math.E")
    .replace(new RegExp(`\\b(${mathFunctions.join("|")})\\s*\\(`, "gi"), (match, name: string) => {
      return `Math.${(name ?? "").toLowerCase()}(`;
    });
}

export function sampleFunctionPlot(
  expression: string,
  viewport: DiagramViewport,
  sampleCount = 180,
): { normalizedExpression: string; samples: PointCoordinate[] } {
  const normalizedExpression = normalizeFunctionExpression(expression);
  const evaluate = new Function("x", `"use strict"; return (${normalizedExpression});`) as (x: number) => number;
  const minX = viewport.minX;
  const maxX = viewport.maxX;
  const samples: PointCoordinate[] = [];

  for (let index = 0; index < sampleCount; index += 1) {
    const ratio = sampleCount === 1 ? 0 : index / (sampleCount - 1);
    const x = minX + (maxX - minX) * ratio;
    const y = evaluate(x);

    if (Number.isFinite(y)) {
      samples.push({ x: round(x), y: round(y) });
    }
  }

  return { normalizedExpression, samples };
}

export function createFunctionPlotObject(
  expression: string,
  viewport: DiagramViewport,
  objects: DiagramObject[],
): FunctionPlotResult {
  const sequence = objects.length + 1;
  const expr = expression.trim();

  // Parse points like A=(1,2) or (1,2)
  const pointMatch = expr.match(/^(?:([A-Za-z](?:_[0-9]+)?)\s*=\s*)?\(\s*([+-]?[0-9]*\.?[0-9]+)\s*,\s*([+-]?[0-9]*\.?[0-9]+)\s*\)$/);
  if (pointMatch) {
    const [, nameGroup, xStr, yStr] = pointMatch;
    const name = nameGroup || `P_${sequence}`;
    const x = parseFloat(xStr);
    const y = parseFloat(yStr);
    return {
      object: pointObject(makeId("point", sequence), name, { x, y }),
    };
  }

  // Parse lines like x=3 or y=4
  const verticalLineMatch = expr.match(/^x\s*=\s*([+-]?[0-9]*\.?[0-9]+)$/);
  if (verticalLineMatch) {
    const x = parseFloat(verticalLineMatch[1]);
    return {
      object: {
        id: makeId("line", sequence),
        name: `Line x=${x}`,
        type: "Line",
        label: `x=${x}`,
        visibility: true,
        through: [{ x, y: 0 }, { x, y: 1 }],
        semanticRole: "construction-line",
        style: { stroke: "#111111", strokeWidth: 1.35 },
      },
    };
  }

  type PointObj = Extract<DiagramObject, { type: "Point" }>;
  const findPoint = (name: string) => objects.find((o) => (o.id === name || o.name === name || o.label === name) && o.type === "Point") as PointObj | undefined;

  // Segment(A, B)
  const segmentMatch = expr.match(/^Segment\s*\(\s*([A-Za-z0-9_]+)\s*,\s*([A-Za-z0-9_]+)\s*\)$/i);
  if (segmentMatch) {
    const p1 = findPoint(segmentMatch[1]);
    const p2 = findPoint(segmentMatch[2]);
    if (p1 && p2) {
      return {
        object: {
          id: makeId("segment", sequence),
          name: `Segment ${segmentMatch[1]}${segmentMatch[2]}`,
          type: "Segment",
          visibility: true,
          start: p1.coordinates,
          end: p2.coordinates,
          startPointId: p1.id,
          endPointId: p2.id,
          startAnchor: { kind: "point", objectId: p1.id },
          endAnchor: { kind: "point", objectId: p2.id },
          semanticRole: "main-object",
          style: { stroke: "#111111", strokeWidth: 1.35 },
        },
      };
    }
    return { object: null, error: "Points not found." };
  }

  // Line(A, B)
  const lineMatch = expr.match(/^Line\s*\(\s*([A-Za-z0-9_]+)\s*,\s*([A-Za-z0-9_]+)\s*\)$/i);
  if (lineMatch) {
    const p1 = findPoint(lineMatch[1]);
    const p2 = findPoint(lineMatch[2]);
    if (p1 && p2) {
      return {
        object: {
          id: makeId("line", sequence),
          name: `Line ${lineMatch[1]}${lineMatch[2]}`,
          type: "Line",
          visibility: true,
          through: [p1.coordinates, p2.coordinates],
          pointIds: [p1.id, p2.id],
          anchors: [
            { kind: "point", objectId: p1.id },
            { kind: "point", objectId: p2.id },
          ],
          semanticRole: "construction-line",
          style: { stroke: "#111111", strokeWidth: 1 },
        },
      };
    }
    return { object: null, error: "Points not found." };
  }

  // Vector(A, B)
  const vectorMatch = expr.match(/^Vector\s*\(\s*([A-Za-z0-9_]+)\s*,\s*([A-Za-z0-9_]+)\s*\)$/i);
  if (vectorMatch) {
    const p1 = findPoint(vectorMatch[1]);
    const p2 = findPoint(vectorMatch[2]);
    if (p1 && p2) {
      return {
        object: {
          id: makeId("vector", sequence),
          name: `Vector ${vectorMatch[1]}${vectorMatch[2]}`,
          type: "Vector",
          label: "",
          visibility: true,
          start: p1.coordinates,
          end: p2.coordinates,
          startPointId: p1.id,
          endPointId: p2.id,
          startAnchor: { kind: "point", objectId: p1.id },
          endAnchor: { kind: "point", objectId: p2.id },
          semanticRole: "force-vector",
          style: { stroke: "#111111", strokeWidth: 1.6, arrow: true, labelPosition: "above-right" },
        },
      };
    }
    return { object: null, error: "Points not found." };
  }

  // Circle(A, radius)
  const circleMatch = expr.match(/^Circle\s*\(\s*([A-Za-z0-9_]+)\s*,\s*([+-]?[0-9]*\.?[0-9]+)\s*\)$/i);
  if (circleMatch) {
    const p1 = findPoint(circleMatch[1]);
    const radius = parseFloat(circleMatch[2]);
    if (p1) {
      return {
        object: {
          id: makeId("circle", sequence),
          name: `Circle ${circleMatch[1]} r=${radius}`,
          type: "Circle",
          visibility: true,
          center: p1.coordinates,
          centerPointId: p1.id,
          radius,
          semanticRole: "main-object",
          style: { stroke: "#111111", fill: "transparent", strokeWidth: 1.35 },
        },
      };
    }
    return { object: null, error: "Point not found." };
  }

  try {
    const { normalizedExpression, samples } = sampleFunctionPlot(expression, viewport);
    if (samples.length < 2) {
      return { object: null, error: "Expression has too few visible samples." };
    }

    return {
      object: {
        id: makeId("function", sequence),
        name: `f(x) ${sequence}`,
        type: "FunctionPlot",
        label: "f(x)",
        visibility: true,
        expression: stripFunctionPrefix(expression),
        domain: [viewport.minX, viewport.maxX],
        samples,
        semanticRole: "function-curve",
        style: { stroke: "#111111", strokeWidth: 1.35, labelPosition: "above-right" },
      },
      error: normalizedExpression ? undefined : "Invalid expression.",
    };
  } catch (error) {
    return { object: null, error: error instanceof Error ? error.message : "Invalid expression." };
  }
}

function pointObject(
  id: string,
  name: string,
  coordinates: PointCoordinate,
  labelPosition: DiagramObject["style"]["labelPosition"] = "above-right",
): PointDiagramObject {
  return {
    id,
    name,
    type: "Point",
    label: name,
    visibility: true,
    coordinates,
    semanticRole: "main-object",
    style: { fill: "#111111", pointSize: 3.2, labelPosition },
  };
}

export function createQuickConstruct(kind: QuickConstructKind, objects: DiagramObject[]): DiagramObject[] {
  const sequence = objects.length + 1;

  if (kind === "right-triangle") {
    const pointA = pointObject(makeId("point-a", sequence), "A", { x: 0, y: 0 }, "below-left");
    const pointB = pointObject(makeId("point-b", sequence), "B", { x: 4, y: 0 }, "below-right");
    const pointC = pointObject(makeId("point-c", sequence), "C", { x: 0, y: 3 }, "above-left");

    return [
      pointA,
      pointB,
      pointC,
      {
        id: makeId("right-triangle", sequence, 3),
        name: "Right triangle ABC",
        type: "Polygon",
        label: "ABC",
        visibility: true,
        points: [pointA.coordinates, pointB.coordinates, pointC.coordinates],
        pointIds: [pointA.id, pointB.id, pointC.id],
        semanticRole: "main-object",
        style: { stroke: "#111111", fill: "transparent", strokeWidth: 1.25 },
      },
      {
        id: makeId("right-angle", sequence, 4),
        name: "Right angle A",
        type: "Angle",
        label: "90^\\circ",
        visibility: true,
        start: pointB.coordinates,
        vertex: pointA.coordinates,
        end: pointC.coordinates,
        anchors: [
          { kind: "point", objectId: pointB.id },
          { kind: "point", objectId: pointA.id },
          { kind: "point", objectId: pointC.id },
        ],
        pointIds: [pointB.id, pointA.id, pointC.id],
        radius: 0.45,
        semanticRole: "theorem-label",
        style: { stroke: "#111111", strokeWidth: 1.1, labelPosition: "above-right" },
      },
    ];
  }

  if (kind === "free-body") {
    const center = { x: 0, y: 0 };
    return [
      {
        id: makeId("body", sequence),
        name: "Body",
        type: "Circle",
        label: "m",
        visibility: true,
        center,
        radius: 0.36,
        semanticRole: "main-object",
        style: { stroke: "#111111", fill: "transparent", strokeWidth: 1.25, labelPosition: "center" },
      },
      {
        id: makeId("normal", sequence, 1),
        name: "Normal",
        type: "Vector",
        label: "N",
        visibility: true,
        start: center,
        end: { x: 0, y: 2 },
        semanticRole: "force-vector",
        style: { stroke: "#111111", strokeWidth: 1.5, arrow: true, labelPosition: "above-right" },
      },
      {
        id: makeId("weight", sequence, 2),
        name: "Weight",
        type: "Vector",
        label: "mg",
        visibility: true,
        start: center,
        end: { x: 0, y: -2 },
        semanticRole: "force-vector",
        style: { stroke: "#111111", strokeWidth: 1.5, arrow: true, labelPosition: "below-right" },
      },
      {
        id: makeId("force", sequence, 3),
        name: "Applied force",
        type: "Vector",
        label: "F",
        visibility: true,
        start: center,
        end: { x: 2.2, y: 0 },
        semanticRole: "force-vector",
        style: { stroke: "#111111", strokeWidth: 1.5, arrow: true, labelPosition: "above-right" },
      },
    ];
  }

  const origin = pointObject(makeId("origin", sequence), "O", { x: 0, y: 0 }, "below-left");
  return [
    origin,
    {
      id: makeId("basis-i", sequence, 1),
      name: "Basis i",
      type: "Vector",
      label: "\\vec{i}",
      visibility: true,
      start: origin.coordinates,
      end: { x: 2, y: 0 },
      startPointId: origin.id,
      startAnchor: { kind: "point", objectId: origin.id },
      semanticRole: "force-vector",
      style: { stroke: "#111111", strokeWidth: 1.35, arrow: true, labelPosition: "below-right" },
    },
    {
      id: makeId("basis-j", sequence, 2),
      name: "Basis j",
      type: "Vector",
      label: "\\vec{j}",
      visibility: true,
      start: origin.coordinates,
      end: { x: 0, y: 2 },
      startPointId: origin.id,
      startAnchor: { kind: "point", objectId: origin.id },
      semanticRole: "force-vector",
      style: { stroke: "#111111", strokeWidth: 1.35, arrow: true, labelPosition: "above-left" },
    },
  ];
}
