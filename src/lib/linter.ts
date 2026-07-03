import type {
  DiagramModel,
  DiagramObject,
  DiagramStyle,
  PointCoordinate,
  VectorObject,
} from "./diagram-types";
import { isLatexSafeLabel } from "./latex-normalizer";

export interface LintFinding {
  ruleId: string;
  severity: "info" | "warning" | "error";
  message: string;
  suggestedFix?: string;
  affectedObjectId?: string;
  affectedObjectName?: string;
}

export interface LintResult {
  score: number;
  grade: "A" | "B" | "C" | "D";
  findings: LintFinding[];
}

function addFinding(
  findings: LintFinding[],
  finding: LintFinding,
): void {
  const key = `${finding.ruleId}:${finding.affectedObjectId ?? finding.message}`;
  if (!findings.some((item) => `${item.ruleId}:${item.affectedObjectId ?? item.message}` === key)) {
    findings.push(finding);
  }
}

function isNeutralColor(color?: string): boolean {
  if (!color || color === "transparent") {
    return true;
  }

  const normalized = String(color).toLowerCase();
  if (["black", "white", "gray", "grey"].some((name) => normalized.includes(name))) {
    return true;
  }

  const hex = normalized.match(/^#([0-9a-f]{6})$/);
  if (!hex) {
    return false;
  }

  const value = hex[1];
  const red = parseInt(value.slice(0, 2), 16);
  const green = parseInt(value.slice(2, 4), 16);
  const blue = parseInt(value.slice(4, 6), 16);

  return Math.max(red, green, blue) - Math.min(red, green, blue) < 28;
}

function objectAnchor(object: DiagramObject): PointCoordinate | undefined {
  switch (object.type) {
    case "Point":
      return object.coordinates;
    case "Label":
      return object.position;
    case "Vector":
    case "Segment":
      return {
        x: (object.start.x + object.end.x) / 2,
        y: (object.start.y + object.end.y) / 2,
      };
    case "Circle":
      return object.center;
    case "Angle":
      return object.vertex;
    case "FunctionPlot":
      return object.samples[Math.floor(object.samples.length / 2)];
    case "Line":
      return object.through[0];
    case "Polygon":
      return object.points[0];
    case "PenPath":
      return object.points[Math.floor(object.points.length / 2)];
  }
}

function lintOverlappingLabels(diagram: DiagramModel, findings: LintFinding[]): void {
  const labelled = diagram.objects
    .filter((object) => object.visibility && object.label)
    .map((object) => ({ object, anchor: objectAnchor(object) }))
    .filter((entry): entry is { object: DiagramObject; anchor: PointCoordinate } => Boolean(entry.anchor));

  for (let index = 0; index < labelled.length; index += 1) {
    for (let next = index + 1; next < labelled.length; next += 1) {
      const dx = labelled[index].anchor.x - labelled[next].anchor.x;
      const dy = labelled[index].anchor.y - labelled[next].anchor.y;
      if (Math.hypot(dx, dy) < 0.22) {
        addFinding(findings, {
          ruleId: "no-overlapping-labels",
          severity: "warning",
          message: `${labelled[index].object.name} and ${labelled[next].object.name} labels are too close.`,
          suggestedFix: "Move one label to a different side or slightly offset it.",
          affectedObjectId: labelled[next].object.id,
          affectedObjectName: labelled[next].object.name,
        });
      }
    }
  }
}

function lintPointSizes(diagram: DiagramModel, findings: LintFinding[]): void {
  const sizes = diagram.objects
    .filter((object) => object.type === "Point")
    .map((object) => object.style.pointSize ?? 0);

  if (sizes.length > 1 && Math.max(...sizes) - Math.min(...sizes) > 0.8) {
    addFinding(findings, {
      ruleId: "consistent-point-size",
      severity: "warning",
      message: "Point markers use inconsistent sizes.",
      suggestedFix: "Normalize point markers to a compact paper-friendly size.",
    });
  }
}

function lintLineWidths(diagram: DiagramModel, findings: LintFinding[]): void {
  const widths = diagram.objects
    .filter((object) => ["Segment", "Line", "Circle", "Vector", "Polygon", "PenPath", "FunctionPlot"].includes(object.type))
    .map((object) => object.style.strokeWidth ?? 1);

  if (widths.length > 2 && Math.max(...widths) - Math.min(...widths) > 1.1) {
    addFinding(findings, {
      ruleId: "consistent-line-width",
      severity: "warning",
      message: "Line widths vary more than expected for an academic figure.",
      suggestedFix: "Use role-based line widths for main, construction, and vector objects.",
    });
  }
}

function lintColorSafety(diagram: DiagramModel, findings: LintFinding[]): void {
  const colored = diagram.objects.filter((object) => {
    const style: DiagramStyle = object.style;
    return !isNeutralColor(style.stroke) || !isNeutralColor(style.fill);
  });

  if (colored.length > 0) {
    addFinding(findings, {
      ruleId: "grayscale-safe-colors",
      severity: diagram.diagramType === "physics" ? "info" : "warning",
      message: "Some object colors may not print clearly in grayscale.",
      suggestedFix: "Switch academic presets to monochrome strokes and vary line style instead.",
      affectedObjectId: colored[0].id,
      affectedObjectName: colored[0].name,
    });
  }

  const distinctColors = new Set(
    diagram.objects
      .flatMap((object) => [object.style.stroke, object.style.fill])
      .filter((color): color is string => Boolean(color) && color !== "transparent"),
  );

  if (distinctColors.size > 5) {
    addFinding(findings, {
      ruleId: "avoid-random-colors",
      severity: "warning",
      message: "The figure uses too many unrelated colors.",
      suggestedFix: "Use semantic styles instead of ad hoc colors.",
    });
  }
}

function lintGrid(diagram: DiagramModel, findings: LintFinding[]): void {
  if (diagram.gridVisible && diagram.diagramType !== "calculus") {
    addFinding(findings, {
      ruleId: "avoid-unnecessary-grid",
      severity: "info",
      message: "Grid lines are usually unnecessary in final geometry or physics figures.",
      suggestedFix: "Hide the grid before exporting to TeX.",
    });
  }
}

function lintLabels(diagram: DiagramModel, findings: LintFinding[]): void {
  diagram.objects.forEach((object) => {
    if (!isLatexSafeLabel(object.label)) {
      addFinding(findings, {
        ruleId: "latex-label-required",
        severity: "warning",
        message: `${object.name} label is not LaTeX-normalized.`,
        suggestedFix: "Normalize labels such as theta to \\theta and point names to math mode.",
        affectedObjectId: object.id,
        affectedObjectName: object.name,
      });
    }
  });
}

function lintSemanticNames(diagram: DiagramModel, findings: LintFinding[]): void {
  diagram.objects.forEach((object) => {
    if (/^(object|shape|item|line)\d*$/i.test(object.name)) {
      addFinding(findings, {
        ruleId: "semantic-object-names",
        severity: "info",
        message: `${object.name} has a generic object name.`,
        suggestedFix: "Use mathematical names such as Altitude from C, Tangent at P, or Weight.",
        affectedObjectId: object.id,
        affectedObjectName: object.name,
      });
    }
  });
}

function lintVectors(diagram: DiagramModel, findings: LintFinding[]): void {
  diagram.objects
    .filter((object): object is VectorObject => object.type === "Vector")
    .forEach((vector) => {
      if (!vector.style.arrow) {
        addFinding(findings, {
          ruleId: "readable-vector-labels",
          severity: "error",
          message: `${vector.name} is a vector without an arrow style.`,
          suggestedFix: "Enable arrow style and normalize the vector label.",
          affectedObjectId: vector.id,
          affectedObjectName: vector.name,
        });
      }

      if (vector.label && vector.label.length > 18) {
        addFinding(findings, {
          ruleId: "readable-vector-labels",
          severity: "warning",
          message: `${vector.name} label is too long for a vector annotation.`,
          suggestedFix: "Use compact vector notation such as \\vec{F}_{net}.",
          affectedObjectId: vector.id,
          affectedObjectName: vector.name,
        });
      }
    });
}

function lintColumnFit(diagram: DiagramModel, findings: LintFinding[]): void {
  const width = diagram.viewport.maxX - diagram.viewport.minX;
  const height = diagram.viewport.maxY - diagram.viewport.minY;
  if (width > 8.8 || height > 6.5) {
    addFinding(findings, {
      ruleId: "fit-to-column-width",
      severity: "warning",
      message: "The viewport may be too wide for a single-column TeX figure.",
      suggestedFix: "Scale or crop to a publication column width before export.",
    });
  }
}

function lintRoleDistinction(diagram: DiagramModel, findings: LintFinding[]): void {
  diagram.objects.forEach((object) => {
    if (
      object.semanticRole === "construction-line" &&
      (!object.style.dashed || (object.style.strokeWidth ?? 1) > 0.95)
    ) {
      addFinding(findings, {
        ruleId: "distinguish-main-vs-construction-lines",
        severity: "warning",
        message: `${object.name} is marked as construction but does not look secondary.`,
        suggestedFix: "Use a thin dashed style for construction lines.",
        affectedObjectId: object.id,
        affectedObjectName: object.name,
      });
    }
  });
}

function gradeForScore(score: number): LintResult["grade"] {
  if (score >= 90) return "A";
  if (score >= 75) return "B";
  if (score >= 60) return "C";
  return "D";
}

export function lintDiagram(diagram: DiagramModel): LintResult {
  const findings: LintFinding[] = [];

  lintOverlappingLabels(diagram, findings);
  lintPointSizes(diagram, findings);
  lintLineWidths(diagram, findings);
  lintColorSafety(diagram, findings);
  lintGrid(diagram, findings);
  lintLabels(diagram, findings);
  lintSemanticNames(diagram, findings);
  lintVectors(diagram, findings);
  lintColumnFit(diagram, findings);
  lintRoleDistinction(diagram, findings);

  const penalty = findings.reduce((sum, finding) => {
    if (finding.severity === "error") return sum + 13;
    if (finding.severity === "warning") return sum + 7;
    return sum + 3;
  }, 0);
  const score = Math.max(0, Math.min(100, 100 - penalty));

  return {
    score,
    grade: gradeForScore(score),
    findings,
  };
}
