"use client";

import { useEffect, useMemo, useRef, useState, type PointerEvent, type WheelEvent } from "react";
import { Crosshair, Maximize2, ZoomIn, ZoomOut } from "lucide-react";
import type {
  DiagramModel,
  DiagramObject,
  DiagramViewport,
  PointCoordinate,
} from "@/lib/diagram-types";
import type { EditorTool } from "@/lib/diagram-editor";
import { resizeObjectToBounds } from "@/lib/diagram-geometry";
import { unwrapMathLabel } from "@/lib/latex-normalizer";

interface DiagramCanvasFallbackProps {
  diagram: DiagramModel;
  selectedObjectIds?: string[];
  activeTool?: EditorTool;
  pendingPoints?: PointCoordinate[];
  coordinatesVisible?: boolean;
  onSelectObjects?: (ids: string[]) => void;
  onCanvasPoint?: (point: PointCoordinate) => void;
  onCommitDiagram?: (diagram: DiagramModel, message?: string) => void;
  onViewportChange?: (viewport: DiagramViewport) => void;
}

type DragState =
  | {
      kind: "move";
      objectIds: string[];
      startDiagram: DiagramModel;
      startPoint: PointCoordinate;
    }
  | {
      kind: "handle";
      objectId: string;
      handle: string;
      startDiagram: DiagramModel;
    }
  | {
      kind: "marquee";
      additive: boolean;
      originalIds: string[];
      startSvg: PointCoordinate;
      currentSvg: PointCoordinate;
      startDiagram: DiagramModel;
    }
  | {
      kind: "pan";
      startClient: PointCoordinate;
      startViewport: DiagramViewport;
    };

interface SvgPaintProps {
  stroke: string;
  fill: string;
  strokeWidth: number;
  strokeDasharray?: string;
  opacity: number;
}

interface ObjectBounds {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

const width = 860;
const height = 600;
const dragCommitThreshold = 0.01;

function toSvg(point: PointCoordinate, diagram: DiagramModel): PointCoordinate {
  const { minX, maxX, minY, maxY } = diagram.viewport;
  return {
    x: ((point.x - minX) / (maxX - minX)) * width,
    y: height - ((point.y - minY) / (maxY - minY)) * height,
  };
}

function fromSvg(point: PointCoordinate, diagram: DiagramModel): PointCoordinate {
  const { minX, maxX, minY, maxY } = diagram.viewport;
  return {
    x: minX + (point.x / width) * (maxX - minX),
    y: minY + ((height - point.y) / height) * (maxY - minY),
  };
}

function labelText(label?: string): string {
  return unwrapMathLabel(label ?? "")
    .replaceAll("\\theta", "theta")
    .replaceAll("\\alpha", "alpha")
    .replaceAll("\\lambda", "lambda")
    .replaceAll("\\omega", "omega")
    .replaceAll("\\vec", "")
    .replace(/[{}]/g, "");
}

function styleFor(object: DiagramObject, selected: boolean): SvgPaintProps {
  return {
    stroke: selected ? "#2563eb" : object.style.stroke ?? "#111111",
    fill: object.style.fill === "transparent" ? "none" : object.style.fill ?? "none",
    strokeWidth: selected ? Math.max(2.2, object.style.strokeWidth ?? 1.25) : object.style.strokeWidth ?? 1.25,
    strokeDasharray: object.style.dashed ? "8 7" : undefined,
    opacity: object.style.opacity ?? 1,
  };
}

function midpoint(start: PointCoordinate, end: PointCoordinate): PointCoordinate {
  return { x: (start.x + end.x) / 2, y: (start.y + end.y) / 2 };
}

function labelOffset(position?: string): PointCoordinate {
  switch (position) {
    case "above":
      return { x: 0, y: -14 };
    case "below":
      return { x: 0, y: 20 };
    case "left":
      return { x: -18, y: 4 };
    case "right":
      return { x: 18, y: 4 };
    case "above-left":
      return { x: -16, y: -12 };
    case "above-right":
      return { x: 16, y: -12 };
    case "below-left":
      return { x: -18, y: 20 };
    case "below-right":
      return { x: 18, y: 20 };
    default:
      return { x: 10, y: -10 };
  }
}

function renderLabel(object: DiagramObject, anchor: PointCoordinate, diagram: DiagramModel): React.ReactNode {
  const label = object.type === "Label" ? object.text : object.label;
  if (!label) return null;

  const point = toSvg(anchor, diagram);
  const offset = labelOffset(object.style.labelPosition);

  return (
    <text
      x={point.x + offset.x}
      y={point.y + offset.y}
      className="pointer-events-none select-none fill-stone-950 font-mono text-[18px]"
      textAnchor={offset.x < 0 ? "end" : offset.x === 0 ? "middle" : "start"}
    >
      {labelText(label)}
    </text>
  );
}

function renderAngle(object: Extract<DiagramObject, { type: "Angle" }>, diagram: DiagramModel, selected: boolean) {
  const center = toSvg(object.vertex, diagram);
  const radius = object.radius * (width / (diagram.viewport.maxX - diagram.viewport.minX));
  return (
    <path
      d={`M ${center.x + radius} ${center.y} A ${radius} ${radius} 0 0 0 ${center.x + radius * 0.7} ${center.y - radius * 0.7}`}
      {...styleFor(object, selected)}
    />
  );
}

function gridLines(diagram: DiagramModel): React.ReactNode[] {
  if (!diagram.gridVisible) return [];

  const lines: React.ReactNode[] = [];
  const rangeX = diagram.viewport.maxX - diagram.viewport.minX;
  const minorStep = rangeX > 28 ? 2 : rangeX > 14 ? 1 : 0.5;
  const startX = Math.ceil(diagram.viewport.minX / minorStep) * minorStep;
  const startY = Math.ceil(diagram.viewport.minY / minorStep) * minorStep;

  for (let x = startX; x <= diagram.viewport.maxX; x += minorStep) {
    const rounded = Number(x.toFixed(4));
    const start = toSvg({ x: rounded, y: diagram.viewport.minY }, diagram);
    const end = toSvg({ x: rounded, y: diagram.viewport.maxY }, diagram);
    const major = Math.abs(rounded % 1) < 0.0001;
    lines.push(
      <line
        key={`gx-${rounded}`}
        x1={start.x}
        y1={start.y}
        x2={end.x}
        y2={end.y}
        stroke={major ? "#dedbd7" : "#f0eeeb"}
      />,
    );
  }

  for (let y = startY; y <= diagram.viewport.maxY; y += minorStep) {
    const rounded = Number(y.toFixed(4));
    const start = toSvg({ x: diagram.viewport.minX, y: rounded }, diagram);
    const end = toSvg({ x: diagram.viewport.maxX, y: rounded }, diagram);
    const major = Math.abs(rounded % 1) < 0.0001;
    lines.push(
      <line
        key={`gy-${rounded}`}
        x1={start.x}
        y1={start.y}
        x2={end.x}
        y2={end.y}
        stroke={major ? "#dedbd7" : "#f0eeeb"}
      />,
    );
  }

  return lines;
}

function axisLines(diagram: DiagramModel, coordinatesVisible: boolean): React.ReactNode {
  if (!coordinatesVisible) return null;

  const axes: React.ReactNode[] = [];
  if (diagram.viewport.minY <= 0 && diagram.viewport.maxY >= 0) {
    const start = toSvg({ x: diagram.viewport.minX, y: 0 }, diagram);
    const end = toSvg({ x: diagram.viewport.maxX, y: 0 }, diagram);
    axes.push(
      <line
        key="x-axis"
        x1={start.x}
        y1={start.y}
        x2={end.x}
        y2={end.y}
        stroke="#78716c"
        strokeWidth="1.35"
        markerEnd="url(#axis-arrow)"
      />,
    );
  }

  if (diagram.viewport.minX <= 0 && diagram.viewport.maxX >= 0) {
    const start = toSvg({ x: 0, y: diagram.viewport.minY }, diagram);
    const end = toSvg({ x: 0, y: diagram.viewport.maxY }, diagram);
    axes.push(
      <line
        key="y-axis"
        x1={start.x}
        y1={start.y}
        x2={end.x}
        y2={end.y}
        stroke="#78716c"
        strokeWidth="1.35"
        markerEnd="url(#axis-arrow)"
      />,
    );
  }

  return <g>{axes}</g>;
}

function coordinateLabels(diagram: DiagramModel, coordinatesVisible: boolean): React.ReactNode[] {
  if (!coordinatesVisible) return [];

  const labels: React.ReactNode[] = [];
  const rangeX = diagram.viewport.maxX - diagram.viewport.minX;
  const step = rangeX > 20 ? 2 : 1;
  const yAnchor = diagram.viewport.minY <= 0 && diagram.viewport.maxY >= 0 ? 0 : diagram.viewport.minY;
  const xAnchor = diagram.viewport.minX <= 0 && diagram.viewport.maxX >= 0 ? 0 : diagram.viewport.minX;

  for (let x = Math.ceil(diagram.viewport.minX / step) * step; x <= diagram.viewport.maxX; x += step) {
    if (Math.abs(x) < 0.0001) continue;
    const point = toSvg({ x, y: yAnchor }, diagram);
    labels.push(
      <text key={`xl-${x}`} x={point.x} y={point.y + 17} textAnchor="middle" className="pointer-events-none select-none fill-stone-500 text-[12px]">
        {Number(x.toFixed(2))}
      </text>,
    );
  }

  for (let y = Math.ceil(diagram.viewport.minY / step) * step; y <= diagram.viewport.maxY; y += step) {
    if (Math.abs(y) < 0.0001) continue;
    const point = toSvg({ x: xAnchor, y }, diagram);
    labels.push(
      <text key={`yl-${y}`} x={point.x + 8} y={point.y + 4} textAnchor="start" className="pointer-events-none select-none fill-stone-500 text-[12px]">
        {Number(y.toFixed(2))}
      </text>,
    );
  }

  return labels;
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

function objectBounds(object: DiagramObject): ObjectBounds {
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

function intersects(a: ObjectBounds, b: ObjectBounds): boolean {
  return a.minX <= b.maxX && a.maxX >= b.minX && a.minY <= b.maxY && a.maxY >= b.minY;
}

function normalizedBounds(start: PointCoordinate, end: PointCoordinate): ObjectBounds {
  return {
    minX: Math.min(start.x, end.x),
    maxX: Math.max(start.x, end.x),
    minY: Math.min(start.y, end.y),
    maxY: Math.max(start.y, end.y),
  };
}

function translatePoint(point: PointCoordinate, dx: number, dy: number): PointCoordinate {
  return {
    x: Number((point.x + dx).toFixed(3)),
    y: Number((point.y + dy).toFixed(3)),
  };
}

function translateObject(object: DiagramObject, dx: number, dy: number): DiagramObject {
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
        domain: [object.domain[0] + dx, object.domain[1] + dx],
        samples: object.samples.map((point) => translatePoint(point, dx, dy)),
      };
  }
}

function updateObjectHandle(object: DiagramObject, handle: string, point: PointCoordinate): DiagramObject {
  const nextPoint = { x: Number(point.x.toFixed(3)), y: Number(point.y.toFixed(3)) };

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
        radius: Number(Math.max(0.05, Math.hypot(nextPoint.x - object.center.x, nextPoint.y - object.center.y)).toFixed(3)),
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

function boundsHandlesForObject(object: DiagramObject): { id: string; point: PointCoordinate; cursor: string }[] {
  if (object.type === "Point" || object.type === "Label") return [];

  const bounds = objectBounds(object);
  if (Math.abs(bounds.maxX - bounds.minX) < 0.001 || Math.abs(bounds.maxY - bounds.minY) < 0.001) return [];

  return [
    { id: "bounds-nw", point: { x: bounds.minX, y: bounds.maxY }, cursor: "cursor-nwse-resize" },
    { id: "bounds-n", point: { x: (bounds.minX + bounds.maxX) / 2, y: bounds.maxY }, cursor: "cursor-ns-resize" },
    { id: "bounds-ne", point: { x: bounds.maxX, y: bounds.maxY }, cursor: "cursor-nesw-resize" },
    { id: "bounds-e", point: { x: bounds.maxX, y: (bounds.minY + bounds.maxY) / 2 }, cursor: "cursor-ew-resize" },
    { id: "bounds-se", point: { x: bounds.maxX, y: bounds.minY }, cursor: "cursor-nwse-resize" },
    { id: "bounds-s", point: { x: (bounds.minX + bounds.maxX) / 2, y: bounds.minY }, cursor: "cursor-ns-resize" },
    { id: "bounds-sw", point: { x: bounds.minX, y: bounds.minY }, cursor: "cursor-nesw-resize" },
    { id: "bounds-w", point: { x: bounds.minX, y: (bounds.minY + bounds.maxY) / 2 }, cursor: "cursor-ew-resize" },
  ];
}

function objectHandlesForObject(object: DiagramObject): { id: string; point: PointCoordinate; cursor: string }[] {
  switch (object.type) {
    case "Point":
      return [{ id: "point", point: object.coordinates, cursor: "cursor-move" }];
    case "Segment":
    case "Vector":
      return [
        { id: "start", point: object.start, cursor: "cursor-move" },
        { id: "end", point: object.end, cursor: "cursor-move" },
      ];
    case "Line":
      return [
        { id: "through-0", point: object.through[0], cursor: "cursor-move" },
        { id: "through-1", point: object.through[1], cursor: "cursor-move" },
      ];
    case "Circle":
      return [
        { id: "center", point: object.center, cursor: "cursor-move" },
        { id: "radius", point: { x: object.center.x + object.radius, y: object.center.y }, cursor: "cursor-ew-resize" },
      ];
    case "Polygon":
      return object.points.map((point, index) => ({ id: `vertex-${index}`, point, cursor: "cursor-move" }));
    case "Angle":
      return [
        { id: "start", point: object.start, cursor: "cursor-move" },
        { id: "vertex", point: object.vertex, cursor: "cursor-move" },
        { id: "end", point: object.end, cursor: "cursor-move" },
      ];
    case "Label":
      return [{ id: "position", point: object.position, cursor: "cursor-move" }];
    case "FunctionPlot":
      return [];
  }
}

function handlesForObject(object: DiagramObject): { id: string; point: PointCoordinate; cursor: string }[] {
  return [...objectHandlesForObject(object), ...boundsHandlesForObject(object)];
}

function renderSelectionFrame(object: DiagramObject, diagram: DiagramModel): React.ReactNode {
  if (object.type === "Point" || object.type === "Label") return null;

  const bounds = objectBounds(object);
  const topLeft = toSvg({ x: bounds.minX, y: bounds.maxY }, diagram);
  const bottomRight = toSvg({ x: bounds.maxX, y: bounds.minY }, diagram);

  return (
    <rect
      key={`${object.id}-selection-frame`}
      x={topLeft.x}
      y={topLeft.y}
      width={bottomRight.x - topLeft.x}
      height={bottomRight.y - topLeft.y}
      fill="none"
      stroke="#2563eb"
      strokeDasharray="5 4"
      strokeWidth="1.5"
      pointerEvents="none"
    />
  );
}

function diagramWithObjects(diagram: DiagramModel, objects: DiagramObject[]): DiagramModel {
  return {
    ...diagram,
    objects,
    metadata: { ...diagram.metadata, updatedAt: new Date().toISOString() },
  };
}

function changedEnough(a: DiagramModel, b: DiagramModel): boolean {
  return JSON.stringify(a.objects) !== JSON.stringify(b.objects);
}

function zoomViewport(viewport: DiagramViewport, anchor: PointCoordinate, factor: number): DiagramViewport {
  const rangeX = viewport.maxX - viewport.minX;
  const rangeY = viewport.maxY - viewport.minY;
  const nextRangeX = Math.max(0.02, rangeX * factor);
  const nextRangeY = Math.max(0.02, rangeY * factor);
  const ratioX = (anchor.x - viewport.minX) / rangeX;
  const ratioY = (anchor.y - viewport.minY) / rangeY;

  return {
    minX: anchor.x - nextRangeX * ratioX,
    maxX: anchor.x + nextRangeX * (1 - ratioX),
    minY: anchor.y - nextRangeY * ratioY,
    maxY: anchor.y + nextRangeY * (1 - ratioY),
  };
}

function renderObject(
  object: DiagramObject,
  diagram: DiagramModel,
  selected: boolean,
): React.ReactNode {
  if (!object.visibility) return null;

  const shared = {
    "data-object-id": object.id,
    className: "cursor-move transition-all",
  };

  switch (object.type) {
    case "Point": {
      const point = toSvg(object.coordinates, diagram);
      return (
        <g key={object.id} {...shared}>
          <circle
            cx={point.x}
            cy={point.y}
            r={selected ? Math.max(6, object.style.pointSize ?? 3.2) : object.style.pointSize ?? 3.2}
            fill={selected ? "#2563eb" : object.style.fill ?? "#111111"}
            opacity={object.style.opacity ?? 1}
          />
          {renderLabel(object, object.coordinates, diagram)}
        </g>
      );
    }
    case "Segment":
    case "Vector": {
      const start = toSvg(object.start, diagram);
      const end = toSvg(object.end, diagram);
      return (
        <g key={object.id} {...shared}>
          <line
            x1={start.x}
            y1={start.y}
            x2={end.x}
            y2={end.y}
            markerEnd={object.type === "Vector" || object.style.arrow ? "url(#arrow)" : undefined}
            {...styleFor(object, selected)}
          />
          {renderLabel(object, midpoint(object.start, object.end), diagram)}
        </g>
      );
    }
    case "Line": {
      const start = toSvg(object.through[0], diagram);
      const end = toSvg(object.through[1], diagram);
      return (
        <line
          key={object.id}
          x1={start.x}
          y1={start.y}
          x2={end.x}
          y2={end.y}
          {...shared}
          {...styleFor(object, selected)}
        />
      );
    }
    case "Circle": {
      const center = toSvg(object.center, diagram);
      const radius = (object.radius / (diagram.viewport.maxX - diagram.viewport.minX)) * width;
      return (
        <g key={object.id} {...shared}>
          <circle cx={center.x} cy={center.y} r={radius} {...styleFor(object, selected)} />
          {renderLabel(object, { x: object.center.x + object.radius * 0.72, y: object.center.y + object.radius * 0.72 }, diagram)}
        </g>
      );
    }
    case "Polygon": {
      const points = object.points.map((point) => {
        const svg = toSvg(point, diagram);
        return `${svg.x},${svg.y}`;
      });
      return <polygon key={object.id} points={points.join(" ")} {...shared} {...styleFor(object, selected)} />;
    }
    case "Angle":
      return (
        <g key={object.id} {...shared}>
          {renderAngle(object, diagram, selected)}
          {renderLabel(object, object.vertex, diagram)}
        </g>
      );
    case "Label":
      return (
        <g key={object.id} {...shared}>
          {renderLabel(object, object.position, diagram)}
        </g>
      );
    case "FunctionPlot": {
      const points = object.samples.map((sample) => {
        const svg = toSvg(sample, diagram);
        return `${svg.x},${svg.y}`;
      });
      return (
        <g key={object.id} {...shared}>
          <polyline points={points.join(" ")} {...styleFor(object, selected)} />
          {renderLabel(object, object.samples[object.samples.length - 2] ?? object.samples[0], diagram)}
        </g>
      );
    }
  }
}

function renderObjectHitArea(object: DiagramObject, diagram: DiagramModel): React.ReactNode {
  if (!object.visibility) return null;

  const shared = {
    "data-object-id": object.id,
    "aria-hidden": true,
    className: "cursor-move",
    fill: "transparent",
    stroke: "transparent",
  };

  switch (object.type) {
    case "Point": {
      const point = toSvg(object.coordinates, diagram);
      return <circle key={`${object.id}-hit`} cx={point.x} cy={point.y} r="14" {...shared} />;
    }
    case "Segment":
    case "Vector": {
      const start = toSvg(object.start, diagram);
      const end = toSvg(object.end, diagram);
      return (
        <line
          key={`${object.id}-hit`}
          x1={start.x}
          y1={start.y}
          x2={end.x}
          y2={end.y}
          strokeWidth="18"
          strokeLinecap="round"
          {...shared}
        />
      );
    }
    case "Line": {
      const start = toSvg(object.through[0], diagram);
      const end = toSvg(object.through[1], diagram);
      return (
        <line
          key={`${object.id}-hit`}
          x1={start.x}
          y1={start.y}
          x2={end.x}
          y2={end.y}
          strokeWidth="18"
          strokeLinecap="round"
          {...shared}
        />
      );
    }
    case "Circle": {
      const center = toSvg(object.center, diagram);
      const radius = (object.radius / (diagram.viewport.maxX - diagram.viewport.minX)) * width;
      return <circle key={`${object.id}-hit`} cx={center.x} cy={center.y} r={Math.max(radius, 8)} pointerEvents="all" {...shared} />;
    }
    case "Polygon": {
      const points = object.points.map((point) => {
        const svg = toSvg(point, diagram);
        return `${svg.x},${svg.y}`;
      });
      return <polygon key={`${object.id}-hit`} points={points.join(" ")} pointerEvents="all" {...shared} />;
    }
    case "Angle": {
      const bounds = objectBounds(object);
      const topLeft = toSvg({ x: bounds.minX, y: bounds.maxY }, diagram);
      const bottomRight = toSvg({ x: bounds.maxX, y: bounds.minY }, diagram);
      return (
        <rect
          key={`${object.id}-hit`}
          x={topLeft.x}
          y={topLeft.y}
          width={Math.max(16, bottomRight.x - topLeft.x)}
          height={Math.max(16, bottomRight.y - topLeft.y)}
          {...shared}
        />
      );
    }
    case "Label": {
      const bounds = objectBounds(object);
      const topLeft = toSvg({ x: bounds.minX, y: bounds.maxY }, diagram);
      const bottomRight = toSvg({ x: bounds.maxX, y: bounds.minY }, diagram);
      return (
        <rect
          key={`${object.id}-hit`}
          x={topLeft.x - 8}
          y={topLeft.y - 8}
          width={Math.max(28, bottomRight.x - topLeft.x + 16)}
          height={Math.max(24, bottomRight.y - topLeft.y + 16)}
          {...shared}
        />
      );
    }
    case "FunctionPlot": {
      const points = object.samples.map((sample) => {
        const svg = toSvg(sample, diagram);
        return `${svg.x},${svg.y}`;
      });
      return <polyline key={`${object.id}-hit`} points={points.join(" ")} strokeWidth="18" strokeLinecap="round" {...shared} />;
    }
  }
}

export function DiagramCanvasFallback({
  diagram,
  selectedObjectIds = [],
  activeTool = "select",
  pendingPoints = [],
  coordinatesVisible = true,
  onSelectObjects,
  onCanvasPoint,
  onCommitDiagram,
  onViewportChange,
}: DiagramCanvasFallbackProps) {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [spacePressed, setSpacePressed] = useState(false);
  const [dragState, setDragState] = useState<DragState | null>(null);
  const [dragDiagram, setDragDiagram] = useState<DiagramModel | null>(null);
  const displayDiagram = dragDiagram ?? diagram;
  const selectedSet = useMemo(() => new Set(selectedObjectIds), [selectedObjectIds]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.code === "Space") setSpacePressed(true);
    }

    function onKeyUp(event: KeyboardEvent) {
      if (event.code === "Space") setSpacePressed(false);
    }

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, []);

  function svgPointFromEvent(event: { clientX: number; clientY: number }): PointCoordinate {
    const svg = svgRef.current;
    const rect = svg?.getBoundingClientRect();
    if (!rect) return { x: 0, y: 0 };

    return {
      x: ((event.clientX - rect.left) / rect.width) * width,
      y: ((event.clientY - rect.top) / rect.height) * height,
    };
  }

  function capturePointer(event: PointerEvent<SVGSVGElement | SVGGElement | SVGElement>) {
    svgRef.current?.setPointerCapture(event.pointerId);
  }

  function beginObjectDrag(event: PointerEvent<SVGSVGElement>, objectId: string) {
    const alreadySelected = selectedSet.has(objectId);
    const nextIds = event.shiftKey
      ? alreadySelected
        ? selectedObjectIds.filter((id) => id !== objectId)
        : [...selectedObjectIds, objectId]
      : alreadySelected
        ? selectedObjectIds
        : [objectId];

    onSelectObjects?.(nextIds);
    setDragState({
      kind: "move",
      objectIds: nextIds.length > 0 ? nextIds : [objectId],
      startDiagram: diagram,
      startPoint: fromSvg(svgPointFromEvent(event), diagram),
    });
  }

  function beginHandleDrag(objectId: string, handle: string) {
    onSelectObjects?.([objectId]);
    setDragState({
      kind: "handle",
      objectId,
      handle,
      startDiagram: diagram,
    });
  }

  function targetAttribute(event: PointerEvent<SVGSVGElement>, selector: string, attribute: string): string | null {
    if (!(event.target instanceof Element)) return null;
    return event.target.closest(selector)?.getAttribute(attribute) ?? null;
  }

  function handleCanvasPointerDown(event: PointerEvent<SVGSVGElement>) {
    if (event.button !== 0 && event.button !== 1) return;

    capturePointer(event);
    const startSvg = svgPointFromEvent(event);

    const handleId = targetAttribute(event, "[data-handle-id]", "data-handle-id");
    const handleObjectId = targetAttribute(event, "[data-handle-object-id]", "data-handle-object-id");
    if (event.button === 0 && handleId && handleObjectId) {
      beginHandleDrag(handleObjectId, handleId);
      return;
    }

    if (activeTool === "hand") {
      setDragState({
        kind: "pan",
        startClient: { x: event.clientX, y: event.clientY },
        startViewport: diagram.viewport,
      });
      return;
    }

    const objectId = targetAttribute(event, "[data-object-id]", "data-object-id");
    if (event.button === 0 && objectId) {
      beginObjectDrag(event, objectId);
      return;
    }

    if (event.button === 1 || event.altKey || spacePressed) {
      setDragState({
        kind: "pan",
        startClient: { x: event.clientX, y: event.clientY },
        startViewport: diagram.viewport,
      });
      return;
    }

    if (activeTool !== "select") return;

    setDragState({
      kind: "marquee",
      additive: event.shiftKey,
      originalIds: selectedObjectIds,
      startSvg,
      currentSvg: startSvg,
      startDiagram: diagram,
    });
  }

  function handleCanvasPointerMove(event: PointerEvent<SVGSVGElement>) {
    if (!dragState) return;
    const svgPoint = svgPointFromEvent(event);

    if (dragState.kind === "pan") {
      const dx = -((event.clientX - dragState.startClient.x) / width) * (dragState.startViewport.maxX - dragState.startViewport.minX);
      const dy = ((event.clientY - dragState.startClient.y) / height) * (dragState.startViewport.maxY - dragState.startViewport.minY);
      onViewportChange?.({
        minX: dragState.startViewport.minX + dx,
        maxX: dragState.startViewport.maxX + dx,
        minY: dragState.startViewport.minY + dy,
        maxY: dragState.startViewport.maxY + dy,
      });
      return;
    }

    if (dragState.kind === "marquee") {
      setDragState({ ...dragState, currentSvg: svgPoint });
      return;
    }

    if (dragState.kind === "move") {
      const current = fromSvg(svgPoint, dragState.startDiagram);
      const dx = current.x - dragState.startPoint.x;
      const dy = current.y - dragState.startPoint.y;
      if (Math.abs(dx) < dragCommitThreshold && Math.abs(dy) < dragCommitThreshold) return;

      const ids = new Set(dragState.objectIds);
      setDragDiagram(
        diagramWithObjects(
          dragState.startDiagram,
          dragState.startDiagram.objects.map((object) => (ids.has(object.id) ? translateObject(object, dx, dy) : object)),
        ),
      );
      return;
    }

    const current = fromSvg(svgPoint, dragState.startDiagram);
    setDragDiagram(
      diagramWithObjects(
        dragState.startDiagram,
        dragState.startDiagram.objects.map((object) =>
          object.id === dragState.objectId ? updateObjectHandle(object, dragState.handle, current) : object,
        ),
      ),
    );
  }

  function handleCanvasPointerUp(event: PointerEvent<SVGSVGElement>) {
    if (!dragState) {
      if (activeTool !== "select" && activeTool !== "hand" && event.button === 0) {
        onCanvasPoint?.(fromSvg(svgPointFromEvent(event), diagram));
      }
      return;
    }

    if (dragState.kind === "marquee") {
      const distance = Math.hypot(dragState.currentSvg.x - dragState.startSvg.x, dragState.currentSvg.y - dragState.startSvg.y);
      if (distance < 4) {
        onSelectObjects?.(dragState.additive ? dragState.originalIds : []);
      } else {
        const start = fromSvg(dragState.startSvg, dragState.startDiagram);
        const end = fromSvg(dragState.currentSvg, dragState.startDiagram);
        const bounds = normalizedBounds(start, end);
        const matches = dragState.startDiagram.objects
          .filter((object) => object.visibility && intersects(objectBounds(object), bounds))
          .map((object) => object.id);
        onSelectObjects?.(dragState.additive ? Array.from(new Set([...dragState.originalIds, ...matches])) : matches);
      }
      setDragState(null);
      return;
    }

    if (dragDiagram && changedEnough(dragState.kind === "pan" ? diagram : dragState.startDiagram, dragDiagram)) {
      onCommitDiagram?.(dragDiagram, "Object edited.");
    }

    setDragDiagram(null);
    setDragState(null);
  }

  function handleWheel(event: WheelEvent<SVGSVGElement>) {
    event.preventDefault();
    const anchor = fromSvg(svgPointFromEvent(event), diagram);
    const factor = event.deltaY < 0 ? 0.88 : 1.14;
    onViewportChange?.(zoomViewport(diagram.viewport, anchor, factor));
  }

  function zoomFromCenter(factor: number) {
    const center = {
      x: (diagram.viewport.minX + diagram.viewport.maxX) / 2,
      y: (diagram.viewport.minY + diagram.viewport.maxY) / 2,
    };
    onViewportChange?.(zoomViewport(diagram.viewport, center, factor));
  }

  function resetViewport() {
    onViewportChange?.({ minX: -5, maxX: 5, minY: -3.5, maxY: 3.5 });
  }

  const marquee = dragState?.kind === "marquee" ? dragState : null;
  const marqueeRect = marquee
    ? {
        x: Math.min(marquee.startSvg.x, marquee.currentSvg.x),
        y: Math.min(marquee.startSvg.y, marquee.currentSvg.y),
        width: Math.abs(marquee.currentSvg.x - marquee.startSvg.x),
        height: Math.abs(marquee.currentSvg.y - marquee.startSvg.y),
      }
    : null;

  const cursorClass =
    activeTool === "hand"
      ? dragState?.kind === "pan" ? "cursor-grabbing" : "cursor-grab"
      : activeTool !== "select"
      ? "cursor-crosshair"
      : dragState?.kind === "pan" || spacePressed
        ? "cursor-grabbing"
        : "cursor-default";

  return (
    <div className="relative h-full min-h-0">
      <svg
        ref={svgRef}
        viewBox={`0 0 ${width} ${height}`}
        onPointerDown={handleCanvasPointerDown}
        onPointerMove={handleCanvasPointerMove}
        onPointerUp={handleCanvasPointerUp}
        onPointerCancel={handleCanvasPointerUp}
        onWheel={handleWheel}
        className={`h-full w-full touch-none rounded-md border border-stone-200 bg-white shadow-sm ${cursorClass}`}
        role="img"
        aria-label={diagram.name}
      >
        <defs>
          <marker id="arrow" markerWidth="12" markerHeight="12" refX="9" refY="3" orient="auto" markerUnits="strokeWidth">
            <path d="M0,0 L0,6 L9,3 z" fill="#111111" />
          </marker>
          <marker id="axis-arrow" markerWidth="10" markerHeight="10" refX="8" refY="3" orient="auto" markerUnits="strokeWidth">
            <path d="M0,0 L0,6 L8,3 z" fill="#78716c" />
          </marker>
        </defs>
        <rect width={width} height={height} fill="#ffffff" />
        <g stroke="#e7e5e4" strokeWidth="1">
          {gridLines(displayDiagram)}
        </g>
        {axisLines(displayDiagram, coordinatesVisible)}
        {coordinateLabels(displayDiagram, coordinatesVisible)}
        {displayDiagram.objects.map((object) => renderObject(object, displayDiagram, selectedSet.has(object.id)))}
        {displayDiagram.objects.map((object) => renderObjectHitArea(object, displayDiagram))}
        {displayDiagram.objects.map((object) =>
          selectedSet.has(object.id) ? renderSelectionFrame(object, displayDiagram) : null,
        )}
        {displayDiagram.objects.map((object) =>
          selectedSet.has(object.id)
            ? handlesForObject(object).map((handle) => {
                const point = toSvg(handle.point, displayDiagram);
                return (
                  <circle
                    key={`${object.id}-${handle.id}`}
                    cx={point.x}
                    cy={point.y}
                    r="6"
                    fill="#ffffff"
                    stroke="#2563eb"
                    strokeWidth="2"
                    data-handle-id={handle.id}
                    data-handle-object-id={object.id}
                    className={handle.cursor}
                  />
                );
              })
            : null,
        )}
        {pendingPoints.map((point, index) => {
          const svgPoint = toSvg(point, displayDiagram);
          return (
            <g key={`${point.x}-${point.y}-${index}`}>
              <circle cx={svgPoint.x} cy={svgPoint.y} r="8" fill="#2563eb" opacity="0.16" />
              <circle cx={svgPoint.x} cy={svgPoint.y} r="4" fill="#2563eb" />
            </g>
          );
        })}
        {marqueeRect ? (
          <rect
            x={marqueeRect.x}
            y={marqueeRect.y}
            width={marqueeRect.width}
            height={marqueeRect.height}
            fill="#2563eb"
            fillOpacity="0.08"
            stroke="#2563eb"
            strokeDasharray="6 5"
            strokeWidth="1.5"
          />
        ) : null}
      </svg>

      <div className="absolute bottom-3 right-3 flex gap-1 rounded-md border border-stone-200 bg-white/95 p-1 shadow-sm">
        <button type="button" onClick={() => zoomFromCenter(0.82)} title="Zoom in" aria-label="Zoom in" className="mini-icon-button">
          <ZoomIn className="h-4 w-4" aria-hidden />
        </button>
        <button type="button" onClick={() => zoomFromCenter(1.22)} title="Zoom out" aria-label="Zoom out" className="mini-icon-button">
          <ZoomOut className="h-4 w-4" aria-hidden />
        </button>
        <button type="button" onClick={resetViewport} title="Reset view" aria-label="Reset view" className="mini-icon-button">
          <Maximize2 className="h-4 w-4" aria-hidden />
        </button>
      </div>

      {activeTool !== "select" && pendingPoints.length > 0 ? (
        <div className="pointer-events-none absolute left-3 top-3 rounded-md border border-blue-100 bg-blue-50 px-2 py-1 text-xs font-semibold text-blue-700">
          <Crosshair className="mr-1 inline h-3.5 w-3.5" aria-hidden />
          {pendingPoints.length}
        </div>
      ) : null}
    </div>
  );
}
