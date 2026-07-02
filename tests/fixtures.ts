import type { DiagramModel } from "@/lib/diagram-types";

export function geometryFixture(): DiagramModel {
  return {
    id: "test-geometry",
    name: "Test Geometry",
    diagramType: "geometry",
    gridVisible: false,
    viewport: { minX: -1, maxX: 5, minY: -1, maxY: 4 },
    objects: [
      {
        id: "A",
        name: "A",
        type: "Point",
        label: "A",
        visibility: true,
        coordinates: { x: 0, y: 0 },
        semanticRole: "main-object",
        style: { pointSize: 2, labelPosition: "below-left" },
      },
      {
        id: "B",
        name: "B",
        type: "Point",
        label: "B",
        visibility: true,
        coordinates: { x: 4, y: 0 },
        semanticRole: "main-object",
        style: { pointSize: 4, labelPosition: "below-right" },
      },
      {
        id: "C",
        name: "C",
        type: "Point",
        label: "C",
        visibility: true,
        coordinates: { x: 2, y: 3 },
        semanticRole: "main-object",
        style: { pointSize: 3, labelPosition: "above" },
      },
      {
        id: "triangle",
        name: "Triangle ABC",
        type: "Polygon",
        label: "ABC",
        visibility: true,
        points: [
          { x: 0, y: 0 },
          { x: 4, y: 0 },
          { x: 2, y: 3 },
        ],
        pointIds: ["A", "B", "C"],
        semanticRole: "main-object",
        style: { stroke: "#111111", fill: "transparent", strokeWidth: 1.25 },
      },
      {
        id: "angle-a",
        name: "Angle A",
        type: "Angle",
        label: "theta",
        visibility: true,
        start: { x: 4, y: 0 },
        vertex: { x: 0, y: 0 },
        end: { x: 2, y: 3 },
        pointIds: ["B", "A", "C"],
        radius: 0.5,
        semanticRole: "theorem-label",
        style: { stroke: "#111111", strokeWidth: 1 },
      },
      {
        id: "construction",
        name: "Construction line",
        type: "Segment",
        label: "",
        visibility: true,
        start: { x: 2, y: 3 },
        end: { x: 2, y: 0 },
        semanticRole: "construction-line",
        style: { stroke: "#666666", strokeWidth: 1.4, dashed: false },
      },
    ],
  };
}

export function physicsFixture(): DiagramModel {
  return {
    id: "test-physics",
    name: "Test Physics",
    diagramType: "physics",
    gridVisible: false,
    viewport: { minX: -1, maxX: 5, minY: -1, maxY: 4 },
    objects: [
      {
        id: "force",
        name: "Force",
        type: "Vector",
        label: "N",
        visibility: true,
        start: { x: 1, y: 1 },
        end: { x: 1, y: 3 },
        semanticRole: "force-vector",
        style: { stroke: "#111111", strokeWidth: 1, arrow: false },
      },
    ],
  };
}

export function calculusFixture(): DiagramModel {
  return {
    id: "test-calculus",
    name: "Test Calculus",
    diagramType: "calculus",
    gridVisible: true,
    viewport: { minX: -1, maxX: 5, minY: -1, maxY: 4 },
    objects: [
      {
        id: "curve",
        name: "f(x)",
        type: "FunctionPlot",
        label: "f(x)",
        visibility: true,
        expression: "f(x)=x^2",
        domain: [0, 2],
        samples: [
          { x: 0, y: 0 },
          { x: 1, y: 1 },
          { x: 2, y: 4 },
        ],
        semanticRole: "function-curve",
        style: { stroke: "#111111", strokeWidth: 1.4 },
      },
    ],
  };
}
