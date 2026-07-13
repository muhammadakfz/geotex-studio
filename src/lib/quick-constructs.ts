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
    .replace(/^[A-Za-z][A-Za-z0-9_]*\s*\(\s*x\s*\)\s*=/i, "")
    .trim();
}

function functionLabel(expression: string): string {
  const match = expression.trim().match(/^([A-Za-z][A-Za-z0-9_]*)\s*\(\s*x\s*\)\s*=/i);
  return match ? `${match[1]}(x)` : "f(x)";
}

function splitAssignment(expression: string): { name: string; body: string } | null {
  const match = expression.trim().match(/^([A-Za-z](?:[A-Za-z0-9_]*|_[0-9]+)?)\s*=\s*(.+)$/);
  if (!match) return null;

  const [, name, body] = match;
  if (/^[xy]$/i.test(name)) return null;
  return { name, body: body.trim() };
}

function splitArgs(rawArgs: string): string[] {
  return rawArgs
    .split(",")
    .map((arg) => arg.trim())
    .filter(Boolean);
}

function pointDistance(a: PointCoordinate, b: PointCoordinate): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
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
  const assignment = splitAssignment(expr);
  const commandExpr = assignment?.body ?? expr;
  const assignedName = assignment?.name;

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
  const pointsFromNames = (names: string[]): PointObj[] | null => {
    const found = names.map(findPoint);
    return found.every(Boolean) ? found as PointObj[] : null;
  };

  // Segment(A, B)
  const segmentMatch = commandExpr.match(/^Segment\s*\(\s*([A-Za-z0-9_]+)\s*,\s*([A-Za-z0-9_]+)\s*\)$/i);
  if (segmentMatch) {
    const p1 = findPoint(segmentMatch[1]);
    const p2 = findPoint(segmentMatch[2]);
    if (p1 && p2) {
      return {
        object: {
          id: makeId("segment", sequence),
          name: assignedName || `Segment ${segmentMatch[1]}${segmentMatch[2]}`,
          type: "Segment",
          label: assignedName,
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
  const lineMatch = commandExpr.match(/^Line\s*\(\s*([A-Za-z0-9_]+)\s*,\s*([A-Za-z0-9_]+)\s*\)$/i);
  if (lineMatch) {
    const p1 = findPoint(lineMatch[1]);
    const p2 = findPoint(lineMatch[2]);
    if (p1 && p2) {
      return {
        object: {
          id: makeId("line", sequence),
          name: assignedName || `Line ${lineMatch[1]}${lineMatch[2]}`,
          type: "Line",
          label: assignedName,
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
  const vectorMatch = commandExpr.match(/^Vector\s*\(\s*([A-Za-z0-9_]+)\s*,\s*([A-Za-z0-9_]+)\s*\)$/i);
  if (vectorMatch) {
    const p1 = findPoint(vectorMatch[1]);
    const p2 = findPoint(vectorMatch[2]);
    if (p1 && p2) {
      return {
        object: {
          id: makeId("vector", sequence),
          name: assignedName || `Vector ${vectorMatch[1]}${vectorMatch[2]}`,
          type: "Vector",
          label: assignedName ?? "",
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
  const circleMatch = commandExpr.match(/^Circle\s*\(\s*([A-Za-z0-9_]+)\s*,\s*([^)]+)\s*\)$/i);
  if (circleMatch) {
    const p1 = findPoint(circleMatch[1]);
    const radiusPoint = findPoint(circleMatch[2].trim());
    const radius = radiusPoint && p1 ? pointDistance(p1.coordinates, radiusPoint.coordinates) : parseFloat(circleMatch[2]);
    if (p1 && Number.isFinite(radius) && radius > 0) {
      return {
        object: {
          id: makeId("circle", sequence),
          name: assignedName || `Circle ${circleMatch[1]} r=${round(radius)}`,
          type: "Circle",
          label: assignedName,
          visibility: true,
          center: p1.coordinates,
          centerPointId: p1.id,
          radius: round(radius),
          semanticRole: "main-object",
          style: { stroke: "#111111", fill: "transparent", strokeWidth: 1.35 },
        },
      };
    }
    return { object: null, error: p1 ? "Circle radius is invalid." : "Point not found." };
  }

  const polygonMatch = commandExpr.match(/^Polygon\s*\((.+)\)$/i);
  if (polygonMatch) {
    const names = splitArgs(polygonMatch[1]);
    const polygonPoints = pointsFromNames(names);
    if (!polygonPoints || polygonPoints.length < 3) {
      return { object: null, error: "Polygon needs at least three existing points." };
    }

    return {
      object: {
        id: makeId("polygon", sequence),
        name: assignedName || `Polygon ${names.join("")}`,
        type: "Polygon",
        label: assignedName || names.join(""),
        visibility: true,
        points: polygonPoints.map((point) => point.coordinates),
        pointIds: polygonPoints.map((point) => point.id),
        semanticRole: "main-object",
        style: { stroke: "#111111", fill: "transparent", strokeWidth: 1.25 },
      },
    };
  }

  const angleMatch = commandExpr.match(/^Angle\s*\(\s*([A-Za-z0-9_]+)\s*,\s*([A-Za-z0-9_]+)\s*,\s*([A-Za-z0-9_]+)\s*\)$/i);
  if (angleMatch) {
    const p1 = findPoint(angleMatch[1]);
    const vertex = findPoint(angleMatch[2]);
    const p3 = findPoint(angleMatch[3]);
    if (!p1 || !vertex || !p3) {
      return { object: null, error: "Angle points not found." };
    }

    return {
      object: {
        id: makeId("angle", sequence),
        name: assignedName || `Angle ${angleMatch[1]}${angleMatch[2]}${angleMatch[3]}`,
        type: "Angle",
        label: assignedName ?? "",
        visibility: true,
        start: p1.coordinates,
        vertex: vertex.coordinates,
        end: p3.coordinates,
        pointIds: [p1.id, vertex.id, p3.id],
        anchors: [
          { kind: "point", objectId: p1.id },
          { kind: "point", objectId: vertex.id },
          { kind: "point", objectId: p3.id },
        ],
        radius: 0.55,
        semanticRole: "theorem-label",
        style: { stroke: "#111111", strokeWidth: 1.2, labelPosition: "above-right" },
      },
    };
  }

  const midpointMatch = commandExpr.match(/^Midpoint\s*\(\s*([A-Za-z0-9_]+)\s*,\s*([A-Za-z0-9_]+)\s*\)$/i);
  if (midpointMatch) {
    const p1 = findPoint(midpointMatch[1]);
    const p2 = findPoint(midpointMatch[2]);
    if (!p1 || !p2) {
      return { object: null, error: "Midpoint points not found." };
    }

    const name = assignedName || `M_${midpointMatch[1]}${midpointMatch[2]}`;
    return {
      object: {
        ...pointObject(makeId("point", sequence), name, {
          x: round((p1.coordinates.x + p2.coordinates.x) / 2),
          y: round((p1.coordinates.y + p2.coordinates.y) / 2),
        }),
        semanticRole: "auxiliary-point",
      },
    };
  }

  try {
    const plotExpression = assignment ? commandExpr : expression;
    const { normalizedExpression, samples } = sampleFunctionPlot(plotExpression, viewport);
    if (samples.length < 2) {
      return { object: null, error: "Expression has too few visible samples." };
    }

    const label = assignedName || functionLabel(expression);
    return {
      object: {
        id: makeId("function", sequence),
        name: `${label} ${sequence}`,
        type: "FunctionPlot",
        label,
        visibility: true,
        expression: stripFunctionPrefix(plotExpression),
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
