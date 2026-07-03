import type {
  AngleObject,
  DiagramModel,
  DiagramObject,
  FunctionPlotObject,
  LabelPosition,
  PenPathObject,
  PointCoordinate,
  PointObject,
} from "./diagram-types";
import { normalizeLatexLabel, unwrapMathLabel, wrapMathLabel } from "./latex-normalizer";
import { sampleFunctionPlot } from "./quick-constructs";

export interface TikzExport {
  code: string;
  requiredPackages: string[];
  pureTikz: boolean;
  usesPgfplots: boolean;
}

export interface TikzExportOptions {
  includeCartesian?: boolean;
}

function sanitizeName(name: string): string {
  const fallback = name || "coord";
  return fallback.replace(/[^a-zA-Z0-9_]/g, "").replace(/^([0-9])/, "P$1") || "coord";
}

function formatNumber(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(2).replace(/0+$/, "").replace(/\.$/, "");
}

function formatPoint(point: PointCoordinate): string {
  return `(${formatNumber(point.x)},${formatNumber(point.y)})`;
}

function normalizeHexColor(color?: string): string | null {
  if (!color || color === "transparent") return null;
  const match = color.match(/^#([0-9a-fA-F]{6})$/);
  return match ? match[1].toUpperCase() : null;
}

function collectColorDefinitions(diagram: DiagramModel): Map<string, string> {
  const colors = new Map<string, string>();
  let index = 1;

  diagram.objects.forEach((object) => {
    [object.style.stroke, object.style.fill].forEach((color) => {
      const hex = normalizeHexColor(color);
      if (!hex || hex === "111111" || hex === "000000" || hex === "FFFFFF") return;
      if (!colors.has(hex)) {
        colors.set(hex, `gtcolor${index}`);
        index += 1;
      }
    });
  });

  return colors;
}

function tikzColor(color: string | undefined, colors: Map<string, string>): string | null {
  const hex = normalizeHexColor(color);
  if (!hex) return null;
  if (hex === "111111" || hex === "000000") return "black";
  if (hex === "FFFFFF") return "white";
  return colors.get(hex) ?? null;
}

function pointMap(diagram: DiagramModel): Map<string, PointObject> {
  const map = new Map<string, PointObject>();
  diagram.objects.forEach((object) => {
    if (object.type === "Point") {
      map.set(object.id, object);
    }
  });
  return map;
}

function coordinateNameForPoint(point: PointObject): string {
  return sanitizeName(unwrapMathLabel(point.label || point.name));
}

function ref(pointId: string | undefined, point: PointCoordinate, points: Map<string, PointObject>): string {
  if (pointId && points.has(pointId)) {
    return `(${coordinateNameForPoint(points.get(pointId)!)} )`.replace(" )", ")");
  }
  return formatPoint(point);
}

function tikzPosition(position?: LabelPosition): string {
  switch (position) {
    case "above-left":
      return "above left";
    case "above-right":
      return "above right";
    case "below-left":
      return "below left";
    case "below-right":
      return "below right";
    case "center":
      return "centered";
    default:
      return position ?? "above";
  }
}

function styleName(object: DiagramObject): string {
  if (object.semanticRole === "construction-line") return "construction line";
  if (object.semanticRole === "force-vector") return "force vector";
  if (object.type === "Vector") return "vector";
  if (object.semanticRole === "function-curve") return "function curve";
  if (object.semanticRole === "tangent-line") return "tangent line";
  if (object.semanticRole === "axis") return "axis";
  if (object.semanticRole === "area-region") return "area region";
  return "main line";
}

function styleOptions(object: DiagramObject, colors: Map<string, string>): string {
  const options = [styleName(object)];
  const drawColor = tikzColor(object.style.stroke, colors);
  const fillColor = tikzColor(object.style.fill, colors);

  if (drawColor) options.push(`draw=${drawColor}`);
  if (object.style.strokeWidth) options.push(`line width=${formatNumber(object.style.strokeWidth)}pt`);
  if (object.style.dashed) options.push("dashed");
  if (fillColor && object.style.fill !== "transparent") options.push(`fill=${fillColor}`);
  if (object.style.opacity !== undefined && object.style.opacity < 1) {
    options.push(`opacity=${formatNumber(object.style.opacity)}`);
  }

  return options.join(", ");
}

function labelFor(object: DiagramObject): string {
  return normalizeLatexLabel(object.label, {
    type: object.type,
    semanticRole: object.semanticRole,
  });
}

function exportPoint(object: PointObject, colors: Map<string, string>): string[] {
  const name = coordinateNameForPoint(object);
  const label = labelFor(object);
  const fillColor = tikzColor(object.style.fill, colors);
  const pointOptions = ["point"];
  if (fillColor) pointOptions.push(`fill=${fillColor}`);
  if (object.style.opacity !== undefined && object.style.opacity < 1) {
    pointOptions.push(`opacity=${formatNumber(object.style.opacity)}`);
  }
  const labelPart = label ? `,label=${tikzPosition(object.style.labelPosition)}:{${label}}` : "";
  return [
    `  \\coordinate (${name}) at ${formatPoint(object.coordinates)};`,
    `  \\node[${pointOptions.join(", ")}${labelPart}] at (${name}) {};`,
  ];
}

function exportAngle(object: AngleObject, points: Map<string, PointObject>, colors: Map<string, string>): string {
  if (object.pointIds?.length === 3 && object.label) {
    const [startId, vertexId, endId] = object.pointIds;
    const start = points.get(startId);
    const vertex = points.get(vertexId);
    const end = points.get(endId);

    if (start && vertex && end) {
      return `  \\pic [${styleOptions(object, colors)}, "${labelFor(object)}", angle radius=${formatNumber(object.radius)}cm] {angle = ${coordinateNameForPoint(start)}--${coordinateNameForPoint(vertex)}--${coordinateNameForPoint(end)}};`;
    }
  }

  return `  \\draw[${styleOptions(object, colors)}] ${formatPoint(object.vertex)} ++(0:${formatNumber(object.radius)}) arc (0:45:${formatNumber(object.radius)});`;
}

function exportFunctionPlot(object: FunctionPlotObject, colors: Map<string, string>, diagram: DiagramModel): string {
  let samples = object.samples;
  try {
    samples = sampleFunctionPlot(object.expression, diagram.viewport, 260).samples;
  } catch {
    samples = object.samples;
  }
  if (samples.length < 2) return `  % ${object.name}: not enough visible samples`;
  const coordinates = samples.map(formatPoint).join(" ");
  const label = labelFor(object);
  const node = label
    ? `\n  \\node[above right] at ${formatPoint(samples[samples.length - 2] ?? samples[0])} {${label}};`
    : "";
  return `  \\draw[${styleOptions(object, colors)}] plot[smooth] coordinates { ${coordinates} };${node}`;
}

function exportPenPath(object: PenPathObject, colors: Map<string, string>): string {
  const coordinates = object.points.map(formatPoint).join(" -- ");
  const label = labelFor(object);
  const node = label
    ? ` node[midway, ${tikzPosition(object.style.labelPosition)}] {${label}}`
    : "";

  return `  \\draw[${styleOptions(object, colors)}] ${coordinates}${node};`;
}

function exportObject(object: DiagramObject, diagram: DiagramModel, points: Map<string, PointObject>, colors: Map<string, string>): string[] {
  if (!object.visibility) {
    return [];
  }

  switch (object.type) {
    case "Point":
      return exportPoint(object, colors);
    case "Segment":
      return [
        `  \\draw[${styleOptions(object, colors)}] ${ref(object.startPointId, object.start, points)} -- ${ref(object.endPointId, object.end, points)};`,
      ];
    case "Line":
      return [
        `  \\draw[${styleOptions(object, colors)}] ${ref(object.pointIds?.[0], object.through[0], points)} -- ${ref(object.pointIds?.[1], object.through[1], points)};`,
      ];
    case "Circle":
      return [`  \\draw[${styleOptions(object, colors)}] ${ref(object.centerPointId, object.center, points)} circle (${formatNumber(object.radius)});`];
    case "Vector":
      return [
        `  \\draw[${styleOptions(object, colors)}] ${ref(object.startPointId, object.start, points)} -- ${ref(object.endPointId, object.end, points)} node[midway, ${tikzPosition(object.style.labelPosition)}] {${labelFor(object)}};`,
      ];
    case "Angle":
      return [exportAngle(object, points, colors)];
    case "Label":
      return [`  \\node at ${formatPoint(object.position)} {${wrapMathLabel(unwrapMathLabel(object.text || object.label || ""))}};`];
    case "FunctionPlot":
      return [exportFunctionPlot(object, colors, diagram)];
    case "PenPath":
      return [exportPenPath(object, colors)];
    case "Polygon": {
      const coordinates = object.points
        .map((point, index) => {
          const pointId = object.pointIds?.[index];
          return ref(pointId, point, points);
        })
        .join(" -- ");
      return [`  \\draw[${styleOptions(object, colors)}] ${coordinates} -- cycle;`];
    }
  }
}

function exportCartesian(diagram: DiagramModel): string[] {
  const { minX, maxX, minY, maxY } = diagram.viewport;
  const xStep = Math.max(1, Math.round((maxX - minX) / 10));
  const yStep = Math.max(1, Math.round((maxY - minY) / 8));

  return [
    "  % Optional cartesian guide",
    `  \\draw[step=${formatNumber(Math.min(xStep, yStep))}, line width=0.2pt] (${formatNumber(minX)},${formatNumber(minY)}) grid (${formatNumber(maxX)},${formatNumber(maxY)});`,
    `  \\draw[axis] (${formatNumber(minX)},0) -- (${formatNumber(maxX)},0);`,
    `  \\draw[axis] (0,${formatNumber(minY)}) -- (0,${formatNumber(maxY)});`,
  ];
}

export function exportTikz(diagram: DiagramModel, options: TikzExportOptions = {}): TikzExport {
  const points = pointMap(diagram);
  const colors = collectColorDefinitions(diagram);
  const colorDefinitions = [...colors.entries()].map(
    ([hex, name]) => `\\definecolor{${name}}{HTML}{${hex}}`,
  );
  const body = [
    ...(options.includeCartesian ? exportCartesian(diagram) : []),
    ...diagram.objects.flatMap((object) => exportObject(object, diagram, points, colors)),
  ];

  const code = [
    "% Required packages:",
    "% \\usepackage{tikz}",
    "% \\usepackage{xcolor}",
    "% \\usetikzlibrary{arrows.meta, angles, quotes, calc}",
    "",
    ...colorDefinitions,
    colorDefinitions.length > 0 ? "" : null,
    "\\begin{tikzpicture}[scale=1]",
    "  \\tikzset{",
    "    main line/.style={semithick},",
    "    construction line/.style={thin},",
    "    force vector/.style={-{Stealth[length=3mm]}, thick},",
    "    vector/.style={-{Stealth[length=2.5mm]}, semithick},",
    "    axis/.style={-{Stealth[length=2mm]}, thin},",
    "    function curve/.style={semithick},",
    "    tangent line/.style={thin, dashed},",
    "    area region/.style={draw=black},",
    "    point/.style={circle, fill, inner sep=1.5pt}",
    "  }",
    "",
    ...body,
    "\\end{tikzpicture}",
  ]
    .filter((line): line is string => line !== null)
    .join("\n");

  return {
    code,
    requiredPackages: ["tikz", "xcolor", "arrows.meta", "angles", "quotes", "calc"],
    pureTikz: true,
    usesPgfplots: false,
  };
}
